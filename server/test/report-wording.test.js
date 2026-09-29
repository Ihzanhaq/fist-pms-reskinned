import { test } from 'node:test';
import assert from 'node:assert/strict';
import { category, phrase, reportText, sections, sentence } from '../../web/src/reportWording.js';

const status = (from, to, time = '10:00') => ({ time, kind: 'status', text: `changed status from ${from} to ${to}`, fromStatus: from, toStatus: to });

test('phrase describes each kind of update in plain words', () => {
  assert.equal(phrase(status('New', 'Resolved')), 'marked it resolved');
  assert.equal(phrase(status('New', 'In Progress')), 'started working on it');
  assert.equal(phrase(status('In progress', 'New')), 'moved it back to New');
  assert.equal(phrase(status('New', 'Feedback')), 'sent it for feedback');
  assert.equal(phrase(status('New', 'Cancelled')), 'cancelled it');
  assert.equal(phrase(status('New', 'QA')), 'moved it to QA');
  assert.equal(phrase({ kind: 'created', text: 'created this issue' }), 'created it');
  assert.equal(phrase({ kind: 'comment', text: 'commented' }), 'added a comment');
  assert.equal(phrase({ kind: 'other', text: 'assigned Manish Madhu' }), 'assigned it to Manish Madhu');
  assert.equal(phrase({ kind: 'other', text: 'assigned Jane Tester' }, { me: 'Jane Tester' }), 'assigned it to yourself');
  assert.match(phrase({ kind: 'other', text: 'set the due date to 2026-10-02' }), /^set the due date to 2 Oct/);
});

test('sentence joins the steps of a day', () => {
  assert.equal(sentence([status('New', 'In Progress', '11:41'), status('In Progress', 'Resolved', '17:16')]),
    'Started working on it at 11:41, then marked it resolved at 17:16.');
  assert.equal(sentence([status('New', 'Resolved', '09:00')], { times: false }), 'Marked it resolved.');
  assert.equal(sentence([]), '');
});

test('category and sections sort issues by outcome', () => {
  const groups = [
    { issue: { key: 'A-1', title: 'Login' }, project: 'Demo', completed: true, entries: [status('New', 'Done')] },
    { issue: { key: 'A-2', title: 'Signup' }, project: 'Demo', completed: false, entries: [status('New', 'In Progress')] },
    { issue: { key: 'A-3', title: null }, project: 'Demo', completed: false, entries: [{ kind: 'created', text: 'created this issue' }] },
    { issue: { key: 'A-4', title: 'Docs' }, project: 'Demo', completed: false, entries: [status('In progress', 'New')] },
  ];
  assert.deepEqual(groups.map(category), ['completed', 'inProgress', 'created', 'other']);
  assert.deepEqual(sections(groups).map((s) => [s.id, s.groups.length]), [
    ['completed', 1], ['inProgress', 1], ['created', 1], ['other', 1],
  ]);

  const text = reportText({ groups }, 'Tuesday, 29 September 2026');
  assert.equal(text, [
    'Daily report – Tuesday, 29 September 2026',
    '',
    'Completed (1)',
    '• Login (A-1, Demo)',
    '',
    'In progress (1)',
    '• Signup (A-2, Demo) – Started working on it.',
    '',
    'New issues (1)',
    '• A-3 (Demo) – Created it.',
    '',
    'Other updates (1)',
    '• Docs (A-4, Demo) – Moved it back to New.',
  ].join('\n'));
  assert.equal(reportText({ groups: [] }, 'X'), 'Daily report – X\n\nNo PMS activity.');
});
