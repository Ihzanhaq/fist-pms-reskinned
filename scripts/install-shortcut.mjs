// Adds a "FIST PMS" shortcut to the desktop (and the app menu on Linux) that
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

if (process.platform !== 'win32' && process.platform !== 'linux') {
  console.error('Shortcuts are supported on Windows and Linux.');
  process.exit(1);
}
const made = process.platform === 'win32' ? windows() : linux();
console.log(`Shortcut created:\n  ${made.join('\n  ')}`);
