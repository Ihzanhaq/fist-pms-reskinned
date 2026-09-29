import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, isDoneStatus, listDateToIso, shiftIso, summarize, todayIso } from '../insights.js';

const issue = (key, status, extra = {}) => ({
  id: `${key}-id`,
  key,
  title: `Title of ${key}`,
  projectName: extra.projectName ?? 'Demo',
  status: { name: status, color: '#123456' },
  priority: 'high',
  targetDate: extra.targetDate ?? null,
  overdue: extra.overdue ?? false,
});

const statusEvent = (date, key, to, time = '10:00') => ({
  date,
  time,
  kind: 'status',
  text: `changed status from New to ${to}`,
  fromStatus: 'New',
  toStatus: to,
  project: { id: 'p', name: 'Demo' },
  issue: { id: `${key}-id`, key },
});

test('date helpers', () => {
  assert.equal(todayIso(new Date(2026, 8, 5)), '2026-09-05');
  assert.equal(shiftIso('2026-10-01', -1), '2026-09-30');
  assert.equal(shiftIso('2026-12-31', 1), '2027-01-01');
  assert.equal(listDateToIso('05 Oct 2026'), '2026-10-05');
  assert.equal(listDateToIso(null), null);
  assert.ok(isDoneStatus('Resolved') && isDoneStatus(' closed ') && isDoneStatus('Completed') && isDoneStatus('Done'));
  assert.ok(!isDoneStatus('In Progress') && !isDoneStatus('Cancelled'));
});

test('summarize counts pending, completions per day and today', () => {
  const today = '2026-09-29';
  const active = [
    issue('A-1', 'New', { overdue: true, targetDate: '20 Sep 2026' }),
    issue('A-2', 'In Progress', { targetDate: '29 Sep 2026' }),
    issue('B-1', 'New', { projectName: 'Other' }),
    issue('A-5', 'Closed'), // done status in the active list: not pending
  ];
  const completed = [issue('A-3', 'Resolved'), issue('A-4', 'Closed')];
  const activity = [
    statusEvent(today, 'A-3', 'Resolved', '09:00'),
    statusEvent(today, 'A-3', 'Closed', '11:00'), // same issue twice -> counted once
    statusEvent(today, 'A-2', 'In Progress'), // not a completion
    { date: today, time: '12:00', kind: 'comment', text: 'commented', issue: { id: 'x', key: 'A-2' }, project: null },
    statusEvent('2026-09-27', 'A-4', 'Closed'),
    statusEvent('2026-09-10', 'A-9', 'Done'), // outside the 7-day window's days but still an event
  ];

  const s = summarize({ active, completed, activity, today, days: 7 });
  assert.equal(s.pending.total, 3);
  assert.equal(s.pending.overdue, 1);
  assert.equal(s.pending.dueToday, 1);
  assert.deepEqual(s.pending.byStatus.map((x) => [x.name, x.count]), [['New', 2], ['In Progress', 1]]);
  assert.deepEqual(s.pending.byProject, [{ name: 'Demo', count: 2 }, { name: 'Other', count: 1 }]);
  assert.equal(s.completed.total, 2);
  assert.equal(s.completed.today, 1);
  assert.deepEqual(s.completed.todayIssues, [
    { key: 'A-3', id: 'A-3-id', title: 'Title of A-3', project: 'Demo', status: 'Resolved' },
  ]);
  assert.equal(s.actionsToday, 4);
  assert.equal(s.daily.length, 7);
  assert.deepEqual(s.daily[0], { date: '2026-09-23', completed: 0, actions: 0 });
  assert.deepEqual(s.daily.at(-3), { date: '2026-09-27', completed: 1, actions: 1 });
  assert.deepEqual(s.daily.at(-1), { date: today, completed: 1, actions: 4 });
});

test('buildReport groups a day by issue in time order', () => {
  const entries = [
    statusEvent('2026-09-29', 'A-1', 'Resolved', '16:00'),
    { date: '2026-09-29', time: '09:00', kind: 'created', text: 'created this issue', issue: { id: 'a1', key: 'A-1' }, project: { name: 'Demo' } },
    { date: '2026-09-29', time: '12:00', kind: 'comment', text: 'commented', issue: { id: 'b2', key: 'B-2' }, project: { name: 'Other' } },
  ];
  const r = buildReport({ date: '2026-09-29', entries, titles: new Map([['A-1', 'Login page']]) });
  assert.deepEqual(r.summary, { actions: 3, issues: 2, completed: 1, created: 1, statusChanges: 1, comments: 1 });
  assert.equal(r.groups[0].issue.key, 'A-1');
  assert.equal(r.groups[0].issue.title, 'Login page');
  assert.equal(r.groups[0].completed, true);
  assert.deepEqual(r.groups[0].entries.map((e) => e.time), ['09:00', '16:00']);
  assert.equal(r.groups[1].issue.title, null);
  assert.equal(r.groups[1].completed, false);
});
