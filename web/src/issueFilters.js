import { listDateToIso } from './dates.js';

/** True when the issue's PMS list date falls within an optional from/to (ISO) range. */
export function dateInRange(displayDate, from, to) {
  const active = Boolean(from || to);
  if (!active) return true;
  const iso = listDateToIso(displayDate);
  if (!iso) return false;
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

export function matchIssueDates(issue, { createdFrom, createdTo, targetFrom, targetTo }) {
  return (
    dateInRange(issue.startDate, createdFrom, createdTo) &&
    dateInRange(issue.targetDate, targetFrom, targetTo)
  );
}
