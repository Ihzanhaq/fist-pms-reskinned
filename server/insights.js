// Dashboard numbers and the daily report, built from the user's issues and
// their own entries in the PMS activity feed.
import { parseActivity } from './parse.js';
import * as pms from './pms-client.js';
import { PmsError, SessionExpiredError } from './pms-client.js';
import { BadRequestError, listMyIssues, sessionInfo } from './service.js';

const DONE_STATUS = /^(done|resolved|closed|completed)$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVITY_PAGE_SIZE = 40;
const MAX_ACTIVITY_PAGES = 30;
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const pad = (n) => String(n).padStart(2, '0');
export const isDoneStatus = (name) => DONE_STATUS.test(String(name ?? '').trim());

// The PMS shows "Today" in local time, so work in local dates.
export function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function shiftIso(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

// "05 Oct 2026" (issue list format) -> "2026-10-05"
export function listDateToIso(text) {
  const m = String(text ?? '').match(/(\d{1,2})\s+([a-z]{3})[a-z]*\s+(\d{4})/i);
  return m && MONTHS[m[2].toLowerCase()] ? `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(m[1])}` : null;
}

// ---------- the user's own activity ----------

let actorCache = null; // { userName, id }

async function myActorId() {
  const { loggedIn, userName } = await sessionInfo();
  if (!loggedIn) throw new SessionExpiredError();
  if (actorCache?.userName === userName) return actorCache.id;
  const { actors } = parseActivity(await pms.get('/activity?type=all&page=0'), todayIso());
  const me = actors.find((a) => a.name === userName);
  if (!me) throw new PmsError('Could not find you in the PMS activity filter');
  actorCache = { userName, id: me.id };
  return me.id;
}

export async function myActivity(from, to) {
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) throw new BadRequestError('bad_request', 'Invalid date');
  const actor = await myActorId();
  const today = todayIso();
  const entries = [];
  for (let page = 0; page < MAX_ACTIVITY_PAGES; page++) {
    const html = await pms.get(`/activity?actor=${actor}&type=all&from=${from}&to=${to}&page=${page}`);
    const batch = parseActivity(html, today).entries;
    entries.push(...batch);
    if (batch.length < ACTIVITY_PAGE_SIZE) break;
  }
  return entries;
}

// ---------- pure summaries (tested without the PMS) ----------

const countBy = (items, keyOf) => {
  const counts = new Map();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

export function summarize({ active: activeScope, completed, activity, today, days }) {
  // The PMS "active" list can still hold issues in a done status (e.g. Closed); those are not pending.
  const active = activeScope.filter((i) => !isDoneStatus(i.status.name));
  const from = shiftIso(today, -(days - 1));
  const completions = activity.filter((e) => e.kind === 'status' && isDoneStatus(e.toStatus) && e.issue);
  const uniqueIssues = (list) => new Set(list.map((e) => e.issue.key)).size;

  const statusColor = new Map(active.map((i) => [i.status.name, i.status.color]));
  const byStatus = [...countBy(active, (i) => i.status.name)]
    .map(([name, count]) => ({ name, color: statusColor.get(name) ?? null, count }))
    .sort((a, b) => b.count - a.count);
  const byProject = [...countBy(active, (i) => i.projectName)]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const daily = [];
  for (let date = from; date <= today; date = shiftIso(date, 1)) {
    const onDay = activity.filter((e) => e.date === date);
    daily.push({ date, completed: uniqueIssues(onDay.filter((e) => completions.includes(e))), actions: onDay.length });
  }

  const titles = new Map([...active, ...completed].map((i) => [i.key, i.title]));
  const completedTodayKeys = [...new Set(completions.filter((e) => e.date === today).map((e) => e.issue.key))];

  return {
    today,
    pending: {
      total: active.length,
      overdue: active.filter((i) => i.overdue).length,
      dueToday: active.filter((i) => listDateToIso(i.targetDate) === today).length,
      byStatus,
      byProject,
      // Overdue first, then soonest target date, undated last.
      upcoming: [...active]
        .sort(
          (a, b) =>
            Number(b.overdue) - Number(a.overdue) ||
            (listDateToIso(a.targetDate) ?? '9999').localeCompare(listDateToIso(b.targetDate) ?? '9999'),
        )
        .slice(0, 5)
        .map((i) => ({
          id: i.id,
          key: i.key,
          title: i.title,
          project: i.projectName,
          status: i.status,
          targetDate: listDateToIso(i.targetDate),
          overdue: i.overdue,
        })),
    },
    completed: {
      total: completed.length,
      today: completedTodayKeys.length,
      inPeriod: uniqueIssues(completions),
      todayIssues: completedTodayKeys.map((key) => {
        const event = completions.find((e) => e.date === today && e.issue.key === key);
        return { key, id: event.issue.id, title: titles.get(key) ?? null, project: event.project?.name ?? null, status: event.toStatus };
      }),
    },
    actionsToday: activity.filter((e) => e.date === today).length,
    days,
    daily,
  };
}

export function buildReport({ date, entries, titles }) {
  // The feed is newest first; reverse before a stable sort so same-minute entries stay in order.
  const sorted = [...entries].reverse().sort((a, b) => a.time.localeCompare(b.time));
  const groups = new Map();
  for (const e of sorted) {
    const key = e.issue?.key ?? `other:${e.project?.name ?? ''}`;
    if (!groups.has(key)) {
      groups.set(key, {
        issue: e.issue ? { ...e.issue, title: titles.get(e.issue.key) ?? null } : null,
        project: e.project?.name ?? null,
        entries: [],
      });
    }
    groups.get(key).entries.push({ time: e.time, kind: e.kind, text: e.text, fromStatus: e.fromStatus, toStatus: e.toStatus });
  }
  const completedKeys = new Set(sorted.filter((e) => e.kind === 'status' && isDoneStatus(e.toStatus) && e.issue).map((e) => e.issue.key));
  const count = (kind) => sorted.filter((e) => e.kind === kind).length;

  return {
    date,
    summary: {
      actions: sorted.length,
      issues: [...groups.values()].filter((g) => g.issue).length,
      completed: completedKeys.size,
      created: count('created'),
      statusChanges: count('status'),
      comments: count('comment'),
    },
    groups: [...groups.values()].map((g) => ({
      ...g,
      completed: Boolean(g.issue && completedKeys.has(g.issue.key)),
    })),
  };
}

// ---------- endpoints ----------

export async function dashboard(days = 14) {
  const span = Math.min(Math.max(Number(days) || 14, 7), 60);
  const today = todayIso();
  const [active, completed, activity] = await Promise.all([
    listMyIssues('active'),
    listMyIssues('completed'),
    myActivity(shiftIso(today, -(span - 1)), today),
  ]);
  return summarize({ active, completed, activity, today, days: span });
}

export async function dailyReport(date = todayIso()) {
  if (!ISO_DATE.test(date)) throw new BadRequestError('bad_request', 'Invalid date');
  const [entries, issues] = await Promise.all([myActivity(date, date), listMyIssues('all')]);
  const titles = new Map(issues.map((i) => [i.key, i.title]));
  return buildReport({ date, entries: entries.filter((e) => e.date === date), titles });
}
