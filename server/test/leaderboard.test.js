import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodRange, rankLifetime, rankPeople, resolveLeaderboardRange } from '../leaderboard.js';

const status = (who, key, to, date = '2026-09-29', project = 'Demo') => ({
  who,
  date,
  kind: 'status',
  toStatus: to,
  issue: { key, id: key },
  project: { name: project },
});

test('resolveLeaderboardRange checks custom dates; all time is not a date range', () => {
  assert.throws(() => resolveLeaderboardRange({ period: 'alltime' }));
  assert.deepEqual(resolveLeaderboardRange({ period: 'custom', from: '2026-09-01', to: '2026-09-15' }), {
    period: 'custom',
    from: '2026-09-01',
    to: '2026-09-15',
  });
  assert.throws(() => resolveLeaderboardRange({ period: 'custom', from: '2026-09-20', to: '2026-09-01' }));
  assert.throws(() => resolveLeaderboardRange({ period: 'custom', from: 'bad', to: '2026-09-01' }));
});

test('periodRange covers this week, this month and the last 30 days', () => {
  assert.deepEqual(periodRange('week', '2026-09-30'), { from: '2026-09-28', to: '2026-09-30' }); // Wed -> Mon
  assert.deepEqual(periodRange('week', '2026-09-28'), { from: '2026-09-28', to: '2026-09-28' });
  assert.deepEqual(periodRange('week', '2026-10-04'), { from: '2026-09-28', to: '2026-10-04' }); // Sunday
  assert.deepEqual(periodRange('today', '2026-09-30'), { from: '2026-09-30', to: '2026-09-30' });
  assert.deepEqual(periodRange('month', '2026-09-30'), { from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual(periodRange('30d', '2026-10-12'), { from: '2026-09-13', to: '2026-10-12' }); // as the PMS shows it
  assert.throws(() => periodRange('year', '2026-09-30'));
});

test('rankPeople counts like the PMS leaderboard: each finished issue once, Closed included', () => {
  const entries = [
    status('Asha', 'A-1', 'Resolved'),
    status('Asha', 'A-1', 'Done'), // same issue again: still one
    status('Asha', 'A-2', 'Completed', '2026-09-28', 'Shop'),
    status('Asha', 'A-3', 'In Progress'),
    { who: 'Asha', date: '2026-09-28', kind: 'created', issue: { key: 'A-9' }, project: { name: 'Demo' } },
    { who: 'Asha', date: '2026-09-28', kind: 'comment', type: 'comment', issue: { key: 'A-3' }, project: { name: 'Demo' } },
    status('Ravi', 'A-1', 'Closed'), // reviewer closing Asha's work: already counted
    status('Ravi', 'B-1', 'Closed'),
    { who: 'Mia', date: '2026-09-29', kind: 'other', type: 'project', issue: null, project: { name: 'Demo' } },
  ];
  const rows = rankPeople(entries, [{ id: 'id-asha', name: 'Asha' }]);
  assert.deepEqual(rows.map((r) => [r.rank, r.name, r.completed]), [
    [1, 'Asha', 2],
    [2, 'Ravi', 1],
    [3, 'Mia', 0],
  ]);
  assert.deepEqual(rows[0], {
    rank: 1, id: 'id-asha', name: 'Asha',
    completed: 2, created: 1, comments: 1, statusChanges: 4, updates: 6, projects: 2, activeDays: 2,
  });
  assert.equal(rows[1].id, null);
  assert.equal(rows[2].updates, 1); // project activity counts as an update, like on the PMS
});

test('rankPeople ranks by completed, then updates; full ties share a rank', () => {
  const rows = rankPeople([
    status('A', 'X-1', 'Done'),
    status('B', 'X-2', 'Done'),
    status('C', 'X-3', 'Done'),
    status('C', 'X-4', 'Done'),
    status('D', 'X-5', 'Done'),
    status('D', 'X-6', 'Todo'),
  ]);
  assert.deepEqual(rows.map((r) => [r.name, r.rank]), [['C', 1], ['D', 2], ['A', 3], ['B', 3]]);
});

test('rankPeople counts Feedback as completed', () => {
  const rows = rankPeople([status('A', 'X-1', 'Feedback')]);
  assert.equal(rows[0].completed, 1);
});

test('rankPeople credits finished work to the assignee and skips reopened issues', () => {
  const issues = new Map([
    ['A-1', { status: 'Resolved', assignee: { id: 'id-asha', name: 'Asha' } }],
    ['A-2', { status: 'In Progress', assignee: { id: 'id-asha', name: 'Asha' } }], // reopened
    ['A-3', { status: 'Closed', assignee: { id: 'id-asha', name: 'Asha' } }],
  ]);
  const rows = rankPeople(
    [
      status('Ravi', 'A-1', 'Resolved'), // Ravi resolved Asha's issue
      status('Asha', 'A-2', 'Done'),
      status('Ravi', 'A-3', 'Closed'),
      status('Ravi', 'Z-9', 'Done'), // not in the index: stays with Ravi
    ],
    [],
    issues,
  );
  const by = Object.fromEntries(rows.map((r) => [r.name, r.completed]));
  assert.deepEqual(by, { Asha: 2, Ravi: 1 });
  assert.equal(rows.find((r) => r.name === 'Asha').id, 'id-asha');
});

test('rankLifetime counts by assignee like the PMS project dashboard', () => {
  const issue = (status, name, id = null) => ({ status: { name: status }, assignee: name ? { id, name } : null });
  const rows = rankLifetime([
    {
      id: 'p1',
      issues: [
        issue('Resolved', 'Vector'),
        issue('Closed', 'Vector', 'id-v'),
        issue('Rejected', 'Vector'),
        issue('New', 'Vector'),
        issue('Done', 'Athul'),
        issue('New', null),
      ],
    },
    { id: 'p2', issues: [issue('In Progress', 'Athul'), issue('Cancelled', 'Mia')] },
  ]);
  assert.deepEqual(rows.map((r) => [r.rank, r.name, r.completed, r.closed, r.open, r.projects]), [
    [1, 'Vector', 2, 1, 1, 1],
    [2, 'Athul', 1, 0, 1, 2],
  ]);
  assert.equal(rows[0].id, 'id-v');
});

test('rankPeople credits work in the period it was finished, not when a reviewer signs it off later', () => {
  const move = (who, key, from, to, date = '2026-09-29') => ({ ...status(who, key, to, date), fromStatus: from });
  const rows = rankPeople([
    move('Ravi', 'A-1', 'Done', 'Closed'), // finished before the period, only closed now: not counted
    move('Ravi', 'A-2', 'Resolved', 'Closed'), // same
    move('Ravi', 'A-3', 'Resolved', 'Closed'), // closed now …
    move('Asha', 'A-3', 'In Progress', 'Resolved', '2026-09-28'), // … but also finished in the period: counted once
    move('Asha', 'A-4', 'New', 'Done'),
    move('Asha', 'A-5', 'Done', 'Cancelled'), // cancelled is not finished
  ]);
  const by = Object.fromEntries(rows.map((r) => [r.name, r.completed]));
  assert.deepEqual(by, { Asha: 2, Ravi: 0 });
});
