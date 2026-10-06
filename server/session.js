// Holds the PMS session cookie. Login happens in a real browser window
// (Playwright) so the app never sees the user's password.
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { COOKIE_FILE, DATA_DIR, HRMS_BASE, PMS_BASE, SSO_COOKIE_FILE } from './config.js';
import { BROWSER_NAMES, chosenBrowser, findExecutable, profileDir, saveChoice } from './browsers.js';
import { CHROMIUM_WINDOW_ARGS, focusBrowserWindow, keepBrowserOnTop } from './browser-window.js';

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

/** Store a rotated JSESSIONID when PMS sends Set-Cookie on a response. */
export function renewCookieFromResponse(res) {
  const lines =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [];
  if (!lines.length) {
    const single = res.headers.get('set-cookie');
    if (single) lines.push(single);
  }
  for (const line of lines) {
    const match = line.match(/\bJSESSIONID=([^;]+)/i);
    if (match) saveCookie(match[1]);
  }
}

export function clearCookie() {
  fs.rmSync(COOKIE_FILE, { force: true });
  fs.rmSync(SSO_COOKIE_FILE, { force: true });
}

// Keycloak keeps its login in browser-session cookies, which Chromium drops
// when the login window closes. Keep a copy so HRMS can reuse the SSO login.
const isSsoCookie = (c) => {
  const domain = c.domain.replace(/^\./, '');
  return /(^|\.)fistinnovations\.com$/.test(domain) && domain !== 'pms.fistinnovations.com';
};

function saveSsoCookies(cookies) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SSO_COOKIE_FILE, JSON.stringify(cookies.filter(isSsoCookie)), { mode: 0o600 });
}

function getSsoCookies() {
  try {
    return JSON.parse(fs.readFileSync(SSO_COOKIE_FILE, 'utf8'));
  } catch {
    return [];
  }
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

const pmsCookie = (value) => ({
  name: 'JSESSIONID',
  value,
  domain: 'pms.fistinnovations.com',
  path: '/',
  secure: true,
  httpOnly: true,
  sameSite: 'Lax',
});

// Opens PMS in the user's Chromium browser using the saved session cookie.
// Uses a one-off browser window so it does not fight the login profile lock.
export async function openBrowser(path = '/') {
  let jsessionid = getCookie();
  if (!jsessionid) throw new Error('Not signed in to PMS');

  if (loginInFlight?.kind === 'window') {
    throw new Error('Finish signing in in the login window first.');
  }

  const id = chosenBrowser();
  const executablePath = id && findExecutable(id);
  if (!executablePath) throw new Error('No Chromium browser found on this computer.');

  const browser = await chromium.launch({
    executablePath,
    headless: false,
    args: CHROMIUM_WINDOW_ARGS,
  });
  try {
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    const url = PMS_BASE + (path.startsWith('/') ? path : `/${path}`);

    const go = async (cookie) => {
      await context.clearCookies();
      await context.addCookies([pmsCookie(cookie)]);
      await page.goto(url, { timeout: 45_000, waitUntil: 'domcontentloaded' });
    };

    await go(jsessionid);
    if (!isBackOnPms(new URL(page.url()))) {
      if (loginInFlight?.kind === 'window' || !(await silentLogin())) {
        throw new Error('Session expired — sign in again from the dashboard.');
      }
      jsessionid = getCookie();
      if (!jsessionid) throw new Error('Session expired — sign in again from the dashboard.');
      await go(jsessionid);
      if (!isBackOnPms(new URL(page.url()))) {
        throw new Error('Session expired — sign in again from the dashboard.');
      }
    }

    await focusBrowserWindow(browser, page);
    // Leave the window open until the user closes it.
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}

// HRMS shares FISSO with PMS. Open it in a one-off window seeded with the SSO
// cookies saved at login, so Keycloak signs the user in without a password.
export async function openHrmsBrowser(path = '/') {
  if (!getCookie()) throw new Error('Not signed in to PMS');

  if (loginInFlight?.kind === 'window') {
    throw new Error('Finish signing in in the login window first.');
  }

  const id = chosenBrowser();
  const executablePath = id && findExecutable(id);
  if (!executablePath) throw new Error('No Chromium browser found on this computer.');

  const browser = await chromium.launch({
    executablePath,
    headless: false,
    args: CHROMIUM_WINDOW_ARGS,
  });
  try {
    const context = await browser.newContext({ viewport: null });
    const sso = getSsoCookies();
    if (sso.length) await context.addCookies(sso);
    const page = await context.newPage();
    const url = HRMS_BASE + (path.startsWith('/') ? path : `/${path}`);
    await page.goto(url, { timeout: 45_000, waitUntil: 'domcontentloaded' });
    await focusBrowserWindow(browser, page);
    // Leave the window open until the user closes it.
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}

async function signIn({ visible, browser: id }) {
  const browserLabel = BROWSER_NAMES[id] ?? 'a browser';
  const executablePath = id && findExecutable(id);
  if (!executablePath) throw new Error(`Could not find ${browserLabel} on this computer.`);
  const profile = profileDir(id);
  fs.mkdirSync(profile, { recursive: true });
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath,
      headless: !visible,
      viewport: null,
      args: CHROMIUM_WINDOW_ARGS,
    });
  } catch (err) {
    if (/ProcessSingleton|in use|lock/i.test(err.message)) {
      throw new Error('The PMS login window is already open in another app (dashboard or Claude). Finish signing in there.');
    }
    throw new Error(`Could not open ${browserLabel} for the PMS login. Is it installed? (${err.message.split('\n')[0]})`);
  }
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    const chromiumBrowser = context.browser();
    await page.goto(PMS_BASE, { timeout: SILENT_TIMEOUT_MS });
    if (visible) {
      const stopFocus = keepBrowserOnTop(chromiumBrowser, page);
      try {
        await focusBrowserWindow(chromiumBrowser, page);
        await page.waitForURL(isBackOnPms, { timeout: LOGIN_TIMEOUT_MS });
      } finally {
        clearInterval(stopFocus);
      }
    } else if (!isBackOnPms(new URL(page.url()))) {
      throw new Error('Keycloak needs the user to sign in');
    }

    const session = (await context.cookies(PMS_BASE)).find((c) => c.name === 'JSESSIONID');
    if (!session) throw new Error('Signed in, but the PMS did not set a session cookie');
    saveCookie(session.value);
    saveSsoCookies(await context.cookies());
  } catch (err) {
    if (/closed/i.test(err.message)) throw new Error('The login window was closed before signing in');
    if (err.name === 'TimeoutError') throw new Error('Timed out waiting for sign-in');
    throw err;
  } finally {
    await context.close().catch(() => {});
  }
}
