// What the desktop shortcut runs: starts the dashboard server in the
// background if it is not already up, then opens the app in its own window.
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

const read = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8', timeout: 20_000, windowsHide: true }).trim();
const builtFile = path.join(root, 'web', 'dist', '.built-commit');

// Auto-update: pull new commits when online and the copy has no local edits.
// Any failure (offline, diverged history, no git) launches the current version.
try {
  if (!read('git status --porcelain --untracked-files=no')) {
    (await import('./git-upstream.mjs')).ensureUpstream(root);
    read('git fetch --quiet');
    if (read('git rev-list --count HEAD..@{u}') !== '0') read('git pull --ff-only --quiet');
  }
} catch {}

let head = null;
try {
  head = read('git rev-parse HEAD');
} catch {}
const built = fs.existsSync(builtFile) ? fs.readFileSync(builtFile, 'utf8').trim() : null;
const hasBuild = fs.existsSync(path.join(root, 'web', 'dist', 'index.html'));
const changed = Boolean(head) && built !== head;

// Install and build on first run, and again whenever the code has changed.
// A server started from older code is stopped first so it restarts on the new
// version. `npm ci` never rewrites package-lock.json, which would otherwise
// count as a local edit and block the next update.
if (changed && hasBuild) (await import('./stop-server.mjs')).stopServer();
if (!fs.existsSync(path.join(root, 'node_modules')) || changed) run('npm ci');
if (!hasBuild || changed) {
  run('npm run build');
  if (head) fs.writeFileSync(builtFile, head);
}

const { PORT } = await import('../server/config.js');
const { chosenBrowser, findExecutable } = await import('../server/browsers.js');
const url = `http://localhost:${PORT}`;

const isUp = () =>
  fetch(`${url}/api/browsers`, { signal: AbortSignal.timeout(1000) }).then(
    (r) => r.ok,
    () => false,
  );

if (!(await isUp())) {
  spawn(process.execPath, [path.join(root, 'server', 'index.js')], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
  for (let i = 0; i < 50 && !(await isUp()); i++) await new Promise((r) => setTimeout(r, 200));
}

// An app-style window (no tabs or address bar) when a Chromium browser is
// installed; otherwise the default browser.
const browser = findExecutable(chosenBrowser());
if (browser) {
  spawn(browser, [`--app=${url}`], { detached: true, stdio: 'ignore' }).unref();
} else if (process.platform === 'win32') {
  spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
} else {
  spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
}
