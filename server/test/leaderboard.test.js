import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { leaderboardPath } from '../leaderboard.js';
import { LayoutChangedError, parseLeaderboard } from '../parse.js';

const html = fs.readFileSync(new URL('./fixtures/leaderboard.html', import.meta.url), 'utf8');

test('leaderboardPath asks the PMS for its own periods', () => {
  assert.equal(leaderboardPath('week'), '/leaderboard?period=week&project=all');
  assert.equal(leaderboardPath('30d'), '/leaderboard?period=30d&project=all');
  assert.equal(leaderboardPath('alltime', 'abc'), '/leaderboard?period=all&project=abc');
});

test('parseLeaderboard reads stats, podium and table as the PMS shows them', () => {
  const lb = parseLeaderboard(html);
  assert.equal(lb.subtitle, 'Top performers · 1 Oct – 19 Oct');
  assert.deepEqual(lb.stats.at(-1), { value: '#2', label: 'your rank · 3 more to pass Asha', isRank: true });
  assert.equal(lb.stats[0].isRank, false);
  assert.deepEqual(lb.podium[1], {
    rank: 2,
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Ben Kurian',
    completed: 3,
    comments: 1,
    updates: 9,
    meta: '1 comment · 9 updates',
  });
  assert.deepEqual(lb.rows[0], {
    rank: 3,
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Cara Das',
    completed: 3,
    created: 5,
    comments: 0,
    statusChanges: 4,
    updates: 10,
    activeDays: 3,
  });
  assert.equal(lb.rows[1].name, 'Dev Nair'); // no photo
  assert.equal(lb.rows[1].id, null);
  assert.match(lb.note, /^Completed counts/);
});

test('parseLeaderboard flags a changed layout', () => {
  assert.throws(() => parseLeaderboard('<main><p>Nothing here</p></main>'), LayoutChangedError);
});
