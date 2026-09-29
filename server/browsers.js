// Chromium browsers the PMS login can open. Playwright drives any of them
// through its executable, so we only need to find where each is installed.
import fs from 'node:fs';
import path from 'node:path';
import { BROWSER_CHANNEL, DATA_DIR, PROFILE_DIR } from './config.js';

const env = (name) => process.env[name] ?? '';
const win = (...parts) => path.join(...parts);

const CANDIDATES = {
  win32: {
    msedge: [
      win(env('ProgramFiles(x86)'), 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      win(env('ProgramFiles'), 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ],
    chrome: [
      win(env('ProgramFiles'), 'Google', 'Chrome', 'Application', 'chrome.exe'),
      win(env('ProgramFiles(x86)'), 'Google', 'Chrome', 'Application', 'chrome.exe'),
      win(env('LOCALAPPDATA'), 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ],
    brave: [
      win(env('ProgramFiles'), 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      win(env('ProgramFiles(x86)'), 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      win(env('LOCALAPPDATA'), 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    ],
  },
  darwin: {
    msedge: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    chrome: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    brave: ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'],
  },
  linux: {
    msedge: ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable'],
    chrome: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'],
    brave: ['/usr/bin/brave-browser', '/usr/bin/brave'],
  },
};

export const BROWSER_NAMES = { msedge: 'Microsoft Edge', chrome: 'Google Chrome', brave: 'Brave' };

const CHOICE_FILE = path.join(DATA_DIR, 'browser.json');

export function findExecutable(id) {
  const paths = CANDIDATES[process.platform]?.[id] ?? [];
  return paths.find((p) => p && fs.existsSync(p)) ?? null;
}

export function installedBrowsers() {
  return Object.keys(BROWSER_NAMES)
    .filter((id) => findExecutable(id))
    .map((id) => ({ id, name: BROWSER_NAMES[id] }));
}

// Each browser keeps its own profile: profiles are not portable between them.
// The original default browser keeps the original folder so existing logins survive.
export const profileDir = (id) => (id === BROWSER_CHANNEL ? PROFILE_DIR : `${PROFILE_DIR}-${id}`);

// The browser used last, so silent re-logins reuse the profile that is signed in.
export function chosenBrowser() {
  try {
    const { id } = JSON.parse(fs.readFileSync(CHOICE_FILE, 'utf8'));
    if (findExecutable(id)) return id;
  } catch {}
  return findExecutable(BROWSER_CHANNEL) ? BROWSER_CHANNEL : (installedBrowsers()[0]?.id ?? null);
}

export function saveChoice(id) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CHOICE_FILE, JSON.stringify({ id }));
}
