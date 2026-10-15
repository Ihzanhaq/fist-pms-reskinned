// Saved FISSO sign-in for automatic logins (Windows only). The password and the
// authenticator secret are encrypted with Windows DPAPI, so only this Windows
// account on this computer can read them; the rest of the file is plain metadata.
import fs from 'node:fs';
import { AUTO_LOGIN_FILE, DATA_DIR } from './config.js';
import { runPowerShell } from './powershell.js';

export const supported = process.platform === 'win32';

const DPAPI = (fn) => `
Add-Type -AssemblyName System.Security
$data = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
$out = [Security.Cryptography.ProtectedData]::${fn}($data, $null, 'CurrentUser')
[Convert]::ToBase64String($out)
`;

const protect = async (text) => runPowerShell(DPAPI('Protect'), { input: Buffer.from(text, 'utf8').toString('base64') });
const unprotect = async (blob) =>
  Buffer.from(await runPowerShell(DPAPI('Unprotect'), { input: blob }), 'base64').toString('utf8');

function read() {
  try {
    return JSON.parse(fs.readFileSync(AUTO_LOGIN_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function write(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(AUTO_LOGIN_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

/** What the dashboard may show: never the password or secret. */
export function status() {
  const saved = read();
  if (!supported) return { supported: false, enabled: false };
  if (!saved) return { supported: true, enabled: false };
  return {
    supported: true,
    enabled: !saved.pausedReason,
    username: saved.username,
    label: saved.label,
    askHello: saved.askHello !== false,
    pausedReason: saved.pausedReason ?? null,
    createdAt: saved.createdAt,
  };
}

/** True when a sign-in can be attempted (saved and not paused). */
export function isActive() {
  const saved = read();
  return Boolean(supported && saved?.blob && !saved.pausedReason);
}

/**
 * @param {{ username: string, password: string, otp: { secret: string, algorithm: string, digits: number, period: number }, label: string }} login
 */
export async function save({ username, password, otp, label }) {
  const blob = await protect(JSON.stringify({ password, otp }));
  const previous = read();
  write({
    username,
    label,
    askHello: previous?.askHello ?? true,
    createdAt: new Date().toISOString(),
    blob,
  });
}

/** Decrypted login, or null when nothing is saved. */
export async function load() {
  const saved = read();
  if (!saved?.blob) return null;
  const { password, otp } = JSON.parse(await unprotect(saved.blob));
  return { username: saved.username, label: saved.label, askHello: saved.askHello !== false, password, otp };
}

/** Replace only the password (after the user changed it in FISSO). */
export async function updatePassword(password) {
  const saved = read();
  if (!saved?.blob) throw new Error('Automatic sign-in is not set up');
  const { otp } = JSON.parse(await unprotect(saved.blob));
  const blob = await protect(JSON.stringify({ password, otp }));
  write({ ...saved, blob, pausedReason: undefined });
}

export function setAskHello(on) {
  const saved = read();
  if (!saved) throw new Error('Automatic sign-in is not set up');
  write({ ...saved, askHello: Boolean(on) });
}

export function pause(reason) {
  const saved = read();
  if (saved) write({ ...saved, pausedReason: reason });
}

export function resume() {
  const saved = read();
  if (saved) write({ ...saved, pausedReason: undefined });
}

export function remove() {
  fs.rmSync(AUTO_LOGIN_FILE, { force: true });
}
