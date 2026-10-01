// The current page lives in the URL so refresh, back/forward and bookmarks work.
//   /                   Dashboard
//   /issues             My Issues
//   /projects           all projects (grid)
//   /projects/:id       one project (from all projects)
//   /my-projects        projects where you have issues (grid)
//   /my-projects/:id    one project (from my projects)
//   /report?date=…      daily report (defaults to today)
//   /claude             Connect to Claude
//   /leaderboard        team leaderboard
//   /settings           appearance settings
//   ?issue=:id          detail panel open on top of any page

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

export function parseRoute(location = window.location) {
  const [section, id] = location.pathname.split('/').filter(Boolean);
  const params = new URLSearchParams(location.search);
  const date = params.get('date');
  const projectSection = section === 'projects' || section === 'my-projects';
  return {
    view: VIEWS[section] ?? 'dashboard',
    projectId: projectSection ? idOrNull(id) : null,
    date: section === 'report' && ISO_DATE.test(date ?? '') ? date : null,
    issueId: idOrNull(params.get('issue')),
  };
}

export function routeToPath({ view, projectId, date, issueId }) {
  let base = '/';
  if (view === 'dashboard') base = '/';
  else if (projectId && (view === 'projects' || view === 'my-projects')) base = `/${view}/${projectId}`;
  else if (view !== 'dashboard') base = `/${view}`;
  const params = new URLSearchParams();
  if (view === 'report' && date) params.set('date', date);
  if (issueId) params.set('issue', issueId);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
