// Resolves names typed by a person (or Claude) to PMS records.
export class NoMatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NoMatchError';
  }
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

// Exact (case-insensitive) match wins; otherwise a unique "contains" match.
// Throws NoMatchError listing the options when nothing or several things match.
export function findByName(items, query, what, nameOf = (x) => x.name) {
  const q = norm(query);
  if (!q) throw new NoMatchError(`No ${what} given`);
  const exact = items.filter((x) => norm(nameOf(x)) === q);
  if (exact.length === 1) return exact[0];
  const partial = exact.length ? exact : items.filter((x) => norm(nameOf(x)).includes(q));
  if (partial.length === 1) return partial[0];

  const list = (partial.length ? partial : items).map(nameOf);
  const shown = list.slice(0, 40).join(', ') + (list.length > 40 ? `, … (${list.length - 40} more)` : '');
  throw new NoMatchError(
    partial.length
      ? `"${query}" matches several ${what}s: ${shown}. Be more specific.`
      : `No ${what} named "${query}". Options: ${shown}`,
  );
}

const ISSUE_KEY = /^[a-z][a-z0-9]*-\d+$/i;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Accepts an issue key ("BMS-1"), an id, or a PMS issue URL.
export function parseIssueRef(ref) {
  const text = String(ref ?? '').trim();
  const id = text.match(UUID)?.[0];
  if (id) return { id };
  if (ISSUE_KEY.test(text)) return { key: text.toUpperCase() };
  throw new NoMatchError(`"${ref}" is not an issue key (like BMS-1), id or PMS link`);
}
