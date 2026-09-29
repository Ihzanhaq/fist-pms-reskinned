// Talks to the PMS like a browser would: session cookie in, HTML out.
import { PMS_BASE } from './config.js';
import { getCookie, silentLogin } from './session.js';

export class SessionExpiredError extends Error {
  constructor() {
    super('PMS session expired');
    this.name = 'SessionExpiredError';
  }
}

export class PmsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PmsError';
  }
}

export function isLoginRedirect(status, location) {
  if (status < 300 || status >= 400 || !location) return false;
  return (
    location.includes('/oauth2/authorization') ||
    location.includes('auth.fistinnovations.com') ||
    /^(https:\/\/pms\.fistinnovations\.com)?\/login\b/.test(location)
  );
}

async function request(path, init = {}, canRetry = true) {
  const cookie = getCookie();
  if (!cookie) throw new SessionExpiredError();

  const res = await fetch(PMS_BASE + path, {
    ...init,
    redirect: 'manual',
    headers: { ...init.headers, Cookie: `JSESSIONID=${cookie}` },
  });
  if (isLoginRedirect(res.status, res.headers.get('location'))) {
    // PMS sessions idle out; the saved Keycloak session can usually renew them.
    // Only GETs are retried: a POST carries a CSRF token tied to the old session.
    const isGet = !init.method || init.method === 'GET';
    if (isGet && canRetry && (await silentLogin())) return request(path, init, false);
    throw new SessionExpiredError();
  }
  return res;
}

export async function get(path) {
  const res = await request(path);
  if (res.status !== 200) throw new PmsError(`PMS returned ${res.status} for ${path}`);
  return res.text();
}

// For binary responses (attachments). Caller streams the body.
export async function getRaw(path) {
  const res = await request(path);
  if (res.status !== 200) throw new PmsError(`PMS returned ${res.status} for ${path}`);
  return res;
}

// PMS forms answer a successful POST with a redirect; returns its Location.
async function post(path, body, headers) {
  const res = await request(path, { method: 'POST', headers, body });
  if (res.status !== 302 && res.status !== 303) {
    throw new PmsError(`PMS rejected the change (HTTP ${res.status})`);
  }
  return res.headers.get('location') ?? '';
}

export function postForm(path, fields) {
  return post(path, new URLSearchParams(fields).toString(), {
    'Content-Type': 'application/x-www-form-urlencoded',
  });
}

export function postMultipart(path, formData) {
  return post(path, formData); // fetch sets the multipart boundary header
}
