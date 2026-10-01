// Copies set up by hand (git init + remote add, or a local "master" branch)
// may not track a remote branch, so `git pull` has nothing to pull from.
// Links the current branch to origin's default branch when that happens.
import { execSync } from 'node:child_process';

export function ensureUpstream(root) {
  const read = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20_000, windowsHide: true }).trim();
  try {
    return read('git rev-parse --abbrev-ref --symbolic-full-name @{u}');
  } catch {}
  read('git fetch --quiet origin');
  let target = 'origin/main';
  try {
    target = read('git rev-parse --abbrev-ref origin/HEAD');
  } catch {}
  read(`git branch --set-upstream-to=${target}`);
  return target;
}
