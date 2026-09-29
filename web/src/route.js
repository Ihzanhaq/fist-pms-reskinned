// The current page lives in the URL so refresh, back/forward and bookmarks work.
//   /                   My Issues
//   /projects           project list
//   /projects/:id       one project
//   /claude             Connect to Claude
//   ?issue=:id          detail panel open on top of any page

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idOrNull = (value) => (UUID.test(value ?? '') ? value : null);

export function parseRoute(location = window.location) {
  const [section, id] = location.pathname.split('/').filter(Boolean);
  const issueId = idOrNull(new URLSearchParams(location.search).get('issue'));
  if (section === 'projects') return { view: 'projects', projectId: idOrNull(id), issueId };
  if (section === 'claude') return { view: 'claude', projectId: null, issueId };
  return { view: 'issues', projectId: null, issueId };
}

export function routeToPath({ view, projectId, issueId }) {
  const base = view === 'projects' ? `/projects${projectId ? `/${projectId}` : ''}` : view === 'claude' ? '/claude' : '/';
  return issueId ? `${base}?issue=${issueId}` : base;
}
