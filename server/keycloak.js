// Drives the FISSO (Keycloak) sign-in pages for automatic sign-in: password,
// then the authenticator-app code instead of the passkey.
import { msUntilNextCode, totp } from './totp.js';

const NAV_TIMEOUT_MS = 20_000;
const MAX_STEPS = 12;

export class AutoLoginError extends Error {
  /** @param {'bad_password'|'otp_rejected'|'unknown_page'} code */
  constructor(code, message) {
    super(message);
    this.name = 'AutoLoginError';
    this.code = code;
  }
}

// Runs in the page. Only reads what the steps below need.
function readPage() {
  const $ = (s) => document.querySelector(s);
  const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const labelFor = (input) => text(input.labels?.[0] ?? input.closest('label') ?? input.parentElement);
  const errorEl = $('#input-error, [id^="input-error"], .alert-error, .kc-feedback-text, .auth-error, [role="alert"]');
  return {
    url: location.href,
    loginForm: Boolean($('#kc-form-login')),
    username: Boolean($('#username')),
    password: Boolean($('#password')),
    tryAnotherWay: Boolean($('#kc-try-another-form')),
    passkey: Boolean($('#webauth, #kc-form-webauthn, [id*="webauthn"]')),
    selectCredential: [...document.querySelectorAll('#kc-select-credential-form [name="authenticationExecution"]')].map(
      (el, index) => ({ index, text: text(el.closest('button, label, .select-auth-box, div') ?? el) || el.value }),
    ),
    otp: Boolean($('#kc-otp-login-form') || $('input[name="otp"]')),
    otpChoices: [...document.querySelectorAll('input[name="selectedCredentialId"]')].map((el) => ({
      value: el.value,
      label: labelFor(el),
    })),
    totpSetup: Boolean($('input[name="totpSecret"]')),
    manualModeLink: $('#mode-manual')?.href ?? null,
    error: text(errorEl),
    body: text(document.body).slice(0, 4000),
  };
}

/** Which sign-in step a page snapshot shows. */
export function classify(snap) {
  if (snap.totpSetup) return 'totp-setup';
  if (snap.otp) return 'otp';
  if (snap.selectCredential.length) return 'select-credential';
  if (snap.loginForm && snap.password) return 'password';
  if (snap.loginForm && snap.username) return 'username';
  if (snap.tryAnotherWay || snap.passkey) return 'passkey';
  return 'unknown';
}

/** The "Authenticator Application" option on the choose-a-method page. */
export function authenticatorOption(options) {
  return options.find((o) => /authenticator|one[- ]time|otp/i.test(o.text) && !/passkey|security key|email/i.test(o.text));
}

/** The saved credential among several OTP devices: ours by label, or the only one. */
export function otpChoice(choices, label) {
  if (choices.length <= 1) return choices[0]?.value ?? null;
  return choices.find((c) => c.label.includes(label))?.value ?? null;
}

/** Reads the OTP policy Keycloak lists on its manual-entry setup page. */
export function otpPolicy(bodyText) {
  const algorithm = bodyText.match(/Algorithm:?\s*(?:Hmac)?(SHA-?(?:1|256|512))/i)?.[1]?.replace('-', '').toUpperCase();
  const digits = Number(bodyText.match(/Digits:?\s*(\d+)/i)?.[1]);
  const period = Number(bodyText.match(/Interval:?\s*(\d+)/i)?.[1]);
  return {
    algorithm: algorithm || 'SHA1',
    digits: digits >= 6 && digits <= 8 ? digits : 6,
    period: period > 0 ? period : 30,
  };
}

export async function snapshot(page) {
  return page.evaluate(readPage);
}

// Runs an action that submits a form and waits for the next page.
async function andWait(page, action) {
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS }), action()]);
}

const submitForm = (page, selector) =>
  andWait(page, () =>
    page.evaluate((s) => {
      const form = document.querySelector(s);
      if (form.requestSubmit) form.requestSubmit();
      else form.submit();
    }, selector),
  );

export async function fillPassword(page, { username, password }, snap) {
  if (snap.username) await page.fill('#username', username);
  await page.fill('#password', password);
  await submitForm(page, '#kc-form-login');
}

async function fillOtp(page, login, snap) {
  const choice = otpChoice(snap.otpChoices, login.label);
  if (snap.otpChoices.length > 1 && !choice) {
    throw new AutoLoginError('otp_rejected', `FISSO did not list the "${login.label}" authenticator. Set up automatic sign-in again.`);
  }
  // FISSO's theme first shows a "Choose how to sign in" screen and hides the code
  // form with script, so the form is filled in directly rather than typed into.
  const code = totp(login.otp.secret, login.otp);
  await andWait(page, () =>
    page.evaluate(
      ({ value, code }) => {
        const otp = document.querySelector('input[name="otp"]');
        const radio = [...document.querySelectorAll('input[name="selectedCredentialId"]')].find((r) => r.value === value);
        if (radio) radio.checked = true;
        otp.value = code;
        otp.form.submit();
      },
      { value: choice, code },
    ),
  );
}

/**
 * Signs in on the Keycloak pages until `isDone(url)` is true.
 * @param {import('playwright-core').Page} page
 */
export async function driveLogin(page, login, isDone) {
  let passwordSent = false;
  let otpSent = 0;
  for (let i = 0; i < MAX_STEPS; i++) {
    if (isDone(new URL(page.url()))) return;
    const snap = await snapshot(page);
    const step = classify(snap);
    if (step === 'password' || step === 'username') {
      if (passwordSent && step === 'password') {
        throw new AutoLoginError('bad_password', snap.error || 'FISSO did not accept the saved password.');
      }
      if (step === 'password') {
        await fillPassword(page, login, snap);
        passwordSent = true;
      } else {
        await page.fill('#username', login.username);
        await submitForm(page, '#kc-form-login');
      }
    } else if (step === 'passkey') {
      if (!snap.tryAnotherWay) throw new AutoLoginError('unknown_page', 'FISSO offered no way to sign in without the passkey.');
      await submitForm(page, '#kc-try-another-form');
    } else if (step === 'select-credential') {
      const option = authenticatorOption(snap.selectCredential);
      if (!option) throw new AutoLoginError('otp_rejected', 'FISSO did not offer the authenticator app for this account.');
      await andWait(page, () =>
        page.locator('#kc-select-credential-form [name="authenticationExecution"]').nth(option.index).click(),
      );
    } else if (step === 'otp') {
      if (otpSent >= 2) throw new AutoLoginError('otp_rejected', snap.error || 'FISSO rejected the authenticator code.');
      // A code can be rejected right at the edge of its 30 seconds: retry with the next one.
      if (otpSent === 1) await new Promise((r) => setTimeout(r, msUntilNextCode(login.otp.period) + 500));
      await fillOtp(page, login, snap);
      otpSent++;
    } else {
      throw new AutoLoginError('unknown_page', `Unexpected FISSO page: ${snap.url.split('?')[0]}`);
    }
  }
  throw new AutoLoginError('unknown_page', 'FISSO sign-in took too many steps.');
}

/**
 * On Keycloak's "set up authenticator application" page: read the secret,
 * register this computer and return the OTP settings to save.
 */
export async function completeTotpSetup(page, label) {
  let snap = await snapshot(page);
  if (snap.manualModeLink && !/Interval/i.test(snap.body)) {
    await page.goto(snap.manualModeLink, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    snap = await snapshot(page);
  }
  const secret = await page.inputValue('input[name="totpSecret"]');
  if (!secret) throw new AutoLoginError('unknown_page', 'Could not read the authenticator secret from FISSO.');
  const otp = { secret, ...otpPolicy(snap.body) };

  await page.fill('input[name="totp"]', totp(secret, otp));
  if (await page.locator('input[name="userLabel"]').count()) await page.fill('input[name="userLabel"]', label);
  // Keycloak offers to sign out other devices here; keep the user's other sessions.
  const logoutOthers = page.locator('input[name="logout-sessions"]');
  if (await logoutOthers.count()) await logoutOthers.uncheck();
  await submitForm(page, 'form:has(input[name="totpSecret"])');

  const after = await snapshot(page);
  if (after.totpSetup) throw new AutoLoginError('otp_rejected', after.error || 'FISSO rejected the authenticator code.');
  return otp;
}
