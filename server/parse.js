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
    title: titleLink.getAttribute('title')?.trim() || clean(titleLink),
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

// ---------- issue detail ----------

const hasClass = (el, cls) => (el.getAttribute('class') ?? '').split(/\s+/).includes(cls);
const isIcon = (el) => hasClass(el, 'material-symbols-rounded');

// Section cards on the issue page are `.surface` boxes titled by an h2 like "Comments (3)".
function section(root, title) {
  const heading = root.querySelectorAll('h2.section-title').find((h) => clean(h).startsWith(title));
  return heading?.closest('.surface') ?? null;
}

// Right-hand property rows are `.prop` boxes labelled by `.prop-label`.
function prop(root, label) {
  return root.querySelectorAll('.prop').find((p) => clean(p.querySelector('.prop-label')).endsWith(label)) ?? null;
}

const uuidIn = (el, attr = 'href') => el?.getAttribute(attr)?.match(UUID)?.[0] ?? null;

function parseTimeline(propEl) {
  const timeline = { start: null, target: null };
  if (!propEl) return timeline;
  let afterArrow = false;
  const valueSpans = propEl.querySelectorAll('span').filter((s) => !s.closest('.prop-label'));
  for (const span of valueSpans) {
    if (isIcon(span)) {
      afterArrow = true;
      continue;
    }
    const date = clean(span).match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (date) timeline[afterArrow ? 'target' : 'start'] = date;
  }
  return timeline;
}

// Open issues have an assignee picker form; closed issues only show the name.
function parseAssignees(root) {
  const buttons = root.querySelectorAll('form[action$="/assignee"] button[name="userId"]');
  if (!buttons.length) {
    const name = clean(root.querySelector('.ap-static .ap-name'));
    return { assignee: name ? { id: null, name } : null, assignees: [], assigneeLocked: true };
  }
  const nameOf = (b) => lastSpanText(b) || b.querySelector('img')?.getAttribute('alt') || '';
  const current = buttons.find((b) => hasClass(b, 'is-current'));
  return {
    assignee: current?.getAttribute('value') ? { id: current.getAttribute('value'), name: nameOf(current) } : null,
    assignees: buttons.filter((b) => b.getAttribute('value')).map((b) => ({ id: b.getAttribute('value'), name: nameOf(b) })),
    assigneeLocked: false,
  };
}

export function parseIssueDetail(html) {
  const root = parse(html);
  const key = clean(root.querySelector('.iv-key'));
  const title = clean(root.querySelector('h1.page-title'));
  if (!key || !title) throw new LayoutChangedError('The issue page has an unexpected layout');

  const { states } = parseIssuePage(html);
  const statusBadge = prop(root, 'Status')?.querySelector('.status-badge');
  const selectedState = states.find((s) => s.selected);
  const projectLink = prop(root, 'Details')?.querySelector('a[href^="/projects/"]');

  const labelsProp = prop(root, 'Labels');
  const labels = (labelsProp?.querySelectorAll('span[style*="color:"]') ?? []).map((chip) => ({
    name: lastSpanText(chip),
    color: chip.getAttribute('style').match(/(?:^|;)\s*color:\s*(#[0-9a-f]{3,8})/i)?.[1] ?? null,
  }));

  const attachmentsBox = section(root, 'Attachments');
  const attachments = (attachmentsBox?.querySelectorAll('a[href^="/issue-attachment/"]') ?? [])
    .filter((a) => !a.getAttribute('href').includes('dl=1'))
    .map((a) => {
      const nameEl = a.parentNode.querySelector('div[title]');
      return { id: uuidIn(a), name: nameEl?.getAttribute('title') ?? 'attachment', size: clean(nameEl?.nextElementSibling) };
    });

  const comments = (section(root, 'Comments')?.querySelectorAll('.cmt') ?? []).map((c) => {
    const [author, at] = (c.querySelector('.body > div')?.querySelectorAll('span') ?? []).map(clean);
    return { author: author ?? '', at: at ?? '', html: c.querySelector('.doc-body')?.innerHTML.trim() ?? '' };
  });

  const activity = root.querySelectorAll('.act-row').map((row) => {
    const text = row.querySelector('.act-text');
    return {
      who: clean(row.querySelector('.act-who')),
      text: (text?.querySelectorAll('span') ?? []).filter((s) => !hasClass(s, 'act-who')).map(clean).join(' '),
      at: clean(row.querySelector('.act-when')),
    };
  });

  const subIssues = (section(root, 'Sub-issues')?.querySelectorAll('a.sub-link') ?? []).map((a) => ({
    id: uuidIn(a),
    key: clean(a.querySelector('.iv-key')),
    title: clean(a.querySelectorAll('span').find((s) => !hasClass(s, 'iv-key') && !isIcon(s))),
  }));

  return {
    key,
    title,
    descriptionHtml: section(root, 'Description')?.querySelector('.doc-body')?.innerHTML.trim() ?? '',
    project: projectLink ? { id: uuidIn(projectLink), name: clean(projectLink) } : null,
    status: {
      name: clean(statusBadge?.querySelector('span:last-child')) || selectedState?.name || '',
      color: statusBadge?.querySelector('.dot')?.getAttribute('style')?.match(HEX_COLOR)?.[0] ?? null,
    },
    states: states.map(({ id, name }) => ({ id, name })),
    priority: root.querySelector('select[name="priority"] option[selected]')?.getAttribute('value') ?? 'none',
    ...parseAssignees(root),
    labels,
    timeline: parseTimeline(prop(root, 'Timeline')),
    subIssues,
    attachments,
    comments,
    activity,
  };
}

// ---------- create issue form ----------

const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'];
const JS_STRING = String.raw`"(?:[^"\\]|\\.)*"`;

// Labels live in an inline script: `const ALL_LABELS = [ { id: "...", name: "...", color: "..."}, ... ];`
function parseLabelScript(html) {
  const block = html.match(/const\s+ALL_LABELS\s*=\s*\[([\s\S]*?)\];/)?.[1];
  if (!block) return [];
  const item = new RegExp(
    String.raw`id:\s*(${JS_STRING})\s*,\s*name:\s*(${JS_STRING})\s*,\s*color:\s*(${JS_STRING}|null)`,
    'g',
  );
  return [...block.matchAll(item)].map((m) => ({
    id: JSON.parse(m[1]),
    name: JSON.parse(m[2]),
    color: JSON.parse(m[3]),
  }));
}

export function parseIssueForm(html) {
  const root = parse(html);
  const form = root.querySelector('form[action$="/issues"]');
  const csrf = form?.querySelector('input[name="_csrf"]')?.getAttribute('value');
  if (!form || !csrf || !form.querySelector('input[name="name"]')) {
    throw new LayoutChangedError('The new-issue form has an unexpected layout');
  }
  const options = (name) =>
    form.querySelectorAll(`select[name="${name}"] option`).filter((o) => o.getAttribute('value'));

  return {
    action: form.getAttribute('action'),
    csrf,
    parentId: form.querySelector('input[name="parentId"]')?.getAttribute('value') || null,
    states: options('stateId').map((o) => ({ id: o.getAttribute('value'), name: clean(o), selected: o.hasAttribute('selected') })),
    assignees: options('assigneeId').map((o) => ({ id: o.getAttribute('value'), name: clean(o) })),
    labels: parseLabelScript(html),
    priorities: PRIORITIES,
  };
}

// ---------- projects ----------

export function parseProjects(html) {
  const seen = new Map();
  for (const link of parse(html).querySelectorAll('a.nav-link[href^="/projects/"]')) {
    const href = link.getAttribute('href');
    const id = href.match(UUID)?.[0];
    if (id && href === `/projects/${id}` && !seen.has(id)) seen.set(id, clean(link.querySelector('.nav-text')));
  }
  if (!seen.size) throw new LayoutChangedError('Could not find the project list');
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- project list & project issues ----------

export function parseProjectCards(html) {
  const cards = parse(html).querySelectorAll('[data-card="grid"]');
  if (!cards.length) throw new LayoutChangedError('Could not find the project cards');
  return cards.map((card) => {
    // The card also links to /projects/{id}/edit; the name is the plain /projects/{id} link.
    const link = card.querySelectorAll('a[href^="/projects/"]').find((a) => /^\/projects\/[0-9a-f-]{36}$/i.test(a.getAttribute('href')));
    if (!link) throw new LayoutChangedError('A project card has an unexpected layout');
    const iconEl = card.querySelector('.-mt-6 span');
    const countText = card.querySelectorAll('span').map(clean).find((t) => /^\d+ issues?$/.test(t)) ?? '0';
    return {
      id: uuidIn(link),
      name: clean(link),
      key: clean(link?.parentNode.querySelector('span')),
      description: clean(card.querySelector('p')),
      issueCount: Number.parseInt(countText, 10),
      icon: clean(iconEl),
      color: iconEl?.getAttribute('style')?.match(HEX_COLOR)?.[0] ?? null,
      pinned: card.getAttribute('data-pinned') === 'true',
    };
  });
}

// The project list view shows every issue at once (no paging) with inline
// status, priority and assignee pickers.
export function parseProjectIssues(html) {
  const root = parse(html);
  if (!root.querySelector('form.isf-form')) throw new LayoutChangedError('The project issue list has an unexpected layout');

  const issues = root.querySelectorAll('.mi-item').map((item) => {
    const titleLink = item.querySelector('a.mi-title');
    const statusEl = item.querySelector('.mi-status');
    const dateEl = item.querySelector('.mi-target');
    const id = uuidIn(titleLink);
    if (!id || !statusEl) throw new LayoutChangedError('A project issue row has an unexpected layout');

    const current = item.querySelector('.ap-opt.is-current');
    const trigger = item.querySelector('.ap-trigger');
    let assignee = null;
    if (current?.getAttribute('value')) {
      assignee = { id: current.getAttribute('value'), name: lastSpanText(current) };
    } else {
      const name = trigger?.getAttribute('title')?.match(/^Assigned to (.+)$/)?.[1];
      if (name) assignee = { id: uuidIn(trigger.querySelector('img'), 'src'), name };
    }
    const targetDate = lastSpanText(dateEl);

    return {
      id,
      key: clean(item.querySelector('.mi-key')),
      title: titleLink.getAttribute('title')?.trim() || clean(titleLink),
      status: {
        name: lastSpanText(statusEl),
        color: statusEl.querySelector('.dot')?.getAttribute('style')?.match(HEX_COLOR)?.[0] ?? null,
      },
      priority: lastSpanText(item.querySelector('.pill')) || 'none',
      assignee,
      // Closed issues have no assignee picker; the PMS only allows reassigning after reopening.
      assigneeLocked: !item.querySelector('form[action$="/assignee"]'),
      targetDate: targetDate && targetDate !== '—' ? targetDate : null,
      overdue: Boolean(dateEl?.classList.contains('is-over')),
    };
  });

  // Status and people options come from the first row that has pickers.
  const stateSelect = root.querySelector('.mi-item select[name="stateId"]');
  const states = (stateSelect?.querySelectorAll('option') ?? []).map((o) => ({ id: o.getAttribute('value'), name: clean(o) }));
  const panel = root.querySelector('.mi-item form[action$="/assignee"]');
  const assignees = (panel?.querySelectorAll('button[name="userId"]') ?? [])
    .filter((b) => b.getAttribute('value'))
    .map((b) => ({ id: b.getAttribute('value'), name: lastSpanText(b) }));

  return { issues, states, assignees };
}

// ---------- activity feed ----------

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad2 = (n) => String(n).padStart(2, '0');

function shiftIsoDate(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

// Day headings are "Today", "Yesterday" or like "Sat, 26 Sep 2026".
function dayHeadingToIso(label, todayIso) {
  if (/^today$/i.test(label)) return todayIso;
  if (/^yesterday$/i.test(label)) return shiftIsoDate(todayIso, -1);
  const m = label.match(/(\d{1,2})\s+([a-z]{3})[a-z]*\s+(\d{4})/i);
  if (!m || !MONTHS[m[2].toLowerCase()]) return null;
  return `${m[3]}-${pad2(MONTHS[m[2].toLowerCase()])}-${pad2(m[1])}`;
}

function activityKind(text, type) {
  if (/^changed status from /i.test(text)) return 'status';
  if (/^created /i.test(text)) return 'created';
  if (type === 'comment' || /comment/i.test(text)) return 'comment';
  return 'other';
}

// todayIso: the local date the PMS means by "Today" (YYYY-MM-DD).
export function parseActivity(html, todayIso) {
  const root = parse(html);
  if (!root.querySelector('form[action="/activity"]')) {
    throw new LayoutChangedError('The activity page has an unexpected layout');
  }

  const entries = [];
  for (const heading of root.querySelectorAll('.ac-day')) {
    const date = dayHeadingToIso(clean(heading.querySelector('.t')), todayIso);
    const list = heading.nextElementSibling;
    if (!date || !list) continue;
    for (const item of list.querySelectorAll('.ac-item')) {
      const line = item.querySelector('.ac-line');
      const text = (line?.querySelectorAll('span') ?? [])
        .filter((s) => !['ac-who', 'ac-when', 'ac-av'].some((c) => hasClass(s, c)))
        .map(clean)
        .join(' ');
      const type = clean(item.querySelector('.ac-type'));
      const status = text.match(/^changed status from (.+) to (.+)$/i);
      const projectLink = item.querySelector('a.ac-chip[href^="/projects/"]');
      const issueLink = item.querySelector('a.ac-chip[href^="/issues/"]');
      entries.push({
        date,
        time: clean(item.querySelector('.ac-when')),
        who: clean(item.querySelector('.ac-who')),
        text,
        type,
        kind: activityKind(text, type),
        ...(status ? { fromStatus: status[1], toStatus: status[2] } : {}),
        project: projectLink ? { id: uuidIn(projectLink), name: lastSpanText(projectLink) } : null,
        issue: issueLink ? { id: uuidIn(issueLink), key: clean(issueLink) } : null,
      });
    }
  }

  const actors = root
    .querySelectorAll('select[name="actor"] option')
    .filter((o) => o.getAttribute('value'))
    .map((o) => ({ id: o.getAttribute('value'), name: clean(o) }));

  return { entries, actors };
}
