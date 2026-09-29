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

async function call(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
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
  login: () => call('/api/login', { method: 'POST' }),
  logout: () => call('/api/logout', { method: 'POST' }),
  issues: (scope) => call(`/api/issues?scope=${scope}`),
  states: (issue) => call(`/api/issues/${issue.id}/states?projectId=${issue.projectId}`),
  setState: (issueId, stateId) => call(`/api/issues/${issueId}/state`, { method: 'POST', body: { stateId } }),
};

// Statuses are per project. Cache the promise so concurrent callers share one request.
const statesByProject = new Map();

export function loadStates(issue) {
  if (!statesByProject.has(issue.projectId)) {
    const pending = api.states(issue).then((r) => r.states);
    pending.catch(() => statesByProject.delete(issue.projectId));
    statesByProject.set(issue.projectId, pending);
  }
  return statesByProject.get(issue.projectId);
}

// Runs worker over items with at most `limit` in flight.
export async function runPool(items, limit, worker) {
  let next = 0;
  const lane = async () => {
    while (next < items.length) await worker(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}
