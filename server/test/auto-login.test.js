import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PMS_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pms-auto-login-'));
const autoLogin = await import('../auto-login.js');
const { AUTO_LOGIN_FILE } = await import('../config.js');

const LOGIN = {
  username: 'someone',
  password: 'pässword "quoted"',
  otp: { secret: 'abcDEF123', algorithm: 'SHA1', digits: 6, period: 30 },
  label: 'PMS Dashboard (TEST)',
};

test('saves encrypted, reads back, and shows no secrets in status', { skip: !autoLogin.supported }, async () => {
  autoLogin.remove();
  assert.deepEqual(autoLogin.status(), { supported: true, enabled: false });

  await autoLogin.save(LOGIN);
  const raw = fs.readFileSync(AUTO_LOGIN_FILE, 'utf8');
  assert.ok(!raw.includes('pässword') && !raw.includes('abcDEF123'), 'secrets stored in plain text');

  const status = autoLogin.status();
  assert.equal(status.enabled, true);
  assert.equal(status.username, 'someone');
  assert.equal(status.askHello, true);
  assert.ok(!JSON.stringify(status).includes('pässword'));

  const loaded = await autoLogin.load();
  assert.equal(loaded.password, LOGIN.password);
  assert.deepEqual(loaded.otp, LOGIN.otp);
});

test('pausing, new password and Windows Hello switch', { skip: !autoLogin.supported }, async () => {
  await autoLogin.save(LOGIN);
  autoLogin.pause('FISSO did not accept the saved password.');
  assert.equal(autoLogin.isActive(), false);
  assert.equal(autoLogin.status().pausedReason, 'FISSO did not accept the saved password.');

  await autoLogin.updatePassword('new one');
  assert.equal(autoLogin.isActive(), true);
  assert.equal((await autoLogin.load()).password, 'new one');
  assert.deepEqual((await autoLogin.load()).otp, LOGIN.otp);

  autoLogin.setAskHello(false);
  assert.equal(autoLogin.status().askHello, false);
  await autoLogin.save(LOGIN);
  assert.equal(autoLogin.status().askHello, false, 'set-up again keeps the Hello choice');

  autoLogin.remove();
  assert.equal(autoLogin.isActive(), false);
});
