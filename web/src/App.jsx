import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertOctagon, Loader2, Plus } from 'lucide-react';
import { api, errorMessage, loadStates, runPool } from './api.js';
import { parseRoute, routeToPath } from './route.js';
import { THEMES, useAppearance } from './theme.js';
import BulkBar from './components/BulkBar.jsx';
import ConnectClaude from './components/ConnectClaude.jsx';
import SettingsView from './components/SettingsView.jsx';
import DailyReport from './components/DailyReport.jsx';
import DashboardView from './components/DashboardView.jsx';
import { formatShort, todayIso } from './dates.js';
import ProjectsGrid from './components/ProjectsGrid.jsx';
import ProjectView from './components/ProjectView.jsx';
import CreateIssueModal from './components/CreateIssueModal.jsx';
import IssueDrawer from './components/IssueDrawer.jsx';
import TopBar from './components/TopBar.jsx';
import Sidebar from './components/Sidebar.jsx';
import Filters from './components/Filters.jsx';
import IssueTable from './components/IssueTable.jsx';
import LoginBanner from './components/LoginBanner.jsx';
import Toast from './components/Toast.jsx';

const EMPTY_FILTERS = { q: '', project: 'all', status: 'all' };
const uniqueSorted = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

export default function App() {
  const [session, setSession] = useState({ checked: false, loggedIn: false, expired: false, userName: '' });
  const [loggingIn, setLoggingIn] = useState(false);
  const [scope, setScope] = useState('active');
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [savingIds, setSavingIds] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const [route, setRoute] = useState(parseRoute);
  const appearance = useAppearance();
  const [projectCard, setProjectCard] = useState(null); // card for route.projectId
  const [lastChange, setLastChange] = useState(null); // latest edit from the detail panel
  const [projectReload, setProjectReload] = useState(0);
  const [createFor, setCreateFor] = useState(null); // null = closed, { parent } = open

  const { view, issueId: openIssueId } = route;
  const openProject = route.projectId && projectCard?.id === route.projectId ? projectCard : null;

  // Keep the URL in step with the route, and the route with back/forward.
  useEffect(() => {
    const path = routeToPath(route);
    if (path !== window.location.pathname + window.location.search) window.history.pushState(null, '', path);
  }, [route]);
  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const setOpenIssueId = useCallback((issueId) => setRoute((r) => ({ ...r, issueId: issueId ?? null })), []);
  const navigate = useCallback((next) => setRoute({ view: next, projectId: null, date: null, issueId: null }), []);
  const setOpenProject = useCallback((card) => {
    if (card) setProjectCard(card);
    setRoute({ view: 'projects', projectId: card?.id ?? null, date: null, issueId: null });
  }, []);

  // After a refresh only the project id is known; look up its card.
  useEffect(() => {
    if (!route.projectId || projectCard?.id === route.projectId || !session.loggedIn) return;
    let live = true;
    api
      .projects()
      .then(({ projects }) => {
        if (!live) return;
        const card = projects.find((p) => p.id === route.projectId);
        if (card) setProjectCard(card);
        else setRoute({ view: 'projects', projectId: null, date: null, issueId: null });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [route.projectId, projectCard, session.loggedIn]);

  const showToast = useCallback((kind, text) => setToast({ kind, text }), []);
  const clearToast = useCallback(() => setToast(null), []);

  const handleError = useCallback((err) => {
    if (err.code === 'session_expired') {
      setSession((s) => ({ ...s, loggedIn: false, expired: true }));
    } else {
      setError(err);
    }
  }, []);

  // Errors from the panel and the create form: expired sessions show the login banner,
  // everything else becomes a toast.
  const handlePanelError = useCallback(
    (err, text) => {
      if (err.code === 'session_expired') {
        setOpenIssueId(null);
        setCreateFor(null);
        setSession((s) => ({ ...s, loggedIn: false, expired: true }));
      }
      showToast('error', text ?? errorMessage(err));
    },
    [showToast],
  );

  const closeDrawer = useCallback(() => setOpenIssueId(null), []);
  const closeCreate = useCallback(() => setCreateFor(null), []);

  useEffect(() => {
    api
      .session()
      .then((s) => setSession({ checked: true, expired: false, ...s }))
      .catch((err) => {
        setSession({ checked: true, loggedIn: false, expired: false, userName: '' });
        setError(err);
      });
  }, []);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { issues } = await api.issues(scope);
      setIssues(issues);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [scope, handleError]);

  useEffect(() => {
    if (session.loggedIn) loadIssues();
  }, [session.loggedIn, loadIssues]);

  const login = async () => {
    setLoggingIn(true);
    try {
      const s = await api.login();
      setSession({ checked: true, expired: false, ...s });
      setError(null);
    } catch (err) {
      showToast('error', errorMessage(err));
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    await api.logout().catch(() => {});
    setSession({ checked: true, loggedIn: false, expired: false, userName: '' });
    setIssues([]);
  };

  // Status colors come from the list page; reuse them for dropdown options.
  const statusColors = useMemo(() => {
    const map = new Map();
    for (const i of issues) if (i.status.color) map.set(i.status.name.toLowerCase(), i.status.color);
    return map;
  }, [issues]);
  const colorFor = useCallback((name) => statusColors.get(name.toLowerCase()) ?? null, [statusColors]);

  const updateIssue = (id, patch) => setIssues((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const setSaving = (id, on) =>
    setSavingIds((prev) => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });

  // Optimistic update; reverts on failure. Returns { ok, status } or { ok: false, err }.
  const applyStatus = async (issue, state) => {
    const previous = issue.status;
    updateIssue(issue.id, { status: { name: state.name, color: colorFor(state.name) } });
    setSaving(issue.id, true);
    try {
      const { status } = await api.setState(issue.id, state.id);
      updateIssue(issue.id, { status: { name: status.name, color: colorFor(status.name) } });
      return { ok: true, status };
    } catch (err) {
      updateIssue(issue.id, { status: previous });
      if (err.code === 'session_expired') handleError(err);
      return { ok: false, err };
    } finally {
      setSaving(issue.id, false);
    }
  };

  const changeStatus = async (issue, state) => {
    const result = await applyStatus(issue, state);
    if (result.ok) showToast('success', `${issue.key} moved to ${result.status.name}`);
    else showToast('error', `Could not update ${issue.key}: ${errorMessage(result.err)}`);
  };

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  useEffect(() => setSelectedIds(new Set()), [scope]);

  const toggleSelected = useCallback(
    (id) =>
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      }),
    [],
  );

  const bulkUpdate = async (targets, statusName) => {
    const wanted = statusName.toLowerCase();
    const jobs = [];
    const failed = [];
    let unchanged = 0;
    let unavailable = 0;

    setBulkRunning(true);
    for (const issue of targets) {
      if (issue.status.name.toLowerCase() === wanted) {
        unchanged++;
        continue;
      }
      const states = await loadStates(issue).catch(() => null);
      const state = states?.find((s) => s.name.toLowerCase() === wanted);
      if (!states) failed.push(issue);
      else if (!state) unavailable++;
      else jobs.push({ issue, state });
    }

    let updated = 0;
    await runPool(jobs, 3, async ({ issue, state }) => {
      const result = await applyStatus(issue, state);
      result.ok ? updated++ : failed.push(issue);
    });
    setBulkRunning(false);

    // Keep only failures selected so they can be retried.
    setSelectedIds(new Set(failed.map((i) => i.id)));

    const parts = [`${updated} moved to ${statusName}`];
    if (unchanged) parts.push(`${unchanged} already there`);
    if (unavailable) parts.push(`${unavailable} skipped (status not in project)`);
    if (failed.length) parts.push(`${failed.length} failed`);
    showToast(failed.length ? 'error' : 'success', parts.join(' · '));
  };

  // Keep the list in step with edits made in the detail panel.
  const onDetailChanged = (fresh, text) => {
    const patch = {
      title: fresh.title,
      priority: fresh.priority,
      status: { name: fresh.status.name, color: colorFor(fresh.status.name) ?? fresh.status.color },
    };
    updateIssue(fresh.id, patch);
    setLastChange({ id: fresh.id, patch: { ...patch, assignee: fresh.assignee } });
    showToast('success', `${fresh.key}: ${text}`);
  };

  const onIssueCreated = (id, name) => {
    setCreateFor(null);
    showToast('success', `Created “${name}”`);
    loadIssues();
    setProjectReload((n) => n + 1);
    if (id) setOpenIssueId(id);
  };

  const projects = useMemo(() => uniqueSorted(issues.map((i) => i.projectName)), [issues]);
  const statuses = useMemo(() => uniqueSorted(issues.map((i) => i.status.name)), [issues]);

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return issues.filter(
      (i) =>
        (filters.project === 'all' || i.projectName === filters.project) &&
        (filters.status === 'all' || i.status.name === filters.status) &&
        (!q || i.key.toLowerCase().includes(q) || i.title.toLowerCase().includes(q)),
    );
  }, [issues, filters]);

  // Bulk actions only touch issues that are both selected and currently visible.
  const selectedVisible = useMemo(() => visible.filter((i) => selectedIds.has(i.id)), [visible, selectedIds]);

  const toggleAllVisible = (select) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const i of visible) select ? next.add(i.id) : next.delete(i.id);
      return next;
    });

  const SECTION = { dashboard: 'Dashboard', issues: 'My Issues', projects: 'Projects', report: 'Daily report', claude: 'Connect to Claude', settings: 'Settings' };
  const crumbs = [
    { label: 'FIST PMS' },
    { label: SECTION[view], onClick: view === 'projects' && openProject ? () => setOpenProject(null) : undefined },
    ...(view === 'projects' && openProject ? [{ label: openProject.name }] : []),
    ...(view === 'report' && route.date && route.date !== todayIso() ? [{ label: formatShort(route.date) }] : []),
  ];

  return (
    <div className="shell">
      <Sidebar
        view={view}
        onNavigate={navigate}
        user={session.loggedIn ? { id: session.userId, name: session.userName } : null}
        onLogout={logout}
      />
      <TopBar
        crumbs={crumbs}
        themes={THEMES}
        theme={appearance.resolved.theme}
        onThemeChange={(id) => appearance.update({ theme: id })}
        refreshing={loading}
        onRefresh={view === 'issues' && session.loggedIn ? loadIssues : null}
      />

      {view === 'settings' ? (
        <main className="page">
          <SettingsView appearance={appearance} />
        </main>
      ) : view === 'claude' ? (
        <main className="page">
          <ConnectClaude />
        </main>
      ) : view === 'dashboard' || view === 'report' ? (
        <main className="page">
          {!session.checked ? null : !session.loggedIn ? (
            <LoginBanner expired={session.expired} loggingIn={loggingIn} onLogin={login} />
          ) : view === 'dashboard' ? (
            <DashboardView
              onOpenIssue={setOpenIssueId}
              onOpenReport={() => navigate('report')}
              onError={handlePanelError}
            />
          ) : (
            <DailyReport
              date={route.date ?? todayIso()}
              userName={session.userName}
              onDateChange={(date) => setRoute((r) => ({ ...r, date, issueId: null }))}
              onOpenIssue={setOpenIssueId}
              onError={handlePanelError}
            />
          )}
        </main>
      ) : view === 'projects' ? (
        <main className="page">
          {!session.checked ? null : !session.loggedIn ? (
            <LoginBanner expired={session.expired} loggingIn={loggingIn} onLogin={login} />
          ) : route.projectId && !openProject ? (
            <div className="drawer-loading page-loading">
              <Loader2 size={22} className="spin" />
            </div>
          ) : openProject ? (
            <ProjectView
              project={openProject}
              lastChange={lastChange}
              reloadKey={projectReload}
              onBack={() => setOpenProject(null)}
              onOpenIssue={setOpenIssueId}
              onNewIssue={(project) => setCreateFor({ parent: null, project })}
              onError={handlePanelError}
              showToast={showToast}
            />
          ) : (
            <ProjectsGrid onOpen={setOpenProject} onError={handlePanelError} />
          )}
        </main>
      ) : (
      <main className="page">
        <div className="page-head">
          <div>
            <h1>My Issues</h1>
            {session.loggedIn && !loading && (
              <p className="subtitle">
                {visible.length === issues.length
                  ? `${issues.length} issues`
                  : `${visible.length} of ${issues.length} issues`}
              </p>
            )}
          </div>
          {session.loggedIn && (
            <button className="primary-btn new-issue-btn" onClick={() => setCreateFor({ parent: null })}>
              <Plus size={16} /> New issue
            </button>
          )}
        </div>

        {!session.checked ? (
          <IssueTable issues={[]} loading savingIds={savingIds} colorFor={colorFor} />
        ) : !session.loggedIn ? (
          <LoginBanner expired={session.expired} loggingIn={loggingIn} onLogin={login} />
        ) : (
          <>
            <Filters
              filters={filters}
              onChange={setFilters}
              scope={scope}
              onScopeChange={setScope}
              projects={projects}
              statuses={statuses}
              colorFor={colorFor}
            />
            {error ? (
              <div className="error-card">
                <AlertOctagon size={20} />
                <div>
                  <strong>Could not load issues</strong>
                  <p>{errorMessage(error)}</p>
                </div>
                <button className="secondary-btn" onClick={loadIssues}>Try again</button>
              </div>
            ) : (
              <IssueTable
                issues={visible}
                loading={loading && issues.length === 0}
                savingIds={savingIds}
                selectedIds={selectedIds}
                selectionLocked={bulkRunning}
                colorFor={colorFor}
                onToggle={toggleSelected}
                onToggleAll={toggleAllVisible}
                onStatusChange={changeStatus}
                onOpen={setOpenIssueId}
              />
            )}
          </>
        )}
      </main>
      )}

      {view === 'issues' && session.loggedIn && selectedVisible.length > 0 && (
        <BulkBar
          issues={selectedVisible}
          running={bulkRunning}
          colorFor={colorFor}
          onApply={(statusName) => bulkUpdate(selectedVisible, statusName)}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {session.loggedIn && openIssueId && (
        <IssueDrawer
          issueId={openIssueId}
          colorFor={colorFor}
          onOpenIssue={setOpenIssueId}
          onClose={closeDrawer}
          onChanged={onDetailChanged}
          onAddSubIssue={(parent) => setCreateFor({ parent })}
          onError={handlePanelError}
        />
      )}

      {session.loggedIn && createFor && (
        <CreateIssueModal
          parent={createFor.parent}
          project={createFor.project}
          userName={session.userName}
          colorFor={colorFor}
          onClose={closeCreate}
          onCreated={onIssueCreated}
          onError={handlePanelError}
        />
      )}

      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}
