// The current page lives in the URL so refresh, back/forward and bookmarks work.
//   /                   Dashboard
//   /issues             My Issues
//   /projects           project list
//   /projects/:id       one project
//   /report?date=…      daily report (defaults to today)
//   /claude             Connect to Claude
//   ?issue=:id          detail panel open on top of any page

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const idOrNull = (value) => (UUID.test(value ?? '') ? value : null);
const VIEWS = { issues: 'issues', projects: 'projects', report: 'report', claude: 'claude' };

export function parseRoute(location = window.location) {
  const [section, id] = location.pathname.split('/').filter(Boolean);
  const params = new URLSearchParams(location.search);
  const date = params.get('date');
  return {
    view: VIEWS[section] ?? 'dashboard',
    projectId: section === 'projects' ? idOrNull(id) : null,
    date: section === 'report' && ISO_DATE.test(date ?? '') ? date : null,
    issueId: idOrNull(params.get('issue')),
  };
}

export function routeToPath({ view, projectId, date, issueId }) {
  const base = view === 'dashboard' ? '/' : view === 'projects' && projectId ? `/projects/${projectId}` : `/${view}`;
  const params = new URLSearchParams();
  if (view === 'report' && date) params.set('date', date);
  if (issueId) params.set('issue', issueId);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
