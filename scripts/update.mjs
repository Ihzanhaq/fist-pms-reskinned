// Updates an installed copy: pulls the latest code, installs dependencies,
// rebuilds the web app and stops the running server so the desktop shortcut
// starts the new version. Run with `npm run update`. (The shortcut also
// updates itself on launch; this is the manual version.)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ensureUpstream } from './git-upstream.mjs';
import { stopServer } from './stop-server.mjs';

const root = path.resolve(import.meta.dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
const read = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();

if (read('git status --porcelain --untracked-files=no')) {
  console.error('You have local changes. Commit or stash them, then run the update again.');
  process.exit(1);
}

const before = read('git rev-parse HEAD');
ensureUpstream(root);
run('git pull --ff-only');
const after = read('git rev-parse HEAD');
if (before === after) console.log('Already on the latest version; rebuilding anyway.');

// Stop the background server first; the shortcut starts a fresh one.
stopServer();

// `npm ci` installs exactly what package-lock.json says and never rewrites it.
run('npm ci');
run('npm run build');
fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true }); // stale extension; rebuilt on next download
fs.writeFileSync(path.join(root, 'web', 'dist', '.built-commit'), after);

console.log('\nUpdated. Open the FIST PMS shortcut to start the new version.');
