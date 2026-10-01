// Local-date helpers shared by the dashboard and the daily report. Dates are 'YYYY-MM-DD'.
const pad = (n) => String(n).padStart(2, '0');
const LIST_MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const toDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** "05 Oct 2026" (issue list format) -> "2026-10-05" */
export function listDateToIso(text) {
  const m = String(text ?? '').match(/(\d{1,2})\s+([a-z]{3})[a-z]*\s+(\d{4})/i);
  return m && LIST_MONTHS[m[2].toLowerCase()] ? `${m[3]}-${pad(LIST_MONTHS[m[2].toLowerCase()])}-${pad(m[1])}` : null;
}

export function todayIso() {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

export function shiftIso(iso, days) {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const formatLong = (iso) =>
  toDate(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const formatShort = (iso) => toDate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export const dayOfMonth = (iso) => String(toDate(iso).getDate());

export const weekdayLetter = (iso) => toDate(iso).toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2);

export function relativeDay(iso) {
  const today = todayIso();
  if (iso === today) return 'Today';
  if (iso === shiftIso(today, -1)) return 'Yesterday';
  return formatShort(iso);
}
