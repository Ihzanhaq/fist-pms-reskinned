// PMS servlet sessions usually expire after idle time. Light traffic resets that clock.
import * as session from './session.js';
import { sessionInfo } from './service.js';

const DEFAULT_MS = 8 * 60_000;

export function startSessionKeepalive(ms = Number(process.env.PMS_KEEPALIVE_MS) || DEFAULT_MS) {
  const timer = setInterval(() => {
    if (!session.getCookie()) return;
    sessionInfo().catch(() => {});
  }, ms);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}
