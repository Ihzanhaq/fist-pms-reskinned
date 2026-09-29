import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldRows } from '../../web/src/foldRows.js';

const rows = (n) => Array.from({ length: n }, (_, i) => ({ label: `P${i + 1}`, value: n - i }));

test('short lists are left alone', () => {
  assert.deepEqual(foldRows(rows(3)), { rows: rows(3), hidden: 0 });
  // Folding a single row into "Other (1)" saves nothing, so 6 rows stay as they are.
  assert.deepEqual(foldRows(rows(6)), { rows: rows(6), hidden: 0 });
});

test('long lists keep the top rows and sum the rest into Other', () => {
  const { rows: out, hidden } = foldRows(rows(8), 5);
  assert.equal(hidden, 3);
  assert.deepEqual(out.map((r) => r.label), ['P1', 'P2', 'P3', 'P4', 'P5', 'Other (3)']);
  assert.equal(out.at(-1).value, 3 + 2 + 1);
  assert.equal(out.at(-1).other, true);
});
