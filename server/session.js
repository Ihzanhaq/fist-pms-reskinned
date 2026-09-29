// Holds the PMS session cookie. Login happens in a real browser window
// (Playwright) so the app never sees the user's password.
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { COOKIE_FILE, DATA_DIR, PMS_BASE } from './config.js';
import { BROWSER_NAMES, chosenBrowser, findExecutable, profileDir, saveChoice } from './browsers.js';

const LOGIN_TIMEOUT_MS = 5 * 60_000;
const SILENT_TIMEOUT_MS = 20_000;

let loginInFlight = null;

// Read from disk every time: the dashboard and the Claude extension are
// separate processes and either one may renew the session.
export function getCookie() {
  try {
    return JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8')).jsessionid ?? null;
  } catch {
    return null;
  }
}

function saveCookie(value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(COOKIE_FILE, JSON.stringify({ jsessionid: value }), { mode: 0o600 });
}

export function clearCookie() {
  fs.rmSync(COOKIE_FILE, { force: true });
}

// A browser profile can only be opened by one browser at a time, so logins are
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

// Visible browser window where the user signs in. `browser` is an id from
// browsers.js; without one the last-used browser opens.
export async function login(browser) {
  if (loginInFlight?.kind === 'silent') await loginInFlight.promise.catch(() => {});
  return exclusive('window', async () => {
    const id = browser ?? chosenBrowser();
    await signIn({ visible: true, browser: id });
    saveChoice(id);
  });
}

// Hidden browser that reuses the Keycloak session saved in the profile.
// Resolves to false when Keycloak wants a password (or a window login is running).
export async function silentLogin() {
  if (loginInFlight?.kind === 'window') return false;
  return exclusive('silent', () => signIn({ visible: false, browser: chosenBrowser() })).then(
    () => true,
    () => false,
  );
}

const isBackOnPms = (url) =>
  url.origin === PMS_BASE && !url.pathname.startsWith('/login') && !url.pathname.startsWith('/oauth2');

async function signIn({ visible, browser: id }) {
  const browser = BROWSER_NAMES[id] ?? 'a browser';
  const executablePath = id && findExecutable(id);
  if (!executablePath) throw new Error(`Could not find ${browser} on this computer.`);
  const profile = profileDir(id);
  fs.mkdirSync(profile, { recursive: true });
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath,
      headless: !visible,
      viewport: null,
    });
  } catch (err) {
    if (/ProcessSingleton|in use|lock/i.test(err.message)) {
      throw new Error('The PMS login window is already open in another app (dashboard or Claude). Finish signing in there.');
    }
    throw new Error(`Could not open ${browser} for the PMS login. Is it installed? (${err.message.split('\n')[0]})`);
  }
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
