// What the desktop shortcut runs: starts the dashboard server in the
// background if it is not already up, then opens the app in its own window.
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

// First run after a fresh clone: install and build.
if (!fs.existsSync(path.join(root, 'node_modules'))) run('npm install');
if (!fs.existsSync(path.join(root, 'web', 'dist', 'index.html'))) run('npm run build');

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
