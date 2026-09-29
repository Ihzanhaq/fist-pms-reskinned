// Turns PMS activity entries into plain sentences for the daily report.
// Entries: { time, kind, text, fromStatus?, toStatus? }

const DONE = /^(done|resolved|closed|completed)$/i;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const niceDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ''}`;
};

// A short verb phrase, lower-case, that reads after "I …".
export function phrase(entry, { me } = {}) {
  if (entry.kind === 'status') {
    const to = entry.toStatus ?? '';
    if (DONE.test(to)) return `marked it ${to.toLowerCase()}`;
    if (/progress/i.test(to)) return 'started working on it';
    if (/^(new|todo|to do|backlog)$/i.test(to)) return `moved it back to ${to}`;
    if (/feedback/i.test(to)) return 'sent it for feedback';
    if (/cancel/i.test(to)) return 'cancelled it';
    if (/reject/i.test(to)) return 'rejected it';
    return `moved it to ${to}`;
  }
  if (entry.kind === 'created') return 'created it';
  if (entry.kind === 'comment') return 'added a comment';

  const text = entry.text ?? '';
  const date = text.match(/^set the (due|start) date to (\d{4}-\d{2}-\d{2})$/i);
  if (date) return `set the ${date[1] === 'due' ? 'due' : 'start'} date to ${niceDate(date[2])}`;
  const assigned = text.match(/^assigned (.+)$/i);
  if (assigned) return `assigned it to ${assigned[1] === me ? 'yourself' : assigned[1]}`;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// "Started working on it at 11:41, then marked it resolved at 17:16."
export function sentence(entries, { times = true, me } = {}) {
  const parts = entries.map((e) => `${phrase(e, { me })}${times && e.time ? ` at ${e.time}` : ''}`);
  if (!parts.length) return '';
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')}, then ${parts.at(-1)}`;
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`;
}

// Which section an issue's day belongs in.
export function category(group) {
  if (group.completed) return 'completed';
  const lastStatus = [...group.entries].reverse().find((e) => e.kind === 'status');
  if (lastStatus && /progress/i.test(lastStatus.toStatus ?? '')) return 'inProgress';
  if (group.entries.some((e) => e.kind === 'created')) return 'created';
  return 'other';
}

export const SECTIONS = [
  { id: 'completed', title: 'Completed' },
  { id: 'inProgress', title: 'In progress' },
  { id: 'created', title: 'New issues' },
  { id: 'other', title: 'Other updates' },
];

export function sections(groups) {
  return SECTIONS.map((s) => ({ ...s, groups: groups.filter((g) => category(g) === s.id) })).filter((s) => s.groups.length);
}

const issueName = (g) => (g.issue ? g.issue.title ?? g.issue.key : g.project ?? 'Other');

// Plain-text report for chat or email.
export function reportText(report, dateLabel, { me } = {}) {
  const lines = [`Daily report – ${dateLabel}`];
  const parts = sections(report.groups);
  if (!parts.length) return `${lines[0]}\n\nNo PMS activity.`;
  for (const s of parts) {
    lines.push('', `${s.title} (${s.groups.length})`);
    for (const g of s.groups) {
      // The key goes in brackets only when the title is shown instead of it.
      const ref = [g.issue?.title ? g.issue.key : null, g.project].filter(Boolean).join(', ');
      const detail = s.id === 'completed' ? '' : ` – ${sentence(g.entries, { times: false, me })}`;
      lines.push(`• ${issueName(g)}${ref ? ` (${ref})` : ''}${detail}`);
    }
  }
  return lines.join('\n');
}
