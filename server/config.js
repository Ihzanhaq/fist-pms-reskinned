import os from 'node:os';
import path from 'node:path';

export const PMS_BASE = 'https://pms.fistinnovations.com';
export const PORT = Number(process.env.PORT) || 3000;
export const HOST = '127.0.0.1';

export const ROOT_DIR = path.resolve(import.meta.dirname, '..');
export const WEB_DIST_DIR = path.join(ROOT_DIR, 'web', 'dist');

// Login data lives in the user's home folder so the dashboard and the Claude
// extension share one PMS login. PMS_DATA_DIR overrides it.
export const DATA_DIR = process.env.PMS_DATA_DIR || path.join(os.homedir(), '.fist-pms-dashboard');
export const COOKIE_FILE = path.join(DATA_DIR, 'cookie.json');
export const PROFILE_DIR = path.join(DATA_DIR, 'browser-profile');

// Use the browser that is already installed instead of downloading one.
export const BROWSER_CHANNEL = process.platform === 'win32' ? 'msedge' : 'chrome';
