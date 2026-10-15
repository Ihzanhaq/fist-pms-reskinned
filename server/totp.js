// Time-based one-time codes (RFC 6238), as an authenticator app makes them.
import crypto from 'node:crypto';

const ALGORITHMS = { SHA1: 'sha1', SHA256: 'sha256', SHA512: 'sha512' };

// Keycloak's setup page carries the secret as plain text; the app key is its bytes.
export function totp(secret, { time = Date.now(), period = 30, digits = 6, algorithm = 'SHA1' } = {}) {
  const hash = ALGORITHMS[algorithm.toUpperCase().replace(/^HMAC|-/g, '')];
  if (!hash) throw new Error(`Unsupported OTP algorithm ${algorithm}`);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / period)));
  const mac = crypto.createHmac(hash, Buffer.from(secret, 'utf8')).update(counter).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const value = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(value).padStart(digits, '0');
}

/** Milliseconds until the next code starts. */
export function msUntilNextCode(period = 30, time = Date.now()) {
  return period * 1000 - (time % (period * 1000));
}
