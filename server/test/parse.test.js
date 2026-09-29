import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseMyIssues,
  parseIssuePage,
  parseUserName,
  parseIssueDetail,
  parseIssueForm,
  parseProjects,
  LayoutChangedError,
} from '../parse.js';

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

test('parseIssueDetail reads the whole issue page', () => {
  const d = parseIssueDetail(fixture('issue-detail.html'));
  assert.equal(d.key, 'DEMO-12');
  assert.equal(d.title, 'Fix login & signup flow');
  assert.match(d.descriptionHtml, /<strong>cannot<\/strong>/);
  assert.deepEqual(d.project, { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'DEMO' });
  assert.deepEqual(d.status, { name: 'In Progress', color: '#2563EB' });
  assert.equal(d.states.length, 2);
  assert.equal(d.priority, 'high');
  assert.deepEqual(d.assignee, { id: '88888888-8888-4888-8888-888888888888', name: 'Jane Tester' });
  assert.deepEqual(d.assignees, [
    { id: '88888888-8888-4888-8888-888888888888', name: 'Jane Tester' },
    { id: '66666666-6666-4666-8666-666666666666', name: 'Sam Reviewer' },
  ]);
  assert.equal(d.assigneeLocked, false);
  assert.deepEqual(d.labels, [{ name: 'Feature', color: '#0084ff' }]);
  assert.deepEqual(d.timeline, { start: '2026-09-10', target: '2026-09-11' });
  assert.deepEqual(d.subIssues, [
    { id: '44444444-4444-4444-8444-444444444444', key: 'DEMO-13', title: 'Add captcha & rate limit' },
  ]);
  assert.deepEqual(d.attachments, [{ id: '55555555-5555-4555-8555-555555555555', name: 'spec v2.docx', size: '99 KB' }]);
  assert.equal(d.comments.length, 1);
  assert.equal(d.comments[0].author, 'Sam Reviewer');
  assert.equal(d.comments[0].at, '2026-06-05 07:25');
  assert.match(d.comments[0].html, /Looks good/);
  assert.deepEqual(d.activity, [{ who: 'Sam Reviewer', text: 'created this issue', at: '2026-09-10 11:16' }]);
});

test('parseIssueDetail handles an unassigned issue with no timeline', () => {
  const html = fixture('issue-detail.html')
    .replace(' is-current', '')
    .replace(/<div class="prop">\s*<div class="prop-label"><span class="material-symbols-rounded">calendar_month[\s\S]*?<\/div>\s*<\/div>/, '');
  const d = parseIssueDetail(html);
  assert.equal(d.assignee, null);
  assert.deepEqual(d.timeline, { start: null, target: null });
});

test('parseIssueForm reads the create-issue form', () => {
  const f = parseIssueForm(fixture('new-issue.html'));
  assert.equal(f.action, '/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/issues');
  assert.equal(f.csrf, 'create-token');
  assert.deepEqual(f.states, [
    { id: 'aaaa0001-0000-4000-8000-000000000001', name: 'Todo', selected: true },
    { id: 'aaaa0002-0000-4000-8000-000000000002', name: 'In Progress', selected: false },
  ]);
  assert.deepEqual(f.assignees, [
    { id: '88888888-8888-4888-8888-888888888888', name: 'Jane Tester' },
    { id: '66666666-6666-4666-8666-666666666666', name: 'Sam Reviewer' },
  ]);
  assert.deepEqual(f.labels, [
    { id: '99999999-0000-4000-8000-000000000001', name: 'Feature', color: '#0084ff' },
    { id: '99999999-0000-4000-8000-000000000002', name: 'Bug & fix', color: '#ef4444' },
  ]);
  assert.deepEqual(f.priorities, ['urgent', 'high', 'medium', 'low', 'none']);
});

test('parseProjects reads the sidebar project list', () => {
  assert.deepEqual(parseProjects(fixture('issue-detail.html')), [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'DEMO' },
  ]);
});

test('detail parsers throw LayoutChangedError on unrecognised pages', () => {
  const UNRELATED_PAGE = '<html><body><p>nope</p></body></html>';
  assert.throws(() => parseIssueDetail(UNRELATED_PAGE), LayoutChangedError);
  assert.throws(() => parseIssueForm(UNRELATED_PAGE), LayoutChangedError);
  assert.throws(() => parseProjects(UNRELATED_PAGE), LayoutChangedError);
});

test('parseIssueDetail reads a locked assignee on closed issues', () => {
  const html = fixture('issue-detail.html').replace(
    /<form action="[^"]*\/assignee"[\s\S]*?<\/form>/,
    '<span class="ap-static"><span class="avatar-chip">J</span> <span class="ap-name">Jane Tester</span></span>',
  );
  const d = parseIssueDetail(html);
  assert.deepEqual(d.assignee, { id: null, name: 'Jane Tester' });
  assert.deepEqual(d.assignees, []);
  assert.equal(d.assigneeLocked, true);
});
