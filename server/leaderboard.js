// Team leaderboard, read straight from the PMS /leaderboard page so both show
// the same numbers. The PMS offers this week, this month, the last 30 days and
// all time, for every project or one.
import { parseLeaderboard } from './parse.js';
import * as pms from './pms-client.js';
import { BadRequestError, requireUuid } from './service.js';

export const PERIODS = ['week', 'month', '30d', 'alltime'];
const PMS_PERIOD = { week: 'week', month: 'month', '30d': '30d', alltime: 'all' };

const CACHE_MS = 2 * 60_000;
const cache = new Map(); // key -> { at, value }

export function leaderboardPath(period, projectId) {
  return `/leaderboard?period=${PMS_PERIOD[period]}&project=${projectId ?? 'all'}`;
}

export async function leaderboard({ period = 'week', projectId = null, refresh = false } = {}) {
  if (projectId) requireUuid(projectId, 'project id');
  if (!PERIODS.includes(period)) throw new BadRequestError('bad_request', 'Invalid period');

  const key = `${period}|${projectId ?? ''}`;
  const hit = cache.get(key);
  if (!refresh && hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const page = parseLeaderboard(await pms.get(leaderboardPath(period, projectId)));
  const value = {
    status: 'ready',
    period,
    projectId,
    generatedAt: new Date().toISOString(),
    ...page,
    people: [...page.podium, ...page.rows],
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}
