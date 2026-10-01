// The current page lives in the URL so refresh, back/forward and bookmarks work.
//   /                   Dashboard (?days=7|14|30)
//   /issues             My Issues (?scope, q, project, status, layout, issue)
//   /projects           all projects (grid)
//   /projects/:id       one project (from all projects)
//   /my-projects        projects where you have issues (grid)
//   /my-projects/:id    one project (from my projects)
//   /report?date=…      daily report (defaults to today)
//   /claude             Connect to Claude
//   /leaderboard        team leaderboard (?period, project)
//   /settings           appearance settings
//   ?issue=:id          detail panel open on top of any page

import { useCallback, useSyncExternalStore } from 'react';
import { todayIso } from './dates.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const idOrNull = (value) => (UUID.test(value ?? '') ? value : null);

const VIEWS = {
  issues: 'issues',
  projects: 'projects',
  'my-projects': 'my-projects',
  report: 'report',
  claude: 'claude',
  settings: 'settings',
  leaderboard: 'leaderboard',
};

export const DEFAULT_ROUTE = {
  view: 'dashboard',
  projectId: null,
  date: null,
  issueId: null,
  scope: 'active',
  q: '',
  filterProject: 'all',
  filterStatus: 'all',
  layout: 'list',
  days: 14,
  period: 'week',
  lbProject: '',
  pStatus: 'all',
  pPriority: 'all',
  pAssignee: 'all',
  pOverdue: false,
  pSort: 'default',
  pPage: 1,
};

const str = (params, key, fallback = '') => params.get(key) ?? fallback;
const int = (params, key, fallback) => {
  const n = Number(params.get(key));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};
const bool = (params, key) => params.get(key) === '1';

export function parseRoute(location = typeof window !== 'undefined' ? window.location : { pathname: '/', search: '' }) {
  const [section, id] = location.pathname.split('/').filter(Boolean);
  const params = new URLSearchParams(location.search);
  const date = params.get('date');
  const projectSection = section === 'projects' || section === 'my-projects';
  const view = VIEWS[section] ?? 'dashboard';
  const projectId = projectSection ? idOrNull(id) : null;
  const scopeRaw = params.get('scope');
  const layoutRaw = params.get('layout');
  const periodRaw = params.get('period');
  const daysRaw = Number(params.get('days'));

  return {
    view,
    projectId,
    date: section === 'report' && ISO_DATE.test(date ?? '') ? date : null,
    issueId: idOrNull(params.get('issue')),
    scope: scopeRaw === 'all' ? 'all' : 'active',
    q: view === 'issues' || projectId ? str(params, 'q') : DEFAULT_ROUTE.q,
    filterProject: view === 'issues' ? str(params, 'project', 'all') || 'all' : DEFAULT_ROUTE.filterProject,
    filterStatus: view === 'issues' ? str(params, 'status', 'all') || 'all' : DEFAULT_ROUTE.filterStatus,
    layout:
      view === 'issues' || projectId ? (layoutRaw === 'board' ? 'board' : 'list') : DEFAULT_ROUTE.layout,
    days: [7, 14, 30].includes(daysRaw) ? daysRaw : DEFAULT_ROUTE.days,
    period: ['week', 'month', '30d'].includes(periodRaw ?? '') ? periodRaw : DEFAULT_ROUTE.period,
    lbProject: view === 'leaderboard' ? idOrNull(params.get('project')) ?? '' : DEFAULT_ROUTE.lbProject,
    pStatus: projectId ? str(params, 'st', 'all') || 'all' : DEFAULT_ROUTE.pStatus,
    pPriority: projectId ? str(params, 'pri', 'all') || 'all' : DEFAULT_ROUTE.pPriority,
    pAssignee: projectId ? str(params, 'asn', 'all') || 'all' : DEFAULT_ROUTE.pAssignee,
    pOverdue: projectId ? bool(params, 'od') : DEFAULT_ROUTE.pOverdue,
    pSort: projectId ? str(params, 'sort', 'default') || 'default' : DEFAULT_ROUTE.pSort,
    pPage: projectId ? int(params, 'pg', 1) : DEFAULT_ROUTE.pPage,
  };
}

function issuesQuery(route) {
  const params = new URLSearchParams();
  if (route.scope === 'all') params.set('scope', 'all');
  if (route.q) params.set('q', route.q);
  if (route.filterProject !== 'all') params.set('project', route.filterProject);
  if (route.filterStatus !== 'all') params.set('status', route.filterStatus);
  if (route.layout === 'board') params.set('layout', 'board');
  return params;
}

function projectQuery(route) {
  const params = new URLSearchParams();
  if (route.q) params.set('q', route.q);
  if (route.pStatus !== 'all') params.set('st', route.pStatus);
  if (route.pPriority !== 'all') params.set('pri', route.pPriority);
  if (route.pAssignee !== 'all') params.set('asn', route.pAssignee);
  if (route.pOverdue) params.set('od', '1');
  if (route.pSort !== 'default') params.set('sort', route.pSort);
  if (route.pPage > 1) params.set('pg', String(route.pPage));
  if (route.layout === 'board') params.set('layout', 'board');
  return params;
}

function mergeParams(...sources) {
  const out = new URLSearchParams();
  for (const source of sources) {
    for (const [key, value] of source.entries()) out.set(key, value);
  }
  return out;
}

export function routeToPath(route) {
  let base = '/';
  if (route.view === 'dashboard') base = '/';
  else if (route.projectId && (route.view === 'projects' || route.view === 'my-projects')) {
    base = `/${route.view}/${route.projectId}`;
  } else if (route.view !== 'dashboard') base = `/${route.view}`;

  let params = new URLSearchParams();
  if (route.view === 'report') {
    const date = route.date ?? todayIso();
    params.set('date', date);
  } else if (route.view === 'dashboard' && route.days !== DEFAULT_ROUTE.days) {
    params.set('days', String(route.days));
  } else if (route.view === 'issues') {
    params = issuesQuery(route);
  } else if (route.view === 'leaderboard') {
    if (route.period !== DEFAULT_ROUTE.period) params.set('period', route.period);
    if (route.lbProject) params.set('project', route.lbProject);
  } else if (route.projectId && (route.view === 'projects' || route.view === 'my-projects')) {
    params = projectQuery(route);
  }

  if (route.issueId) params.set('issue', route.issueId);

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

const listeners = new Set();
let cachedKey = '';
let cachedRoute = { ...DEFAULT_ROUTE };

function locationKey() {
  return window.location.pathname + window.location.search;
}

function notifyRouteListeners() {
  cachedKey = '';
  listeners.forEach((listener) => listener());
}

function onPopState() {
  notifyRouteListeners();
}

export function subscribeRoute(listener) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('popstate', onPopState);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('popstate', onPopState);
  };
}

/** Cached snapshot — useSyncExternalStore needs a stable reference until the URL changes. */
export function getRoute() {
  const key = locationKey();
  if (key === cachedKey) return cachedRoute;
  cachedKey = key;
  cachedRoute = parseRoute(window.location);
  return cachedRoute;
}

export function commitRoute(next, { replace = false } = {}) {
  const path = routeToPath(next);
  const current = locationKey();
  if (path === current) return;
  if (replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  notifyRouteListeners();
}

/** Reset view-local fields when switching sidebar sections. */
export function routeForView(view) {
  return {
    ...DEFAULT_ROUTE,
    view,
    projectId: null,
    issueId: null,
    date: view === 'report' ? todayIso() : null,
  };
}

export function useRoute() {
  const route = useSyncExternalStore(subscribeRoute, getRoute, () => DEFAULT_ROUTE);

  const patchRoute = useCallback((patch, opts) => {
    commitRoute({ ...getRoute(), ...patch }, opts);
  }, []);

  const navigate = useCallback((view) => {
    commitRoute(routeForView(view));
  }, []);

  return { route, patchRoute, navigate, commitRoute };
}
