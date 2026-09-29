// Local-date helpers shared by the dashboard and the daily report. Dates are 'YYYY-MM-DD'.
const pad = (n) => String(n).padStart(2, '0');
const toDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

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
