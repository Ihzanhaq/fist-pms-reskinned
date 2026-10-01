// Whether filters are remembered in this browser (Settings → Preferences).
const FLAG = 'pms-dashboard:remember-filters';
export const FILTER_STORE = 'pms-dashboard:filters:v1';
// Filter state kept outside the URL (see useFilterState).
export const FILTER_KEY_PREFIX = 'pms-dashboard:filter:';

export function rememberFilters() {
  try {
    return localStorage.getItem(FLAG) !== '0';
  } catch {
    return false;
  }
}

export function clearSavedFilters() {
  try {
    localStorage.removeItem(FILTER_STORE);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(FILTER_KEY_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // storage blocked: nothing saved anyway
  }
}

export function setRememberFilters(on) {
  try {
    localStorage.setItem(FLAG, on ? '1' : '0');
  } catch {
    // storage blocked
  }
  if (!on) clearSavedFilters();
}

export function hasSavedFilters() {
  try {
    return (
      localStorage.getItem(FILTER_STORE) !== null ||
      Object.keys(localStorage).some((key) => key.startsWith(FILTER_KEY_PREFIX))
    );
  } catch {
    return false;
  }
}
