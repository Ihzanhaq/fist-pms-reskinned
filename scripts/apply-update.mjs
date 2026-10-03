// Run by the dashboard's "Update now" button (detached from the server):
// stops the server, pulls, installs, rebuilds, then starts the server again.
// Output goes to the update log; a failure still restarts the old version.
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { stopServer } from './stop-server.mjs';

const root = path.resolve(import.meta.dirname, '..');
const run = (cmd) => {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: root, stdio: 'inherit', windowsHide: true });
};

// Let the server answer the request that started this.
await new Promise((r) => setTimeout(r, 800));
stopServer();

try {
  run('git pull --ff-only');
  run('npm ci');
  run('npm run build');
  fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true }); // stale extension; rebuilt on next download
  const head = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
  fs.writeFileSync(path.join(root, 'web', 'dist', '.built-commit'), head);
  console.log('UPDATE OK');
} catch (err) {
  console.log(`UPDATE FAILED: ${err.message}`);
}

spawn(process.execPath, [path.join(root, 'server', 'index.js')], {
  cwd: root,
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
}).unref();
