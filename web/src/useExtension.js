import { useEffect, useSyncExternalStore } from 'react';
import { api, errorMessage } from './api.js';

// Which Claude extension version is installed vs. available, shared by the banner and the
// Connect to Claude page. Installing hands the file to Claude Desktop, then watches for the
// new version to appear (the user still confirms in Claude's dialog).
const WATCH_MS = 3000;
const WATCH_FOR_MS = 3 * 60_000;

let state = { status: null, checked: false, installing: false, waiting: false, error: null };
const listeners = new Set();
const set = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

let loading = null;
async function refresh() {
  loading ??= api
    .extensionStatus()
    .then((status) => set({ status }))
    .catch(() => {}) // optional: without it the page falls back to the full setup guide
    .finally(() => {
      if (!state.checked) set({ checked: true });
      loading = null;
    });
  return loading;
}

let watchTimer = null;
async function install() {
  set({ installing: true, error: null });
  try {
    await api.installExtension();
  } catch (err) {
    set({ installing: false, error: errorMessage(err) });
    return;
  }
  set({ installing: false, waiting: true });
  clearInterval(watchTimer);
  const start = Date.now();
  watchTimer = setInterval(async () => {
    await refresh();
    const s = state.status;
    const done = s?.installed && s.installed === s.latest;
    if (done || Date.now() - start > WATCH_FOR_MS) {
      clearInterval(watchTimer);
      set({ waiting: false });
    }
  }, WATCH_MS);
}

export function useExtension() {
  const snap = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
  useEffect(() => {
    if (!state.status) refresh();
  }, []);
  return { ...snap, install, refresh };
}
