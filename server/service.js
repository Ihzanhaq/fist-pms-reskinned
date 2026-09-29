// Everything the dashboard and the Claude extension can do in the PMS.
// Inputs are validated here so both front ends get the same rules.
import {
  parseIssueDetail,
  parseIssueForm,
  parseIssuePage,
  parseMyIssues,
  parseProjectCards,
  parseProjectIssues,
  parseUserName,
} from './parse.js';
import * as pms from './pms-client.js';
import { PmsError, SessionExpiredError } from './pms-client.js';
import * as session from './session.js';
import { chosenBrowser, installedBrowsers } from './browsers.js';
import { textToHtml } from './text-to-html.js';

export const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAGES = 50;

export class BadRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BadRequestError';
    this.code = code;
  }
}

export function requireUuid(value, what) {
  if (!UUID.test(value ?? '')) throw new BadRequestError('bad_request', `Invalid ${what}`);
  return value;
}

// ---------- session ----------

export async function sessionInfo() {
  try {
    return { loggedIn: true, userName: parseUserName(await pms.get('/my-issues?size=1')) };
  } catch (err) {
    if (err instanceof SessionExpiredError) return { loggedIn: false };
    throw err;
  }
}

export function browsers() {
  return { browsers: installedBrowsers(), selected: chosenBrowser() };
}

export async function login(browser) {
  if (browser !== undefined && !installedBrowsers().some((b) => b.id === browser)) {
    throw new BadRequestError('bad_request', 'That browser is not installed');
  }
  try {
    await session.login(browser);
  } catch (err) {
    throw new BadRequestError('login_failed', err.message);
  }
  return sessionInfo();
}

export function logout() {
  session.clearCookie();
  return { loggedIn: false };
}

// ---------- reading ----------

export async function listMyIssues(scope = 'active') {
  const safeScope = ['all', 'completed'].includes(scope) ? scope : 'active';
  const issues = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = parseMyIssues(await pms.get(`/my-issues?scope=${safeScope}&sort=default&size=100&page=${page}`));
    issues.push(...result.issues);
    if (!result.hasNextPage) break;
  }
  return issues;
}

export async function getIssue(id) {
  requireUuid(id, 'issue id');
  return { id, ...parseIssueDetail(await pms.get(`/issues/${id}`)) };
}

// Status lists are per project and rarely change, so keep them for the process lifetime.
const statesByProject = new Map();

export async function statesFor(issueId, projectId) {
  requireUuid(issueId, 'issue id');
  const cacheKey = UUID.test(projectId ?? '') ? projectId : null;
  if (cacheKey && statesByProject.has(cacheKey)) return statesByProject.get(cacheKey);
  const { states } = parseIssuePage(await pms.get(`/issues/${issueId}`));
  const list = states.map(({ id, name }) => ({ id, name }));
  if (cacheKey) statesByProject.set(cacheKey, list);
  return list;
}

// Project cards: id, name, key, description, issueCount, icon, color, pinned.
export async function listProjects() {
  return parseProjectCards(await pms.get('/'));
}

// Every issue in a project (the PMS list view has no paging), plus its statuses and people.
export async function projectIssues(projectId) {
  requireUuid(projectId, 'project id');
  return parseProjectIssues(await pms.get(`/projects/${projectId}?view=list`));
}

const newIssuePath = (projectId, parentId) =>
  `/projects/${projectId}/issues/new${parentId ? `?parent=${parentId}` : ''}`;

export async function issueFormOptions(projectId, parentId = null) {
  requireUuid(projectId, 'project id');
  if (parentId) requireUuid(parentId, 'parent issue id');
  const { csrf, action, ...options } = parseIssueForm(await pms.get(newIssuePath(projectId, parentId)));
  return options;
}

// ---------- changing ----------

export async function setStatus(id, stateId) {
  requireUuid(id, 'issue id');
  requireUuid(stateId, 'status id');
  // Fresh page gives a valid CSRF token and the statuses allowed for this issue.
  const before = parseIssuePage(await pms.get(`/issues/${id}`));
  if (!before.states.some((s) => s.id === stateId)) {
    throw new BadRequestError('invalid_state', 'That status is not available for this issue');
  }
  await pms.postForm(`/issues/${id}/state`, { _csrf: before.csrf, stateId, back: '/my-issues' });

  const after = parseIssuePage(await pms.get(`/issues/${id}`));
  const selected = after.states.find((s) => s.selected);
  if (selected?.id !== stateId) throw new PmsError('The PMS did not apply the status change');
  return { id: selected.id, name: selected.name };
}

export async function addComment(id, text) {
  requireUuid(id, 'issue id');
  const body = String(text ?? '').trim();
  if (!body) throw new BadRequestError('bad_request', 'Comment is empty');
  if (body.length > 10_000) throw new BadRequestError('bad_request', 'Comment is too long');
  const { csrf } = parseIssuePage(await pms.get(`/issues/${id}`));
  await pms.postForm(`/issues/${id}/comment`, { _csrf: csrf, body });
  return getIssue(id);
}

export async function setPriority(id, priority) {
  requireUuid(id, 'issue id');
  if (!PRIORITIES.includes(priority)) throw new BadRequestError('bad_request', 'Invalid priority');
  const { csrf } = parseIssuePage(await pms.get(`/issues/${id}`));
  await pms.postForm(`/issues/${id}/priority`, { _csrf: csrf, priority, back: `/issues/${id}` });
  return getIssue(id);
}

// userId '' (or null) unassigns.
export async function setAssignee(id, userId) {
  requireUuid(id, 'issue id');
  const target = userId ?? '';
  const page = await pms.get(`/issues/${id}`);
  const detail = parseIssueDetail(page);
  if (detail.assigneeLocked) {
    throw new BadRequestError('assignee_locked', "Reopen this issue to change who it's assigned to");
  }
  if (target && !detail.assignees.some((a) => a.id === target)) {
    throw new BadRequestError('bad_request', 'That person cannot be assigned to this issue');
  }
  const { csrf } = parseIssuePage(page);
  await pms.postForm(`/issues/${id}/assignee`, { _csrf: csrf, userId: target, back: `/issues/${id}` });
  return getIssue(id);
}

// input: { name, description, stateId, priority, assigneeId, labelIds, startDate, targetDate, parentId }
// files: [{ buffer, mimetype, originalname }]
export async function createIssue(projectId, input, files = []) {
  requireUuid(projectId, 'project id');
  const parentId = input.parentId ? requireUuid(input.parentId, 'parent issue id') : null;
  const form = parseIssueForm(await pms.get(newIssuePath(projectId, parentId)));

  const name = String(input.name ?? '').trim();
  if (!name) throw new BadRequestError('bad_request', 'Title is required');
  if (name.length > 500) throw new BadRequestError('bad_request', 'Title is too long');
  const oneOf = (value, list, what) => {
    if (value && !list.some((x) => x.id === value)) throw new BadRequestError('bad_request', `Invalid ${what}`);
    return value || '';
  };
  const date = (value, what) => {
    if (value && !DATE.test(value)) throw new BadRequestError('bad_request', `Invalid ${what}`);
    return value || '';
  };
  const priority = input.priority || 'none';
  if (!PRIORITIES.includes(priority)) throw new BadRequestError('bad_request', 'Invalid priority');
  const labelIds = Array.isArray(input.labelIds) ? input.labelIds : [];
  labelIds.forEach((l) => oneOf(l, form.labels, 'label'));
  const startDate = date(input.startDate, 'start date');
  const targetDate = date(input.targetDate, 'target date');
  if (startDate && targetDate && targetDate < startDate) {
    throw new BadRequestError('bad_request', 'Target date is before the start date');
  }

  const data = new FormData();
  data.append('_csrf', form.csrf);
  if (form.parentId) data.append('parentId', form.parentId);
  data.append('name', name);
  data.append('descriptionHtml', textToHtml(input.description));
  data.append('stateId', oneOf(input.stateId, form.states, 'status'));
  data.append('priority', priority);
  data.append('startDate', startDate);
  data.append('targetDate', targetDate);
  data.append('assigneeId', oneOf(input.assigneeId, form.assignees, 'assignee'));
  for (const labelId of labelIds) data.append('labelIds', labelId);
  for (const file of files) {
    data.append('files', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
  }

  let location;
  try {
    location = await pms.postMultipart(form.action, data);
  } catch (err) {
    if (err instanceof PmsError && files.length) {
      throw new PmsError(`${err.message}. The PMS may not accept files this large.`);
    }
    throw err;
  }
  const id = location.match(/\/issues\/([0-9a-f-]{36})/i)?.[1] ?? null;
  if (!id && location.includes('/issues/new')) throw new PmsError('The PMS did not accept the new issue');
  return { id };
}

// Raw PMS response for an attachment; caller streams the body.
export function attachment(id, download = false) {
  requireUuid(id, 'attachment id');
  return pms.getRaw(`/issue-attachment/${id}${download ? '?dl=1' : ''}`);
}

// ---------- profile photos ----------

// Photos can be added or changed at any time, so keep them briefly, and "no photo" even more briefly.
const AVATAR_TTL_MS = 10 * 60_000;
const NO_AVATAR_TTL_MS = 2 * 60_000;
const AVATAR_CACHE_MAX = 300;
const avatarCache = new Map(); // userId -> { at, image: { type, body } | null }

// A person's profile photo, or null if they have not uploaded one.
export async function avatar(userId) {
  requireUuid(userId, 'user id');
  const hit = avatarCache.get(userId);
  if (hit && Date.now() - hit.at < (hit.image ? AVATAR_TTL_MS : NO_AVATAR_TTL_MS)) return hit.image;
  const image = await pms.getImage(`/avatar/${userId}`);
  if (avatarCache.size >= AVATAR_CACHE_MAX) avatarCache.delete(avatarCache.keys().next().value);
  avatarCache.set(userId, { at: Date.now(), image });
  return image;
}
