// Holds the PMS session cookie. Login happens in a real browser window
// (Playwright) so the app never sees the user's password.
import fs from 'node:fs';
import { chromium } from 'playwright';
import { COOKIE_FILE, DATA_DIR, PMS_BASE, PROFILE_DIR } from './config.js';

const LOGIN_TIMEOUT_MS = 5 * 60_000;
const SILENT_TIMEOUT_MS = 20_000;

let cookie;
let loginInFlight = null;

export function getCookie() {
  if (cookie === undefined) {
    try {
      cookie = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8')).jsessionid ?? null;
    } catch {
      cookie = null;
    }
  }
  return cookie;
}

function saveCookie(value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(COOKIE_FILE, JSON.stringify({ jsessionid: value }));
  cookie = value;
}

export function clearCookie() {
  fs.rmSync(COOKIE_FILE, { force: true });
  cookie = null;
}

// The Edge profile can only be opened by one browser at a time, so logins are
// exclusive; callers asking for the same kind of login share the one in flight.
function exclusive(kind, run) {
  if (loginInFlight) {
    return loginInFlight.kind === kind ? loginInFlight.promise : Promise.reject(new Error('A login is already in progress'));
  }
  const promise = run().finally(() => {
    loginInFlight = null;
  });
  loginInFlight = { kind, promise };
  return promise;
}

// Visible Edge window where the user signs in.
export async function login() {
  if (loginInFlight?.kind === 'silent') await loginInFlight.promise.catch(() => {});
  return exclusive('window', () => signIn({ visible: true }));
}

// Hidden Edge that reuses the Keycloak session saved in the profile.
// Resolves to false when Keycloak wants a password (or a window login is running).
export async function silentLogin() {
  if (loginInFlight?.kind === 'window') return false;
  return exclusive('silent', () => signIn({ visible: false })).then(
    () => true,
    () => false,
  );
}

const isBackOnPms = (url) =>
  url.origin === PMS_BASE && !url.pathname.startsWith('/login') && !url.pathname.startsWith('/oauth2');

async function signIn({ visible }) {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge', // the Microsoft Edge installed on Windows
    headless: !visible,
    viewport: null,
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(PMS_BASE, { timeout: SILENT_TIMEOUT_MS });
    if (visible) {
      await page.bringToFront();
      await page.waitForURL(isBackOnPms, { timeout: LOGIN_TIMEOUT_MS });
    } else if (!isBackOnPms(new URL(page.url()))) {
      throw new Error('Keycloak needs the user to sign in');
    }

    const session = (await context.cookies(PMS_BASE)).find((c) => c.name === 'JSESSIONID');
    if (!session) throw new Error('Signed in, but the PMS did not set a session cookie');
    saveCookie(session.value);
  } catch (err) {
    if (/closed/i.test(err.message)) throw new Error('The login window was closed before signing in');
    if (err.name === 'TimeoutError') throw new Error('Timed out waiting for sign-in');
    throw err;
  } finally {
    await context.close().catch(() => {});
  }
}
