// The Claude Desktop extension: building it, finding which version Claude has installed,
// and handing a fresh build to Claude Desktop's installer.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DATA_DIR, ROOT_DIR } from './config.js';

export const EXTENSION_FILE = path.join(ROOT_DIR, 'dist', 'fist-pms.mcpb');
const BUILT_MANIFEST = path.join(ROOT_DIR, 'dist', 'extension', 'manifest.json');
const SOURCE_MANIFEST = path.join(ROOT_DIR, 'extension', 'manifest.json');
// Read by the installed extension, which cannot see this folder, to notice it is out of date.
export const LATEST_FILE = path.join(DATA_DIR, 'extension-latest.json');

const readVersion = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).version ?? null;
  } catch {
    return null;
  }
};

// '1.10.0' > '1.9.0'
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

// Claude Desktop's data folders. The Microsoft Store build keeps its AppData inside its
// package (only Claude itself sees it at the normal path), so look there too.
function claudeDataDirs() {
  if (process.platform === 'darwin') return [path.join(os.homedir(), 'Library', 'Application Support', 'Claude')];
  if (process.platform !== 'win32') return [path.join(os.homedir(), '.config', 'Claude')];
  const roaming = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
  const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
  const dirs = [path.join(roaming, 'Claude')];
  try {
    for (const pkg of fs.readdirSync(path.join(local, 'Packages'))) {
      if (/^Claude_/i.test(pkg)) dirs.push(path.join(local, 'Packages', pkg, 'LocalCache', 'Roaming', 'Claude'));
    }
  } catch {
    // no Store apps
  }
  return dirs;
}

// The installed version (id is "local.mcpb.<author>.<name>"); the newest if several copies exist.
function installedVersion() {
  return claudeDataDirs()
    .map((dir) => readVersion(path.join(dir, 'Claude Extensions', 'local.mcpb.fist-innovations.fist-pms', 'manifest.json')))
    .filter(Boolean)
    .sort(compareVersions)
    .at(-1) ?? null;
}

export function status() {
  const latest = readVersion(SOURCE_MANIFEST);
  const installed = installedVersion();
  return {
    latest,
    installed, // null: not installed in Claude Desktop (or Claude keeps it somewhere else)
    updateAvailable: Boolean(installed && latest && compareVersions(installed, latest) < 0),
  };
}

export function publishLatest() {
  const latest = readVersion(SOURCE_MANIFEST);
  if (!latest) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LATEST_FILE, JSON.stringify({ version: latest }));
  } catch (err) {
    console.error('Could not record the extension version:', err.message);
  }
}

// One build at a time, shared by concurrent requests.
let building = null;
function build() {
  building ??= new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [path.join(ROOT_DIR, 'scripts', 'build-extension.mjs')],
      { cwd: ROOT_DIR, windowsHide: true, timeout: 5 * 60_000 },
      (err) => (err ? reject(err) : resolve()),
    );
  }).finally(() => {
    building = null;
  });
  return building;
}

// dist/ is not in git: build on first use, and again whenever the source version moved on.
export async function ensureBuilt() {
  const stale = readVersion(BUILT_MANIFEST) !== readVersion(SOURCE_MANIFEST);
  if (stale || !fs.existsSync(EXTENSION_FILE)) await build();
  return EXTENSION_FILE;
}

// Opens the .mcpb with its default app, which is Claude Desktop's install dialog.
export async function openInstaller() {
  const file = await ensureBuilt();
  if (process.platform === 'win32') {
    // explorer.exe exits with 1 even when it opened the file, so its result says nothing.
    execFile('explorer.exe', [file], () => {});
    return;
  }
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  await new Promise((resolve, reject) => execFile(cmd, [file], (err) => (err ? reject(err) : resolve())));
}
