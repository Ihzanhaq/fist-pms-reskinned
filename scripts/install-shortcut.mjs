// Adds a "FIST PMS" shortcut to the desktop (plus the app menu on Linux and
// ~/Applications on macOS) that
// runs scripts/launch.mjs. Run once after cloning: npm run shortcut
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const launcher = path.join(root, 'scripts', 'launch.mjs');
const icons = path.join(root, 'scripts', 'icons');
const node = process.execPath;
const NAME = 'FIST PMS';

function desktopDir() {
  if (process.platform === 'win32') {
    // Honours OneDrive-redirected desktops.
    return execFileSync('powershell', ['-NoProfile', '-Command', "[Environment]::GetFolderPath('Desktop')"], {
      encoding: 'utf8',
    }).trim();
  }
  try {
    const dir = execFileSync('xdg-user-dir', ['DESKTOP'], { encoding: 'utf8' }).trim();
    if (dir) return dir;
  } catch {}
  return path.join(os.homedir(), 'Desktop');
}

function windows() {
  const lnk = path.join(desktopDir(), `${NAME}.lnk`);
  const q = (s) => `'${s.replace(/'/g, "''")}'`;
  const ps = [
    '$s = (New-Object -ComObject WScript.Shell).CreateShortcut(' + q(lnk) + ')',
    `$s.TargetPath = ${q(node)}`,
    `$s.Arguments = ${q(`"${launcher}"`)}`,
    `$s.WorkingDirectory = ${q(root)}`,
    `$s.IconLocation = ${q(path.join(icons, 'fist-pms.ico'))}`,
    '$s.WindowStyle = 7', // minimised: the launcher's console never takes focus
    `$s.Description = ${q('Open the FIST PMS dashboard')}`,
    '$s.Save()',
  ].join('; ');
  execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
  return [lnk];
}

function linux() {
  const q = (s) => `"${s.replace(/(["\\`$])/g, '\\$1')}"`;
  const entry = [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${NAME}`,
    'Comment=Open the FIST PMS dashboard',
    `Exec=${q(node)} ${q(launcher)}`,
    `Path=${root}`,
    `Icon=${path.join(icons, 'fist-pms.png')}`,
    'Terminal=false',
    'Categories=Office;ProjectManagement;',
    '',
  ].join('\n');
  const targets = [
    path.join(os.homedir(), '.local', 'share', 'applications', 'fist-pms.desktop'),
    path.join(desktopDir(), 'fist-pms.desktop'),
  ];
  for (const file of targets) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, entry, { mode: 0o755 });
    // GNOME only runs desktop-folder launchers marked as trusted.
    try {
      execFileSync('gio', ['set', file, 'metadata::trusted', 'true'], { stdio: 'ignore' });
    } catch {}
  }
  return targets;
}

// macOS: a small app bundle in ~/Applications (so Launchpad and Spotlight find
// it) with a link on the desktop. Apps opened from Finder get a minimal PATH,
// so the bundle adds the folders where node, npm and git usually live.
function mac() {
  const app = path.join(os.homedir(), 'Applications', `${NAME}.app`);
  const contents = path.join(app, 'Contents');
  fs.rmSync(app, { recursive: true, force: true });
  fs.mkdirSync(path.join(contents, 'MacOS'), { recursive: true });
  fs.mkdirSync(path.join(contents, 'Resources'), { recursive: true });

  const sh = (s) => `'${s.replace(/'/g, "'\\''")}'`;
  const exe = path.join(contents, 'MacOS', 'fist-pms');
  fs.writeFileSync(
    exe,
    [
      '#!/bin/sh',
      `export PATH=${sh(path.dirname(node))}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:"$PATH"`,
      `cd ${sh(root)} || exit 1`,
      `exec ${sh(node)} ${sh(launcher)}`,
      '',
    ].join('\n'),
    { mode: 0o755 },
  );

  let icon = '';
  try {
    const set = path.join(os.tmpdir(), 'fist-pms.iconset');
    fs.rmSync(set, { recursive: true, force: true });
    fs.mkdirSync(set);
    for (const size of [16, 32, 128, 256, 512]) {
      for (const [scale, suffix] of [[1, ''], [2, '@2x']]) {
        const px = String(size * scale);
        execFileSync('sips', ['-z', px, px, path.join(icons, 'fist-pms.png'), '--out', path.join(set, `icon_${size}x${size}${suffix}.png`)], { stdio: 'ignore' });
      }
    }
    execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(contents, 'Resources', 'fist-pms.icns')]);
    fs.rmSync(set, { recursive: true, force: true });
    icon = '  <key>CFBundleIconFile</key><string>fist-pms</string>\n';
  } catch {} // no icon is fine

  fs.writeFileSync(
    path.join(contents, 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>${NAME}</string>
  <key>CFBundleDisplayName</key><string>${NAME}</string>
  <key>CFBundleIdentifier</key><string>com.fistinnovations.pms-dashboard</string>
  <key>CFBundleExecutable</key><string>fist-pms</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSUIElement</key><true/>
${icon}</dict></plist>
`,
  );

  const link = path.join(desktopDir(), `${NAME}.app`);
  fs.rmSync(link, { recursive: true, force: true });
  fs.symlinkSync(app, link);
  return [app, link];
}

const make = { win32: windows, linux, darwin: mac }[process.platform];
if (!make) {
  console.error('Shortcuts are supported on Windows, macOS and Linux.');
  process.exit(1);
}
const made = make();
console.log(`Shortcut created:\n  ${made.join('\n  ')}`);
