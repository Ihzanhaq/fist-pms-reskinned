import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertOctagon } from 'lucide-react';
import { api, errorMessage } from './api.js';
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

  const showToast = useCallback((kind, text) => setToast({ kind, text }), []);
  const clearToast = useCallback(() => setToast(null), []);

  const handleError = useCallback((err) => {
    if (err.code === 'session_expired') {
      setSession((s) => ({ ...s, loggedIn: false, expired: true }));
    } else {
      setError(err);
    }
  }, []);

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

  const changeStatus = async (issue, state) => {
    const previous = issue.status;
    updateIssue(issue.id, { status: { name: state.name, color: colorFor(state.name) } });
    setSaving(issue.id, true);
    try {
      const { status } = await api.setState(issue.id, state.id);
      updateIssue(issue.id, { status: { name: status.name, color: colorFor(status.name) } });
      showToast('success', `${issue.key} moved to ${status.name}`);
    } catch (err) {
      updateIssue(issue.id, { status: previous });
      if (err.code === 'session_expired') handleError(err);
      showToast('error', `Could not update ${issue.key}: ${errorMessage(err)}`);
    } finally {
      setSaving(issue.id, false);
    }
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

  return (
    <div className="shell">
      <TopBar
        userName={session.userName}
        loggedIn={session.loggedIn}
        refreshing={loading}
        onRefresh={loadIssues}
        onLogout={logout}
      />
      <Sidebar />

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
          <div className="crumbs">
            FIST PMS <span>›</span> <strong>My Issues</strong>
          </div>
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
                colorFor={colorFor}
                onStatusChange={changeStatus}
              />
            )}
          </>
        )}
      </main>

      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}
