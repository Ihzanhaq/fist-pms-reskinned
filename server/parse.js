// Turns FIST PMS HTML pages into plain data. Pure functions, no I/O.
import { parse } from 'node-html-parser';

export class LayoutChangedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LayoutChangedError';
  }
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const HEX_COLOR = /#[0-9a-f]{3,8}\b/i;

const clean = (el) => (el ? el.text.replace(/\s+/g, ' ').trim() : '');

// Pills and dates render an icon span followed by the real value in the last span.
const lastSpanText = (el) => {
  if (!el) return '';
  const spans = el.querySelectorAll('span');
  return clean(spans.length ? spans[spans.length - 1] : el);
};

function parseIssueRow(item) {
  const titleLink = item.querySelector('a.mi-title');
  const projectLink = item.querySelector('a.mi-proj');
  const statusEl = item.querySelector('.mi-status');
  const dateEl = item.querySelector('.mi-target');

  const id = titleLink?.getAttribute('href')?.match(UUID)?.[0];
  const projectId = projectLink?.getAttribute('href')?.match(UUID)?.[0];
  if (!id || !projectId || !statusEl) {
    throw new LayoutChangedError('An issue row on /my-issues has an unexpected layout');
  }

  const dotStyle = statusEl.querySelector('.dot')?.getAttribute('style') ?? '';
  const targetDate = lastSpanText(dateEl);

  return {
    id,
    key: clean(item.querySelector('.mi-key')),
    title: titleLink.getAttribute('title') || clean(titleLink),
    projectId,
    projectName: clean(projectLink.querySelector('.nm')),
    status: { name: clean(statusEl), color: dotStyle.match(HEX_COLOR)?.[0] ?? null },
    priority: lastSpanText(item.querySelector('.pill')) || 'none',
    targetDate: targetDate && targetDate !== '—' ? targetDate : null,
    overdue: Boolean(dateEl?.classList.contains('is-over')),
  };
}

export function parseMyIssues(html) {
  const root = parse(html);
  if (!root.querySelector('form[action="/my-issues"]')) {
    throw new LayoutChangedError('The /my-issues page has an unexpected layout');
  }
  const issues = root.querySelectorAll('.mi-item').map(parseIssueRow);
  const hasNextPage = root.querySelectorAll('a.pg-btn').some((a) => /\bNext\b/.test(a.text));
  return { issues, hasNextPage };
}

export function parseIssuePage(html) {
  const form = parse(html).querySelector('form[action$="/state"]');
  const csrf = form?.querySelector('input[name="_csrf"]')?.getAttribute('value');
  const select = form?.querySelector('select[name="stateId"]');
  if (!csrf || !select) {
    throw new LayoutChangedError('The issue page has no status form');
  }
  const states = select.querySelectorAll('option').map((option) => ({
    id: option.getAttribute('value'),
    name: clean(option),
    selected: option.hasAttribute('selected'),
  }));
  return { csrf, states };
}

export function parseUserName(html) {
  const name = clean(parse(html).querySelector('.topbar-account-name'));
  if (!name) throw new LayoutChangedError('Could not find the account name in the PMS header');
  return name;
}
