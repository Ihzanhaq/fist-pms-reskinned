import path from 'node:path';

export const PMS_BASE = 'https://pms.fistinnovations.com';
export const PORT = 3000;
export const HOST = '127.0.0.1';

export const ROOT_DIR = path.resolve(import.meta.dirname, '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const COOKIE_FILE = path.join(DATA_DIR, 'cookie.json');
export const PROFILE_DIR = path.join(DATA_DIR, 'browser-profile');
export const WEB_DIST_DIR = path.join(ROOT_DIR, 'web', 'dist');
