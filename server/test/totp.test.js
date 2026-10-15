import { test } from 'node:test';
import assert from 'node:assert/strict';
import { msUntilNextCode, totp } from '../totp.js';

// RFC 6238 appendix B test vectors.
const SHA1_KEY = '12345678901234567890';
const SHA256_KEY = '12345678901234567890123456789012';
const SHA512_KEY = '1234567890123456789012345678901234567890123456789012345678901234';

test('matches the RFC 6238 vectors', () => {
  const cases = [
    [59, '94287082', '46119246', '90693936'],
    [1111111109, '07081804', '68084774', '25091201'],
    [20000000000, '65353130', '77737706', '47863826'],
  ];
  for (const [seconds, sha1, sha256, sha512] of cases) {
    const time = seconds * 1000;
    assert.equal(totp(SHA1_KEY, { time, digits: 8 }), sha1);
    assert.equal(totp(SHA256_KEY, { time, digits: 8, algorithm: 'HmacSHA256' }), sha256);
    assert.equal(totp(SHA512_KEY, { time, digits: 8, algorithm: 'SHA512' }), sha512);
  }
});

test('defaults to six digits and keeps leading zeros', () => {
  assert.equal(totp(SHA1_KEY, { time: 1111111109 * 1000 }), '081804');
});

test('rejects unknown algorithms', () => {
  assert.throws(() => totp(SHA1_KEY, { algorithm: 'MD5' }), /Unsupported/);
});

test('counts down to the next code', () => {
  assert.equal(msUntilNextCode(30, 59_000), 1000);
  assert.equal(msUntilNextCode(30, 60_000), 30_000);
});
