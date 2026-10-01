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
  assert.throws(() => periodRange('year', '2026-09-30'));
});

test('rankPeople counts each issue once per person and keeps closing separate', () => {
  const entries = [
    status('Asha', 'A-1', 'Resolved'),
    status('Asha', 'A-1', 'Done'), // same issue again: still one
    status('Asha', 'A-2', 'Completed', '2026-09-28', 'Shop'),
    status('Asha', 'A-3', 'In Progress'),
    { who: 'Asha', date: '2026-09-28', kind: 'created', issue: { key: 'A-9' }, project: { name: 'Demo' } },
    status('Ravi', 'A-1', 'Closed'), // reviewer closing Asha's work
    status('Ravi', 'A-2', 'Closed'),
    status('Ravi', 'B-1', 'Resolved'),
    { who: 'Mia', date: '2026-09-29', kind: 'other', issue: { key: 'A-5' }, project: null },
  ];
  const rows = rankPeople(entries, [{ id: 'id-asha', name: 'Asha' }]);
  assert.deepEqual(rows.map((r) => [r.rank, r.name, r.completed, r.closed]), [
    [1, 'Asha', 2, 0],
    [2, 'Ravi', 1, 2],
    [3, 'Mia', 0, 0],
  ]);
  const asha = rows[0];
  assert.equal(asha.id, 'id-asha');
  assert.equal(asha.started, 1);
  assert.equal(asha.created, 1);
  assert.equal(asha.updates, 5);
  assert.equal(asha.projects, 2);
  assert.equal(asha.activeDays, 2);
  assert.equal(rows[1].id, null);
});

test('rankPeople gives ties the same rank', () => {
  const rows = rankPeople([
    status('A', 'X-1', 'Done'),
    status('B', 'X-2', 'Done'),
    status('C', 'X-3', 'Done'),
    status('C', 'X-4', 'Done'),
  ]);
  assert.deepEqual(rows.map((r) => [r.name, r.rank]), [['C', 1], ['A', 2], ['B', 2]]);
});

test('rankPeople counts Feedback as completed', () => {
  const rows = rankPeople([status('A', 'X-1', 'Feedback')]);
  assert.equal(rows[0].completed, 1);
});

test('rankPeople credits completed work to the assignee and skips reopened issues', () => {
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
  const by = Object.fromEntries(rows.map((r) => [r.name, [r.completed, r.closed]]));
  assert.deepEqual(by, { Asha: [1, 0], Ravi: [1, 1] });
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
