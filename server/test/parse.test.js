import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseMyIssues, parseIssuePage, parseUserName, LayoutChangedError } from '../parse.js';

const fixture = (name) => fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const UNRELATED = '<html><body><h1>Welcome</h1><p>Nothing here</p></body></html>';

test('parseMyIssues reads every field of a row', () => {
  const { issues } = parseMyIssues(fixture('my-issues.html'));
  assert.equal(issues.length, 2);
  assert.deepEqual(issues[0], {
    id: '11111111-1111-4111-8111-111111111111',
    key: 'DEMO-12',
    title: 'Fix login & signup flow',
    projectId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    projectName: 'DEMO',
    status: { name: 'In Progress', color: '#2563EB' },
    priority: 'urgent',
    targetDate: '11 Sep 2026',
    overdue: true,
  });
});

test('parseMyIssues handles missing target date', () => {
  const { issues } = parseMyIssues(fixture('my-issues.html'));
  assert.equal(issues[1].targetDate, null);
  assert.equal(issues[1].overdue, false);
  assert.equal(issues[1].priority, 'low');
  assert.equal(issues[1].projectName, 'Shop Site');
  assert.equal(issues[1].title, 'Update product images');
});

test('parseMyIssues defaults priority to none when no pill', () => {
  const { issues } = parseMyIssues(fixture('my-issues-last.html'));
  assert.equal(issues[0].priority, 'none');
  assert.equal(issues[0].targetDate, '29 Sep 2026');
});

test('parseMyIssues detects next page', () => {
  assert.equal(parseMyIssues(fixture('my-issues.html')).hasNextPage, true);
  assert.equal(parseMyIssues(fixture('my-issues-last.html')).hasNextPage, false);
});

test('parseIssuePage reads csrf from the state form and the states', () => {
  const page = parseIssuePage(fixture('issue.html'));
  assert.equal(page.csrf, 'state-token-abc');
  assert.deepEqual(page.states, [
    { id: 'aaaa0001-0000-4000-8000-000000000001', name: 'Todo', selected: false },
    { id: 'aaaa0002-0000-4000-8000-000000000002', name: 'In Progress', selected: true },
    { id: 'aaaa0003-0000-4000-8000-000000000003', name: 'Done', selected: false },
  ]);
});

test('parseUserName reads the account name', () => {
  assert.equal(parseUserName(fixture('my-issues.html')), 'Jane Tester');
});

test('parsers throw LayoutChangedError on unrecognised pages', () => {
  assert.throws(() => parseMyIssues(UNRELATED), LayoutChangedError);
  assert.throws(() => parseIssuePage(UNRELATED), LayoutChangedError);
  assert.throws(() => parseUserName(UNRELATED), LayoutChangedError);
});
