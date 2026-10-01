import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertOctagon, Loader2, Plus } from 'lucide-react';
import { api, errorMessage } from './api.js';
import { commitRoute, getRoute, useRoute } from './route.js';
import { DEFAULT_DISPLAY, THEMES, useAppearance } from './theme.js';
import BulkBar from './components/BulkBar.jsx';
import { runBulk } from './bulk.js';
import ConnectClaude from './components/ConnectClaude.jsx';
import SettingsView from './components/SettingsView.jsx';
import WelcomeTour, { hasSeenTour, markTourSeen } from './components/WelcomeTour.jsx';
import SignInScreen, { Splash } from './components/SignInScreen.jsx';
import LeaderboardView from './components/LeaderboardView.jsx';
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
import KanbanBoard, { ViewSwitch, saveView } from './components/KanbanBoard.jsx';
import LoginBanner from './components/LoginBanner.jsx';
import Toast from './components/Toast.jsx';
import { matchIssueDates } from './issueFilters.js';

const EMPTY_FILTERS = {
  q: '',
  project: 'all',
  status: 'all',
  createdFrom: '',
  createdTo: '',
  targetFrom: '',
  targetTo: '',
};
const uniqueSorted = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const stubProject = (p) => ({
  id: p.id,
  name: p.name,
  key: p.key ?? '',
  description: p.description ?? '',
  issueCount: null,
  icon: p.icon ?? '',
  color: p.color ?? null,
  pinned: true,
  hasCover: false,
});

export default function App() {
  const [session, setSession] = useState({ checked: false, loggedIn: false, expired: false, userName: '' });
  const [loggingIn, setLoggingIn] = useState(false);
  const { route, patchRoute, navigate } = useRoute();

  // Fill in default query params (e.g. report date) once, without adding a history entry.
  useEffect(() => {
    commitRoute(getRoute(), { replace: true });
  }, []);
  const scope = route.scope;
  const issueView = route.layout;
  const filters = useMemo(
    () => ({
      q: route.q,
      project: route.filterProject,
      status: route.filterStatus,
      createdFrom: route.createdFrom,
      createdTo: route.createdTo,
      targetFrom: route.targetFrom,
      targetTo: route.targetTo,
    }),
    [route.q, route.filterProject, route.filterStatus, route.createdFrom, route.createdTo, route.targetFrom, route.targetTo],
  );
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savingIds, setSavingIds] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const appearance = useAppearance();
  const [tourOpen, setTourOpen] = useState(false);
  const [projectCard, setProjectCard] = useState(null); // card for route.projectId
  const [lastChange, setLastChange] = useState(null); // latest edit from the detail panel
  const [projectReload, setProjectReload] = useState(0);
  const [createFor, setCreateFor] = useState(null); // null = closed, { parent } = open

  const { view, issueId: openIssueId } = route;
  const projectDisplay = { ...DEFAULT_DISPLAY, ...appearance.settings.display };
  const openProject = route.projectId && projectCard?.id === route.projectId ? projectCard : null;

  const setOpenIssueId = useCallback(
    (issueId) => patchRoute({ issueId: issueId ?? null }),
    [patchRoute],
  );
  const setOpenProject = useCallback(
    (card) => {
      if (card) {
        setProjectCard(card);
        patchRoute({ projectId: card.id, issueId: null });
      } else {
        patchRoute({ projectId: null });
      }
    },
    [patchRoute],
  );

  const openProjectFromIssue = useCallback(
    (project) => {
      setProjectCard(stubProject(project));
      patchRoute({ view: 'projects', projectId: project.id, issueId: null });
    },
    [patchRoute],
  );

  const setScope = useCallback((next) => patchRoute({ scope: next }), [patchRoute]);
  const setFilters = useCallback(
    (next) =>
      patchRoute({
        q: next.q,
        filterProject: next.project,
        filterStatus: next.status,
        createdFrom: next.createdFrom,
        createdTo: next.createdTo,
        targetFrom: next.targetFrom,
        targetTo: next.targetTo,
      }),
    [patchRoute],
  );
  const setIssueView = useCallback(
    (layout) => {
      saveView(layout);
      patchRoute({ layout });
    },
    [patchRoute],
  );

  // After a refresh only the project id is in the URL; look up its card (keep the URL either way).
  useEffect(() => {
    if (!route.projectId || projectCard?.id === route.projectId || !session.loggedIn) return;
    if (view !== 'projects' && view !== 'my-projects') return;
    let live = true;
    const primary = view === 'my-projects' ? api.myProjects() : api.projects();
    const secondary = view === 'my-projects' ? api.projects() : api.myProjects();
    primary
      .then(({ projects }) => {
        if (!live) return;
        const card = projects.find((p) => p.id === route.projectId);
        if (card) {
          setProjectCard(card);
          return;
        }
        return secondary.then(({ projects: more }) => {
          if (!live) return;
          const fallback = more.find((p) => p.id === route.projectId);
          if (fallback) setProjectCard(fallback);
          else setProjectCard(stubProject({ id: route.projectId, name: 'Project', key: '' }));
        });
      })
      .catch(() => {
        if (live) setProjectCard(stubProject({ id: route.projectId, name: 'Project', key: '' }));
      });
    return () => {
      live = false;
    };
  }, [route.projectId, projectCard, session.loggedIn, view]);

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

  // `browser` comes from the sign-in screen's picker; buttons elsewhere pass a click event.
  const login = async (browser) => {
    setLoggingIn(true);
    try {
      const s = await api.login(typeof browser === 'string' ? browser : undefined);
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

  const bulkUpdate = async (targets, change) => {
    setBulkRunning(true);
    targets.forEach((i) => setSaving(i.id, true));
    const { message, failed } = await runBulk(targets, change, { patch: updateIssue, colorFor, onError: handleError });
    targets.forEach((i) => setSaving(i.id, false));
    setBulkRunning(false);
    // Keep only failures selected so they can be retried.
    setSelectedIds(new Set(failed.map((i) => i.id)));
    showToast(failed.length ? 'error' : 'success', message);
    // Reassigned issues may no longer be yours.
    if (change.person !== undefined) loadIssues();
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
        (!q || i.key.toLowerCase().includes(q) || i.title.toLowerCase().includes(q)) &&
        matchIssueDates(i, filters),
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

  const SECTION = {
    dashboard: 'Dashboard',
    issues: 'My Issues',
    'my-projects': 'My projects',
    projects: 'All projects',
    report: 'Daily report',
    claude: 'Connect to Claude',
    settings: 'Settings',
    leaderboard: 'Leaderboard',
  };
  const projectListView = view === 'my-projects' || view === 'projects';
  const crumbs = [
    { label: 'FIST PMS' },
    {
      label: SECTION[view],
      onClick: projectListView && openProject ? () => setOpenProject(null) : undefined,
    },
    ...(projectListView && openProject ? [{ label: openProject.name }] : []),
    ...(view === 'report' && route.date && route.date !== todayIso() ? [{ label: formatShort(route.date) }] : []),
  ];

  // The welcome tour shows once per person (remembered in this browser).
  const tourUser = session.userId || session.userName;
  useEffect(() => {
    if (session.loggedIn && tourUser && !hasSeenTour(tourUser)) setTourOpen(true);
  }, [session.loggedIn, tourUser]);
  const closeTour = useCallback(() => {
    markTourSeen(tourUser);
    setTourOpen(false);
  }, [tourUser]);

  // Until we know whether the user is signed in, show the logo; if they aren't, a full sign-in screen.
  if (!session.checked) return <Splash />;
  if (!session.loggedIn) {
    return (
      <>
        <SignInScreen
          expired={session.expired}
          loggingIn={loggingIn}
          onLogin={login}
          themes={THEMES}
          theme={appearance.resolved.theme}
          onThemeChange={(id) => appearance.update({ theme: id })}
        />
        <Toast toast={toast} onDone={clearToast} />
      </>
    );
  }

  return (
    <div className={session.loggedIn ? 'shell' : 'shell no-sidebar'}>
      {session.loggedIn && (
        <Sidebar
          view={view}
          activeProjectId={route.projectId}
          onNavigate={navigate}
          user={{ id: session.userId, name: session.userName }}
          onLogout={logout}
        />
      )}
      <TopBar
        crumbs={crumbs}
        themes={THEMES}
        theme={appearance.resolved.theme}
        onThemeChange={(id) => appearance.update({ theme: id })}
        refreshing={loading}
        onRefresh={view === 'issues' && session.loggedIn ? loadIssues : null}
      />

      {view === 'leaderboard' ? (
        <main className="page">
          {!session.checked ? null : !session.loggedIn ? (
            <LoginBanner expired={session.expired} loggingIn={loggingIn} onLogin={login} />
          ) : (
            <LeaderboardView
              period={route.period}
              rangeFrom={route.lbFrom}
              rangeTo={route.lbTo}
              projectId={route.lbProject}
              onPeriodChange={(period) => {
                if (period === 'custom') {
                  const today = todayIso();
                  patchRoute({
                    period,
                    lbFrom: route.lbFrom ?? `${today.slice(0, 7)}-01`,
                    lbTo: route.lbTo ?? today,
                  });
                } else {
                  patchRoute({ period, lbFrom: null, lbTo: null });
                }
              }}
              onRangeChange={(lbFrom, lbTo) => patchRoute({ period: 'custom', lbFrom, lbTo })}
              onProjectChange={(lbProject) => patchRoute({ lbProject })}
              userName={session.userName}
              onError={handlePanelError}
            />
          )}
        </main>
      ) : view === 'settings' ? (
        <main className="page">
          <SettingsView appearance={appearance} onShowTour={() => setTourOpen(true)} />
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
              days={route.days}
              onDaysChange={(days) => patchRoute({ days })}
              onOpenIssue={setOpenIssueId}
              onOpenReport={() => navigate('report')}
              onError={handlePanelError}
            />
          ) : (
            <DailyReport
              date={route.date ?? todayIso()}
              userName={session.userName}
              onDateChange={(date) => patchRoute({ date, issueId: null })}
              onOpenIssue={setOpenIssueId}
              onError={handlePanelError}
            />
          )}
        </main>
      ) : view === 'projects' || view === 'my-projects' ? (
        <main className="page">
          {!session.checked ? null : !session.loggedIn ? (
            <LoginBanner expired={session.expired} loggingIn={loggingIn} onLogin={login} />
          ) : route.projectId && !projectCard ? (
            <div className="drawer-loading page-loading">
              <Loader2 size={22} className="spin" />
            </div>
          ) : openProject || route.projectId ? (
            <ProjectView
              project={openProject ?? stubProject({ id: route.projectId, name: 'Project', key: '' })}
              routeQuery={route}
              onRouteQueryChange={patchRoute}
              lastChange={lastChange}
              reloadKey={projectReload}
              onBack={() => setOpenProject(null)}
              backLabel={view === 'my-projects' ? 'My projects' : 'All projects'}
              onOpenIssue={setOpenIssueId}
              onNewIssue={(project) => setCreateFor({ parent: null, project })}
              onError={handlePanelError}
              showToast={showToast}
              showEmojis={projectDisplay.projectEmojis}
            />
          ) : (
            <ProjectsGrid
              title={view === 'my-projects' ? 'My projects' : 'All projects'}
              mineOnly={view === 'my-projects'}
              onOpen={setOpenProject}
              onError={handlePanelError}
              showToast={showToast}
              showCovers={projectDisplay.projectCovers}
              showEmojis={projectDisplay.projectEmojis}
            />
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
          {session.loggedIn && <ViewSwitch view={issueView} onChange={setIssueView} />}
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
              showDateFilters
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
            ) : issueView === 'board' ? (
              <KanbanBoard
                issues={visible}
                loading={loading && issues.length === 0}
                savingIds={savingIds}
                colorFor={colorFor}
                showProject
                onStatusChange={changeStatus}
                onOpen={setOpenIssueId}
                onMoveError={(msg) => showToast('error', msg)}
              />
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
          onApply={(change) => bulkUpdate(selectedVisible, change)}
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
          onGoToIssues={() => navigate('issues')}
          onOpenProject={openProjectFromIssue}
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

      {tourOpen && (
        <WelcomeTour
          userName={session.userName}
          onClose={closeTour}
          onNavigate={(next) => {
            closeTour();
            navigate(next);
          }}
        />
      )}

      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}
