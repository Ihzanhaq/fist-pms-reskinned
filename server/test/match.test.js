import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NoMatchError, findByName, parseIssueRef } from '../match.js';

const states = [{ name: 'In Progress' }, { name: 'Done' }, { name: 'Done (verified)' }, { name: 'Todo' }];

test('findByName prefers an exact case-insensitive match', () => {
  assert.equal(findByName(states, 'in progress', 'status').name, 'In Progress');
  assert.equal(findByName(states, 'DONE', 'status').name, 'Done');
});

test('findByName falls back to a unique partial match', () => {
  assert.equal(findByName(states, 'verified', 'status').name, 'Done (verified)');
  assert.equal(findByName(states, '  in   prog ', 'status').name, 'In Progress');
});

test('findByName explains ambiguous and missing matches', () => {
  assert.throws(() => findByName(states, 'o', 'status'), (e) => e instanceof NoMatchError && /several statuss?/.test(e.message));
  assert.throws(() => findByName(states, 'Blocked', 'status'), /No status named "Blocked". Options: In Progress, Done/);
  assert.throws(() => findByName(states, '', 'status'), NoMatchError);
});

test('findByName can use a custom name getter', () => {
  const people = [{ id: 1, fullName: 'Jane Tester' }];
  assert.equal(findByName(people, 'jane', 'assignee', (p) => p.fullName).id, 1);
});

test('parseIssueRef accepts keys, ids and PMS links', () => {
  assert.deepEqual(parseIssueRef('bms-1'), { key: 'BMS-1' });
  assert.deepEqual(parseIssueRef('SCALAR360-100'), { key: 'SCALAR360-100' });
  assert.deepEqual(parseIssueRef('06da79cf-bd03-4ed7-9a26-d0992b19ca6e'), { id: '06da79cf-bd03-4ed7-9a26-d0992b19ca6e' });
  assert.deepEqual(parseIssueRef('https://pms.fistinnovations.com/issues/06da79cf-bd03-4ed7-9a26-d0992b19ca6e?back=/'), {
    id: '06da79cf-bd03-4ed7-9a26-d0992b19ca6e',
  });
  assert.throws(() => parseIssueRef('login bug'), NoMatchError);
});
