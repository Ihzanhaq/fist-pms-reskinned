import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authenticatorOption, classify, otpChoice, otpPolicy } from '../keycloak.js';

const page = (over = {}) => ({
  url: 'https://auth.fistinnovations.com/realms/fistinnovations/login-actions/authenticate',
  loginForm: false,
  username: false,
  password: false,
  tryAnotherWay: false,
  passkey: false,
  selectCredential: [],
  otp: false,
  otpChoices: [],
  totpSetup: false,
  manualModeLink: null,
  error: '',
  body: '',
  ...over,
});

test('classifies each FISSO sign-in page', () => {
  assert.equal(classify(page({ loginForm: true, username: true, password: true })), 'password');
  assert.equal(classify(page({ loginForm: true, username: true })), 'username');
  assert.equal(classify(page({ passkey: true, tryAnotherWay: true })), 'passkey');
  assert.equal(classify(page({ selectCredential: [{ index: 0, text: 'Passkey' }] })), 'select-credential');
  assert.equal(classify(page({ otp: true })), 'otp');
  assert.equal(classify(page({ totpSetup: true })), 'totp-setup');
  assert.equal(classify(page()), 'unknown');
});

test('picks the authenticator app, not the passkey or email code', () => {
  const options = [
    { index: 0, text: 'Passkey Use your passkey' },
    { index: 1, text: 'Email code' },
    { index: 2, text: 'Authenticator Application Enter a verification code from authenticator application.' },
  ];
  assert.equal(authenticatorOption(options).index, 2);
  assert.equal(authenticatorOption(options.slice(0, 2)), undefined);
});

test('picks our OTP device by label when there are several', () => {
  const choices = [
    { value: 'a', label: 'Oppo Reno 16' },
    { value: 'b', label: 'PMS Dashboard (LAPTOP-1)' },
  ];
  assert.equal(otpChoice(choices, 'PMS Dashboard (LAPTOP-1)'), 'b');
  assert.equal(otpChoice(choices, 'PMS Dashboard (OTHER)'), null);
  assert.equal(otpChoice([{ value: 'x', label: 'Phone' }], 'PMS Dashboard (LAPTOP-1)'), 'x');
  assert.equal(otpChoice([], 'anything'), null);
});

test('reads the OTP policy from the manual setup page', () => {
  assert.deepEqual(otpPolicy('Type: Time-based Algorithm: SHA256 Digits: 8 Interval: 60'), {
    algorithm: 'SHA256',
    digits: 8,
    period: 60,
  });
  assert.deepEqual(otpPolicy('Algorithm: HmacSHA1 Digits: 6 Interval: 30'), { algorithm: 'SHA1', digits: 6, period: 30 });
  assert.deepEqual(otpPolicy('Scan the QR code'), { algorithm: 'SHA1', digits: 6, period: 30 });
});
