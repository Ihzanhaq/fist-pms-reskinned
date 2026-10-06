import { api } from './api.js';

/** Ask the dashboard server to open PMS in Chromium with the saved session. */
export function openInPms(path = '/', onError) {
  return api.openPms(path).catch((err) => {
    onError?.(err);
  });
}

/** Open HRMS in Chromium using the saved FISSO browser profile. */
export function openInHrms(path = '/', onError) {
  return api.openHrms(path).catch((err) => {
    onError?.(err);
  });
}
