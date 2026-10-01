// In-app updates: compare this copy with GitHub and hand off to
// scripts/apply-update.mjs, which restarts the server on the new code.
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { ensureUpstream } from '../scripts/git-upstream.mjs';
import { BadRequestError } from './service.js';

const root = path.resolve(import.meta.dirname, '..');
export const UPDATE_LOG = path.join(os.tmpdir(), 'fist-pms-update.log');

const exec = promisify(execFile);
const git = async (...args) =>
  (await exec('git', args, { cwd: root, timeout: 30_000, windowsHide: true })).stdout.trim();

const SEP = '\x1f';
const commits = async (range) =>
  (await git('log', `--format=%h${SEP}%cI${SEP}%s`, range))
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, date, subject] = line.split(SEP);
      return { hash, date, subject };
    });

let running = false;

// The last update run: what failed, if anything. The log is written by the updater.
function lastRun() {
  try {
    const text = fs.readFileSync(UPDATE_LOG, 'utf8');
    const failed = /^UPDATE FAILED/m.test(text);
    return { failed, log: failed ? text.split('\n').slice(-25).join('\n') : null };
  } catch {
    return { failed: false, log: null };
  }
}

export async function status() {
  let isRepo = true;
  try {
    await git('rev-parse', '--git-dir');
  } catch {
    isRepo = false;
  }
  if (!isRepo) return { isRepo: false, lastRun: lastRun() };

  const [current] = await commits('-1');
  const dirty = Boolean(await git('status', '--porcelain', '--untracked-files=no'));
  let upstream = null;
  let behind = [];
  let error = null;
  try {
    upstream = ensureUpstream(root);
    await git('fetch', '--quiet');
    behind = await commits('HEAD..@{u}');
  } catch (err) {
    error = /Could not resolve host|unable to access/i.test(err.message)
      ? 'Could not reach GitHub. Check your internet connection.'
      : 'Could not check GitHub for updates.';
  }
  return { isRepo, current, upstream, behind, dirty, error, updating: running, lastRun: lastRun() };
}

export async function apply() {
  if (running) return { started: true };
  const s = await status();
  if (!s.isRepo) throw new BadRequestError('bad_request', 'This copy was not installed with git, so it cannot update itself');
  if (s.dirty) throw new BadRequestError('bad_request', 'This copy has local code changes; update it by hand');
  if (s.error) throw new BadRequestError('bad_request', s.error);
  running = true;
  // Detached so it outlives this server, which it stops and restarts.
  const log = fs.openSync(UPDATE_LOG, 'w');
  spawn(process.execPath, [path.join(root, 'scripts', 'apply-update.mjs')], {
    cwd: root,
    detached: true,
    stdio: ['ignore', log, log],
    windowsHide: true,
  }).unref();
  return { started: true };
}
