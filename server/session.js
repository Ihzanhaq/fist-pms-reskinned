// Holds the PMS session cookie. Login happens in a real browser window
// (Playwright) so the app never sees the user's password.
import fs from 'node:fs';
import { chromium } from 'playwright';
import { COOKIE_FILE, DATA_DIR, PMS_BASE, PROFILE_DIR } from './config.js';

const LOGIN_TIMEOUT_MS = 5 * 60_000;

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

// Only one login window at a time; concurrent callers share it.
export function login() {
  loginInFlight ??= openLoginWindow().finally(() => {
    loginInFlight = null;
  });
  return loginInFlight;
}

const isBackOnPms = (url) =>
  url.origin === PMS_BASE && !url.pathname.startsWith('/login') && !url.pathname.startsWith('/oauth2');

async function openLoginWindow() {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: null,
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(PMS_BASE);
    await page.bringToFront();
    await page.waitForURL(isBackOnPms, { timeout: LOGIN_TIMEOUT_MS });

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
