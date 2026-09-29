// Team leaderboard from the PMS activity log (everyone's actions in a period).
import { parseActivity } from './parse.js';
import * as pms from './pms-client.js';
import { shiftIso, todayIso } from './insights.js';
import { BadRequestError, requireUuid } from './service.js';

// "Completed" is the person who finished the work; "Closed" is usually a
// reviewer signing it off, so the two are counted separately.
const COMPLETED = /^(done|resolved|completed)$/i;
const CLOSED = /^closed$/i;
const STARTED = /progress/i;

const PAGE_SIZE = 40;
const MAX_PAGES = 150;
const CACHE_MS = 5 * 60_000;

export const PERIODS = ['week', 'month', '30d'];

export function periodRange(period, today = todayIso()) {
  const [y, m, d] = today.split('-').map(Number);
  if (period === 'week') {
    const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday = 0
    return { from: shiftIso(today, -weekday), to: today };
  }
  if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (period === '30d') return { from: shiftIso(today, -29), to: today };
  throw new BadRequestError('bad_request', 'Invalid period');
}

// entries: parsed activity entries; actors: [{ id, name }] from the activity filter.
export function rankPeople(entries, actors = []) {
  const idByName = new Map(actors.map((a) => [a.name, a.id]));
  const people = new Map();
  const person = (name) => {
    if (!people.has(name)) {
      people.set(name, {
        name,
        id: idByName.get(name) ?? null,
        completed: new Set(),
        closed: new Set(),
        started: new Set(),
        created: new Set(),
        projects: new Set(),
        days: new Set(),
        updates: 0,
      });
    }
    return people.get(name);
  };

  for (const e of entries) {
    if (!e.who) continue;
    const p = person(e.who);
    p.updates += 1;
    p.days.add(e.date);
    if (e.project?.name) p.projects.add(e.project.name);
    const key = e.issue?.key;
    if (!key) continue;
    if (e.kind === 'created') p.created.add(key);
    if (e.kind === 'status') {
      if (COMPLETED.test(e.toStatus ?? '')) p.completed.add(key);
      else if (CLOSED.test(e.toStatus ?? '')) p.closed.add(key);
      else if (STARTED.test(e.toStatus ?? '')) p.started.add(key);
    }
  }

  const rows = [...people.values()].map((p) => ({
    id: p.id,
    name: p.name,
    completed: p.completed.size,
    closed: p.closed.size,
    started: p.started.size,
    created: p.created.size,
    updates: p.updates,
    projects: p.projects.size,
    activeDays: p.days.size,
  }));

  rows.sort(
    (a, b) =>
      b.completed - a.completed || b.closed - a.closed || b.updates - a.updates || a.name.localeCompare(b.name),
  );

  // Equal completed + closed share a rank (1, 2, 2, 4 …).
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    row.rank = prev && prev.completed === row.completed && prev.closed === row.closed ? prev.rank : i + 1;
  });
  return rows;
}

const cache = new Map(); // key -> { at, value }

export async function leaderboard({ period = 'week', projectId = null } = {}) {
  if (!PERIODS.includes(period)) throw new BadRequestError('bad_request', 'Invalid period');
  if (projectId) requireUuid(projectId, 'project id');
  const { from, to } = periodRange(period);
  const key = `${period}|${projectId ?? ''}|${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const today = todayIso();
  const entries = [];
  let actors = [];
  let truncated = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const project = projectId ? `&project=${projectId}` : '';
    const parsed = parseActivity(await pms.get(`/activity?type=issue&from=${from}&to=${to}${project}&page=${page}`), today);
    if (page === 0) actors = parsed.actors;
    entries.push(...parsed.entries);
    if (parsed.entries.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  const people = rankPeople(entries, actors);
  const value = {
    period,
    from,
    to,
    projectId,
    generatedAt: new Date().toISOString(),
    truncated,
    totals: {
      completed: people.reduce((s, p) => s + p.completed, 0),
      closed: people.reduce((s, p) => s + p.closed, 0),
      people: people.filter((p) => p.updates > 0).length,
      updates: entries.length,
    },
    people,
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}
