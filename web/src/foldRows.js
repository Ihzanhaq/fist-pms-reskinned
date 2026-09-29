// Keeps the first `limit` rows and folds the rest into one "Other" row, so a
// breakdown card stays the same height however many categories there are.
// Rows are assumed sorted largest first.
export function foldRows(rows, limit = 5) {
  if (rows.length <= limit + 1) return { rows, hidden: 0 };
  const kept = rows.slice(0, limit);
  const rest = rows.slice(limit);
  return {
    rows: [...kept, { label: `Other (${rest.length})`, value: rest.reduce((sum, r) => sum + r.value, 0), other: true }],
    hidden: rest.length,
  };
}
