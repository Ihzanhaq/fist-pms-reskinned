// Holds the PMS session cookie. Login happens in a real browser window
// (Playwright); the app only sees the password when the user sets up
// automatic sign-in (auto-login.js).
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import os from 'node:os';
import { chromium } from 'playwright-core';
import * as autoLogin from './auto-login.js';
import { AutoLoginError, classify, completeTotpSetup, driveLogin, fillPassword, snapshot } from './keycloak.js';
import { verifyUser } from './windows-hello.js';
import { COOKIE_FILE, DATA_DIR, HRMS_BASE, PMS_BASE, SSO_COOKIE_FILE } from './config.js';
import { BROWSER_NAMES, chosenBrowser, findExecutable, profileDir, saveChoice } from './browsers.js';
import { CHROMIUM_WINDOW_ARGS, focusBrowserWindow, keepBrowserOnTop } from './browser-window.js';

const LOGIN_TIMEOUT_MS = 5 * 60_000;
const SILENT_TIMEOUT_MS = 20_000;
// Where PMS sends signed-out visitors before handing them to Keycloak.
const PMS_SIGN_IN_PATH = '/oauth2/authorization/keycloak';

let loginInFlight = null;

// Work the user did not ask for (keepalive pings) must not pop up Windows Hello.
const background = new AsyncLocalStorage();
export const runInBackground = (fn) => background.run(true, fn);

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
  // With automatic sign-in set up, try it first; the window only if that fails.
  const sameBrowser = browser === undefined || browser === chosenBrowser();
  if (sameBrowser && autoLogin.isActive() && (await silentLogin())) return;
  return exclusive('window', async () => {
    const id = browser ?? chosenBrowser();
    await signIn({ visible: true, browser: id });
    saveChoice(id);
  });
}

// Hidden browser that reuses the Keycloak session saved in the profile, then the
// saved automatic sign-in (Windows Hello first, never for background work).
// Resolves to false when Keycloak wants the user (or a window login is running).
export async function silentLogin() {
  if (loginInFlight?.kind === 'window') return false;
  const interactive = !background.getStore();
  return exclusive('silent', () => signIn({ visible: false, browser: chosenBrowser(), interactive })).then(
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
    // The saved FISSO login idles out long before the PMS one. Sign in right
    // here when automatic sign-in is set up; otherwise the user signs in.
    const onHrms = (u) => u.origin === HRMS_BASE;
    if (!onHrms(new URL(page.url())) && autoLogin.isActive()) {
      await signInInWindow(page, onHrms).catch(() => {});
    }
    // Leave the window open until the user closes it.
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}

// The saved automatic sign-in, after Windows Hello when the user asked for it.
async function unlockSavedLogin(interactive) {
  if (!autoLogin.isActive()) return null;
  if (autoLogin.status().askHello) {
    if (!interactive) return null;
    if (!(await verifyUser('Sign in to FIST PMS'))) return null;
  }
  return autoLogin.load();
}

// Automatic sign-in inside a visible window, which then stays usable for passkeys.
async function signInInWindow(page, isDone) {
  const saved = await unlockSavedLogin(true);
  if (!saved) return;
  const allowPasskeys = await blockPasskeyDialogs(page);
  try {
    await autoSignIn(page, saved, isDone);
    saveSsoCookies(await page.context().cookies());
  } finally {
    await allowPasskeys();
  }
}

async function autoSignIn(page, saved, isDone = isBackOnPms) {
  try {
    await driveLogin(page, saved, isDone);
  } catch (err) {
    // A wrong password or a removed authenticator fails every time: stop trying until the user fixes it.
    if (err instanceof AutoLoginError && err.code !== 'unknown_page') autoLogin.pause(err.message);
    throw err;
  }
}

// Passkey pages start a passkey request on load. In the hidden browser that would
// open a Windows passkey dialog, so requests go to an empty virtual authenticator list.
async function blockPasskeyDialogs(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable', { enableUI: false }).catch(() => {});
  return () => cdp.send('WebAuthn.disable').catch(() => {});
}

async function savePmsSession(context) {
  const session = (await context.cookies(PMS_BASE)).find((c) => c.name === 'JSESSIONID');
  if (!session) throw new Error('Signed in, but the PMS did not set a session cookie');
  saveCookie(session.value);
  saveSsoCookies(await context.cookies());
}

async function openProfile(id, visible) {
  const browserLabel = BROWSER_NAMES[id] ?? 'a browser';
  const executablePath = id && findExecutable(id);
  if (!executablePath) throw new Error(`Could not find ${browserLabel} on this computer.`);
  const profile = profileDir(id);
  fs.mkdirSync(profile, { recursive: true });
  try {
    return await chromium.launchPersistentContext(profile, {
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
}

function loginErrorMessage(err) {
  if (/closed/i.test(err.message)) return new Error('The login window was closed before signing in');
  if (err.name === 'TimeoutError') return new Error('Timed out waiting for sign-in');
  return err;
}

export const autoLoginLabel = () => `PMS Dashboard (${os.hostname()})`;

/**
 * Sets up automatic sign-in: the login window signs in with the given password
 * (the user confirms the passkey), then registers this computer as an
 * authenticator app in FISSO and saves both, encrypted.
 */
export async function setupAutoLogin({ username, password }) {
  if (!autoLogin.supported) throw new Error('Automatic sign-in works on Windows only.');
  if (loginInFlight?.kind === 'silent') await loginInFlight.promise.catch(() => {});
  return exclusive('window', async () => {
    const id = chosenBrowser();
    const context = await openProfile(id, true);
    const label = autoLoginLabel();
    try {
      const page = context.pages()[0] ?? (await context.newPage());
      // Ask Keycloak to show "set up authenticator application" as part of this
      // sign-in. Playwright cannot touch requests that follow a redirect, so the
      // window starts at PMS's own sign-in URL and its redirect is rewritten.
      await context.route(`${PMS_BASE}${PMS_SIGN_IN_PATH}`, async (route) => {
        const response = await route.fetch({ maxRedirects: 0 });
        const location = response.headers().location;
        if (!location?.includes('/protocol/openid-connect/auth')) return route.fulfill({ response });
        const url = new URL(location);
        url.searchParams.set('kc_action', 'CONFIGURE_TOTP');
        return route.fulfill({ response, headers: { ...response.headers(), location: url.href } });
      });
      // Without this, a still-valid PMS session would skip Keycloak entirely.
      await context.clearCookies({ domain: 'pms.fistinnovations.com' });
      await page.goto(PMS_BASE + PMS_SIGN_IN_PATH, { timeout: SILENT_TIMEOUT_MS });

      const stopFocus = keepBrowserOnTop(context.browser(), page);
      const deadline = Date.now() + LOGIN_TIMEOUT_MS;
      let passwordSent = false;
      let otp = null;
      try {
        while (!otp || !isBackOnPms(new URL(page.url()))) {
          if (Date.now() > deadline) throw Object.assign(new Error('timeout'), { name: 'TimeoutError' });
          if (page.isClosed()) throw new Error('closed');
          const snap = await snapshot(page).catch(() => null); // null while a page is loading
          const step = snap && classify(snap);
          if (step === 'password') {
            if (passwordSent) throw new AutoLoginError('bad_password', snap.error || 'FISSO did not accept that password.');
            await fillPassword(page, { username, password }, snap);
            passwordSent = true;
          } else if (step === 'totp-setup' && !otp) {
            otp = await completeTotpSetup(page, label);
          } else if (snap && !otp && isBackOnPms(new URL(snap.url))) {
            throw new Error('FISSO signed in without showing the authenticator setup. Try again.');
          } else {
            await page.waitForTimeout(400);
          }
        }
      } finally {
        clearInterval(stopFocus);
      }
      await savePmsSession(context);
      await autoLogin.save({ username, password, otp, label });
      saveChoice(id);
    } catch (err) {
      throw loginErrorMessage(err);
    } finally {
      await context.close().catch(() => {});
    }
  });
}

async function signIn({ visible, browser: id, interactive = false }) {
  const context = await openProfile(id, visible);
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    const chromiumBrowser = context.browser();
    if (!visible) await blockPasskeyDialogs(page);
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
      const saved = await unlockSavedLogin(interactive);
      if (!saved) throw new Error('Keycloak needs the user to sign in');
      await autoSignIn(page, saved);
    }
    await savePmsSession(context);
  } catch (err) {
    throw loginErrorMessage(err);
  } finally {
    await context.close().catch(() => {});
  }
}
