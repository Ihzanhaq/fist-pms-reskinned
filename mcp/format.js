// Plain-text views of PMS data for Claude to read.
import { parse } from 'node-html-parser';
import { PMS_BASE } from '../server/config.js';

export const issueUrl = (id) => `${PMS_BASE}/issues/${id}`;

// PMS rich text (Quill HTML) to readable plain text.
export function htmlToText(html) {
  if (!html) return '';
  const withImages = html.replace(/<image-component\b[^>]*>(?:<\/image-component>)?/gi, '<p>[image]</p>');
  return parse(withImages)
    .structuredText.replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function issueLine(i) {
  const target = i.targetDate ? ` · due ${i.targetDate}${i.overdue ? ' (OVERDUE)' : ''}` : '';
  return `${i.key} · ${i.title} · ${i.projectName} · ${i.status.name} · ${i.priority}${target}`;
}

export function issueDetailText(d) {
  const lines = [
    `# ${d.key}: ${d.title}`,
    ...(d.parentIssue
      ? [`Parent: ${d.parentIssue.key} · ${d.parentIssue.title} (id ${d.parentIssue.id})`]
      : []),
    `Link: ${issueUrl(d.id)}`,
    `Project: ${d.project?.name ?? '—'}`,
    `Status: ${d.status.name}  (available: ${d.states.map((s) => s.name).join(', ')})`,
    `Priority: ${d.priority}`,
    `Assignee: ${d.assignee?.name ?? 'Unassigned'}${d.assigneeLocked ? ' (locked until the issue is reopened)' : ''}`,
    `Labels: ${d.labels.map((l) => l.name).join(', ') || 'none'}`,
    `Timeline: ${d.timeline.start ?? '—'} → ${d.timeline.target ?? '—'}`,
    '',
    '## Description',
    htmlToText(d.descriptionHtml) || '(none)',
  ];
  if (d.subIssues.length) {
    lines.push('', `## Sub-issues (${d.subIssues.length})`, ...d.subIssues.map((s) => `- ${s.key} · ${s.title} (id ${s.id})`));
  }
  if (d.attachments.length) {
    lines.push('', `## Attachments (${d.attachments.length})`, ...d.attachments.map((a) => `- ${a.name} (${a.size})`));
  }
  lines.push('', `## Comments (${d.comments.length})`);
  if (d.comments.length) {
    for (const c of d.comments) lines.push(`- ${c.author}, ${c.at}: ${htmlToText(c.html) || '(empty)'}`);
  } else {
    lines.push('(none)');
  }
  if (d.activity.length) {
    lines.push('', '## Recent activity', ...d.activity.slice(0, 10).map((a) => `- ${a.at} ${a.who} ${a.text}`));
  }
  return lines.join('\n');
}
