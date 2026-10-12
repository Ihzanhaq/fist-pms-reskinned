// Team leaderboard.
// Date ranges are counted from the PMS activity log. The PMS has its own
// /leaderboard page, but its "completed" count depends on each project's status
// setup: it credits some reviewer sign-offs (Resolved -> Closed) to the period they
// were closed in, long after the work was done, and misses others. So it is not used.
// "All time" is counted from every project's issue list, by assignee, like the
// PMS project dashboard.
import { parseActivity, parseProjectIssues } from './parse.js';
import * as pms from './pms-client.js';
import { shiftIso, todayIso } from './insights.js';
import { BadRequestError, listProjects, requireUuid } from './service.js';

// Finished statuses. All time also shows how many of those are Closed (signed off).
const COMPLETED = /^(done|resolved|completed|feedback)$/i;
const CLOSED = /^closed$/i;
// Rejected and cancelled issues are neither finished work nor open work.
const DROPPED = /^(rejected|cancell?ed)$/i;
const isFinished = (status) => COMPLETED.test(status ?? '') || CLOSED.test(status ?? '');

const MAX_PAGES = 150;
const CACHE_MS = 5 * 60_000;
const LIFETIME_CACHE_MS = 10 * 60_000;
const PROJECT_CONCURRENCY = 4;

export const PERIODS = ['today', 'week', 'month', '30d', 'custom', 'alltime'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function periodRange(period, today = todayIso()) {
  const [y, m, d] = today.split('-').map(Number);
  if (period === 'week') {
    const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday = 0
    return { from: shiftIso(today, -weekday), to: today };
  }
  if (period === 'today') return { from: today, to: today };
  if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (period === '30d') return { from: shiftIso(today, -29), to: today };
  throw new BadRequestError('bad_request', 'Invalid period');
}

export function resolveLeaderboardRange({ period = 'week', from, to, today = todayIso() } = {}) {
  if (!PERIODS.includes(period) || period === 'alltime') throw new BadRequestError('bad_request', 'Invalid period');
  if (period === 'custom') {
    if (!ISO_DATE.test(from ?? '') || !ISO_DATE.test(to ?? '')) {
      throw new BadRequestError('bad_request', 'Custom range needs from and to dates (YYYY-MM-DD)');
    }
    if (from > to) throw new BadRequestError('bad_request', 'Start date must be on or before end date');
    const cappedTo = to > today ? today : to;
    return { period, from, to: cappedTo };
  }
  const range = periodRange(period, today);
  return { period, ...range };
}

// Equal scores share a rank (1, 2, 2, 4 …). same(a, b) says whether two rows tie.
const rank = (rows, same) => {
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    row.rank = prev && same(prev, row) ? prev.rank : i + 1;
  });
  return rows;
};

// entries: activity entries of every type; actors: [{ id, name }] from the activity filter.
// issues: Map issue id -> { status, assignee } with each issue's current state.
// An issue counts once, for its assignee, in the period it moved from an unfinished
// to a finished status (Closed included); issues reopened since are not counted.
// Updates, comments and status changes are credited to whoever made them, and
// cover every activity type, as on the PMS leaderboard.
export function rankPeople(entries, actors = [], issues = new Map()) {
  const idByName = new Map(actors.map((a) => [a.name, a.id]));
  const people = new Map();
  const person = (name, id = null) => {
    if (!people.has(name)) {
      people.set(name, {
        name,
        id: idByName.get(name) ?? id,
        completed: 0,
        created: new Set(),
        comments: 0,
        statusChanges: 0,
        updates: 0,
        projects: new Set(),
        days: new Set(),
      });
    }
    return people.get(name);
  };

  const counted = new Set();
  for (const e of entries) {
    if (!e.who) continue;
    const p = person(e.who);
    p.updates += 1;
    p.days.add(e.date);
    if (e.project?.name) p.projects.add(e.project.name);
    if (e.kind === 'comment') p.comments += 1;
    const key = e.issue?.key;
    if (!key) continue;
    if (e.kind === 'created') p.created.add(key);
    if (e.kind !== 'status') continue;
    p.statusChanges += 1;
    const id = e.issue.id ?? key;
    // Finished -> finished (say Resolved -> Closed) is a sign-off of work finished earlier.
    if (!isFinished(e.toStatus) || isFinished(e.fromStatus) || counted.has(id)) continue;
    const now = issues.get(e.issue.id);
    if (now && !isFinished(now.status)) continue; // reopened since
    counted.add(id);
    const owner = now?.assignee ? person(now.assignee.name, now.assignee.id) : p;
    owner.completed += 1;
    if (e.project?.name) owner.projects.add(e.project.name);
  }

  const rows = [...people.values()].map((p) => ({
    id: p.id,
    name: p.name,
    completed: p.completed,
    created: p.created.size,
    comments: p.comments,
    statusChanges: p.statusChanges,
    updates: p.updates,
    projects: p.projects.size,
    activeDays: p.days.size,
  }));

  rows.sort((a, b) => b.completed - a.completed || b.updates - a.updates || a.name.localeCompare(b.name));
  return rank(rows, (x, y) => x.completed === y.completed && x.updates === y.updates);
}

// Lifetime totals per assignee from project issue lists (like the PMS project dashboard).
// projects: [{ id, name, issues }] where issues come from parseProjectIssues.
export function rankLifetime(projects) {
  const people = new Map();
  for (const project of projects) {
    for (const issue of project.issues) {
      const a = issue.assignee;
      if (!a?.name) continue;
      if (!people.has(a.name)) people.set(a.name, { id: null, name: a.name, completed: 0, closed: 0, open: 0, projects: new Set() });
      const p = people.get(a.name);
      p.id ??= a.id;
      const status = issue.status?.name ?? '';
      if (DROPPED.test(status)) continue;
      p.projects.add(project.id);
      if (isFinished(status)) {
        p.completed += 1;
        if (CLOSED.test(status)) p.closed += 1;
      } else {
        p.open += 1;
      }
    }
  }
  const rows = [...people.values()]
    .map((p) => ({ ...p, projects: p.projects.size }))
    .filter((p) => p.completed + p.open > 0);
  rows.sort((a, b) => b.completed - a.completed || b.closed - a.closed || a.open - b.open || a.name.localeCompare(b.name));
  return rank(rows, (x, y) => x.completed === y.completed && x.closed === y.closed);
}

// ---------- fetching ----------

const projectCache = new Map(); // projectId -> { at, issues }

async function projectIssueList(projectId, maxAge = CACHE_MS) {
  const hit = projectCache.get(projectId);
  if (hit && Date.now() - hit.at < maxAge) return hit.issues;
  const { issues } = parseProjectIssues(await pms.get(`/projects/${projectId}?view=list`));
  projectCache.set(projectId, { at: Date.now(), issues });
  return issues;
}

async function eachLimited(items, limit, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

const cache = new Map(); // key -> { at, value }

async function periodLeaderboard({ period, projectId, from, to, refresh }) {
  const range = resolveLeaderboardRange({ period, from, to });
  const { from: rangeFrom, to: rangeTo } = range;
  const key = `${range.period}|${projectId ?? ''}|${rangeFrom}|${rangeTo}`;
  const hit = cache.get(key);
  if (!refresh && hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const today = todayIso();
  const entries = [];
  let actors = [];
  let truncated = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const project = projectId ? `&project=${projectId}` : '';
    const parsed = parseActivity(
      await pms.get(`/activity?type=all&from=${rangeFrom}&to=${rangeTo}${project}&page=${page}`),
      today,
    );
    if (page === 0) actors = parsed.actors;
    entries.push(...parsed.entries);
    if (!parsed.hasNextPage) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  // Current status and assignee of every finished issue, one request per project.
  const projectIds = [
    ...new Set(entries.filter((e) => e.kind === 'status' && isFinished(e.toStatus)).map((e) => e.project?.id)),
  ].filter(Boolean);
  const issues = new Map();
  await eachLimited(projectIds, PROJECT_CONCURRENCY, async (id) => {
    const list = await projectIssueList(id, refresh ? 0 : CACHE_MS).catch(() => []);
    for (const issue of list) issues.set(issue.id, { status: issue.status?.name, assignee: issue.assignee });
  });

  const people = rankPeople(entries, actors, issues);
  const value = {
    status: 'ready',
    period: range.period,
    from: rangeFrom,
    to: rangeTo,
    projectId,
    generatedAt: new Date().toISOString(),
    truncated,
    totals: {
      completed: people.reduce((s, p) => s + p.completed, 0),
      people: people.filter((p) => p.updates > 0 || p.completed > 0).length,
      updates: entries.length,
    },
    people,
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}

// All time runs in the background: the first call starts it and every call
// returns its progress until the result is ready.
const lifetimeJobs = new Map(); // key -> { done, total, error, promise }
const lifetimeCache = new Map(); // key -> { at, value }

function startLifetimeJob(key, projectId) {
  const job = { done: 0, total: 0, error: null };
  lifetimeJobs.set(key, job);
  job.promise = (async () => {
    const projects = projectId ? [{ id: projectId }] : await listProjects();
    job.total = projects.length;
    const lists = [];
    await eachLimited(projects, PROJECT_CONCURRENCY, async (project) => {
      lists.push({ id: project.id, issues: await projectIssueList(project.id, 0) });
      job.done += 1;
    });
    const people = rankLifetime(lists);
    const value = {
      status: 'ready',
      period: 'alltime',
      to: todayIso(),
      projectId,
      generatedAt: new Date().toISOString(),
      truncated: false,
      totals: {
        completed: people.reduce((s, p) => s + p.completed, 0),
        closed: people.reduce((s, p) => s + p.closed, 0),
        open: people.reduce((s, p) => s + p.open, 0),
        people: people.length,
        projects: lists.length,
      },
      people,
    };
    lifetimeCache.set(key, { at: Date.now(), value });
    lifetimeJobs.delete(key);
  })().catch((err) => {
    job.error = err;
  });
  return job;
}

function lifetimeLeaderboard({ projectId, refresh }) {
  const key = projectId ?? '';
  let job = lifetimeJobs.get(key);
  if (job?.error) {
    lifetimeJobs.delete(key);
    throw job.error;
  }
  const hit = lifetimeCache.get(key);
  if (!job && hit && !refresh && Date.now() - hit.at < LIFETIME_CACHE_MS) return hit.value;
  job ??= startLifetimeJob(key, projectId);
  return { status: 'running', period: 'alltime', projectId, progress: { done: job.done, total: job.total } };
}

export async function leaderboard({ period = 'week', projectId = null, from, to, refresh = false } = {}) {
  if (projectId) requireUuid(projectId, 'project id');
  if (!PERIODS.includes(period)) throw new BadRequestError('bad_request', 'Invalid period');
  if (period === 'alltime') return lifetimeLeaderboard({ projectId, refresh });
  return periodLeaderboard({ period, projectId, from, to, refresh });
}
