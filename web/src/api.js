export class ApiError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

const MESSAGES = {
  session_expired: 'Your PMS session expired. Log in again.',
  layout_changed: 'The PMS page layout changed, so the dashboard could not read it.',
  network: 'Could not reach the dashboard server. Is it running?',
};

export function errorMessage(err) {
  return MESSAGES[err.code] ?? err.message ?? 'Something went wrong';
}

// Fill in card fields that may be missing (e.g. from an older server) so the UI never sees undefined.
function normalizeProject(p) {
  return {
    id: p.id,
    name: p.name ?? '',
    key: p.key ?? '',
    description: p.description ?? '',
    issueCount: Number.isFinite(p.issueCount) ? p.issueCount : null,
    icon: p.icon ?? '',
    color: p.color ?? null,
    pinned: Boolean(p.pinned),
    hasCover: Boolean(p.hasCover),
  };
}

async function call(path, { method = 'GET', body } = {}) {
  let res;
  try {
    const isForm = body instanceof FormData; // browser sets the multipart header itself
    res = await fetch(path, {
      method,
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: body && !isForm ? JSON.stringify(body) : body,
    });
  } catch {
    throw new ApiError('network');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'server_error', data.message);
  return data;
}

export const api = {
  session: () => call('/api/session'),
  browsers: () => call('/api/browsers'),
  login: (browser) => call('/api/login', { method: 'POST', body: browser ? { browser } : undefined }),
  logout: () => call('/api/logout', { method: 'POST' }),
  issues: (scope) => call(`/api/issues?scope=${scope}`),
  states: (issue) => call(`/api/issues/${issue.id}/states?projectId=${issue.projectId}`),
  setState: (issueId, stateId) => call(`/api/issues/${issueId}/state`, { method: 'POST', body: { stateId } }),
  issue: (id) => call(`/api/issues/${id}`),
  comment: (id, body) => call(`/api/issues/${id}/comment`, { method: 'POST', body: { body } }),
  setPriority: (id, priority) => call(`/api/issues/${id}/priority`, { method: 'POST', body: { priority } }),
  setAssignee: (id, userId) => call(`/api/issues/${id}/assignee`, { method: 'POST', body: { userId } }),
  projects: () => call('/api/projects').then(({ projects }) => ({ projects: projects.map(normalizeProject) })),
  dashboard: (days = 14) => call(`/api/dashboard?days=${days}`),
  leaderboard: (period, projectId) =>
    call(`/api/leaderboard?period=${period}${projectId ? `&project=${projectId}` : ''}`),
  report: (date) => call(`/api/report?date=${date}`),
  updates: () => call('/api/updates'),
  applyUpdate: () => call('/api/updates/apply', { method: 'POST' }),
  setPinned: (projectId, pinned) => call(`/api/projects/${projectId}/pin`, { method: 'POST', body: { pinned } }),
  projectIssues: (projectId) => call(`/api/projects/${projectId}/issues`),
  issueForm: (projectId, parentId) =>
    call(`/api/projects/${projectId}/issue-form${parentId ? `?parentId=${parentId}` : ''}`),
  createIssue: (projectId, input, files = []) => {
    const body = new FormData();
    body.append('data', JSON.stringify(input));
    for (const file of files) body.append('files', file);
    return call(`/api/projects/${projectId}/issues`, { method: 'POST', body });
  },
};

export const attachmentUrl = (id, download = false) => `/api/attachments/${id}${download ? '?dl=1' : ''}`;

// Statuses are per project. Cache the promise so concurrent callers share one request.
const statesByProject = new Map();

// The project issue list already includes the status options; reuse them.
export function seedStates(projectId, states) {
  if (states.length) statesByProject.set(projectId, Promise.resolve(states));
}

export function loadStates(issue) {
  if (!statesByProject.has(issue.projectId)) {
    const pending = api.states(issue).then((r) => r.states);
    pending.catch(() => statesByProject.delete(issue.projectId));
    statesByProject.set(issue.projectId, pending);
  }
  return statesByProject.get(issue.projectId);
}

// People who can be assigned, per project. The project issue list carries them.
const peopleByProject = new Map();

export function seedPeople(projectId, people) {
  if (people.length) peopleByProject.set(projectId, Promise.resolve(people));
}

export function loadPeople(issue) {
  if (!peopleByProject.has(issue.projectId)) {
    const pending = api.projectIssues(issue.projectId).then((r) => {
      seedStates(issue.projectId, r.states);
      return r.assignees;
    });
    pending.catch(() => peopleByProject.delete(issue.projectId));
    peopleByProject.set(issue.projectId, pending);
  }
  return peopleByProject.get(issue.projectId);
}

// Runs worker over items with at most `limit` in flight.
export async function runPool(items, limit, worker) {
  let next = 0;
  const lane = async () => {
    while (next < items.length) await worker(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}
