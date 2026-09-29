import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLoginRedirect } from '../pms-client.js';

test('redirects to Keycloak count as an expired session', () => {
  assert.equal(isLoginRedirect(302, 'https://pms.fistinnovations.com/oauth2/authorization/keycloak'), true);
  assert.equal(isLoginRedirect(302, 'https://auth.fistinnovations.com/realms/x/protocol/openid-connect/auth'), true);
  assert.equal(isLoginRedirect(302, '/login'), true);
});

test('normal redirects and responses do not', () => {
  assert.equal(isLoginRedirect(302, '/my-issues'), false);
  assert.equal(isLoginRedirect(302, 'https://pms.fistinnovations.com/issues/abc'), false);
  assert.equal(isLoginRedirect(200, null), false);
});
