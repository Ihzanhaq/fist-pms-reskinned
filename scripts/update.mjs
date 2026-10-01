// Updates an installed copy: pulls the latest code, installs dependencies,
// rebuilds the web app and stops the running server so the desktop shortcut
// starts the new version. Run with `npm run update`.
import { execSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
const read = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();

if (read('git status --porcelain --untracked-files=no')) {
  console.error('You have local changes. Commit or stash them, then run the update again.');
  process.exit(1);
}

const before = read('git rev-parse HEAD');
run('git pull --ff-only');
const after = read('git rev-parse HEAD');
if (before === after) console.log('Already on the latest version; rebuilding anyway.');

run('npm install');
run('npm run build');

// Stop the background server; the shortcut starts a fresh one.
const { PORT } = await import('../server/config.js');
try {
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }"`,
      { stdio: 'ignore' },
    );
  } else {
    execSync(`fuser -k ${PORT}/tcp || lsof -ti tcp:${PORT} | xargs -r kill`, { stdio: 'ignore', shell: '/bin/sh' });
  }
} catch {
  // Nothing was running.
}

console.log('\nUpdated. Open the FIST PMS shortcut to start the new version.');
