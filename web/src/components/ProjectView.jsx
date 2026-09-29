import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ExternalLink, Inbox, Plus, RefreshCw, Search, Users, X } from 'lucide-react';
import { api, errorMessage, seedStates } from '../api.js';
import { PMS_BASE } from '../richText.js';
import Pagination from './Pagination.jsx';
import AssigneeSelect from './AssigneeSelect.jsx';
import Select from './Select.jsx';
import StatusSelect from './StatusSelect.jsx';

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
const PRIORITY_COLORS = { urgent: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#2f7de1', none: '#9ca3af' };
const UNASSIGNED = '__unassigned__';
const dateValue = (d) => (d ? Date.parse(d) || Infinity : Infinity);

const SORTS = {
  default: { label: 'PMS order', fn: () => 0 },
  keyDesc: { label: 'Newest key', fn: (a, b) => keyNum(b) - keyNum(a) },
  keyAsc: { label: 'Oldest key', fn: (a, b) => keyNum(a) - keyNum(b) },
  priority: { label: 'Priority', fn: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] },
  target: { label: 'Target date', fn: (a, b) => dateValue(a.targetDate) - dateValue(b.targetDate) },
  status: { label: 'Status', fn: (a, b) => a.status.name.localeCompare(b.status.name) },
  assignee: { label: 'Assignee', fn: (a, b) => (a.assignee?.name ?? '~').localeCompare(b.assignee?.name ?? '~') },
  title: { label: 'Title A–Z', fn: (a, b) => a.title.localeCompare(b.title) },
};
function keyNum(issue) {
  return Number(issue.key.split('-').pop()) || 0;
}

const EMPTY_FILTERS = { q: '', status: 'all', priority: 'all', assignee: 'all', overdue: false };

export default function ProjectView({ project, lastChange, reloadKey, onBack, onOpenIssue, onNewIssue, onError, showToast }) {
  const [data, setData] = useState(null); // { issues, states, assignees }
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState('default');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [savingIds, setSavingIds] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.projectIssues(project.id);
      seedStates(project.id, result.states);
      setData({ ...result, issues: result.issues.map((i) => ({ ...i, projectId: project.id })) });
    } catch (err) {
      if (err.code === 'session_expired') onError(err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [project.id, onError]);

  useEffect(() => {
    setData(null);
    setFilters(EMPTY_FILTERS);
    setPage(1);
    load();
  }, [load]);

  // Reload after a new issue is created, keeping filters and page.
  useEffect(() => {
    if (reloadKey) load();
  }, [reloadKey]); // only when a reload is requested

  const patchIssue = (id, patch) =>
    setData((d) => d && { ...d, issues: d.issues.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

  // Edits made in the detail panel.
  useEffect(() => {
    if (lastChange) patchIssue(lastChange.id, lastChange.patch);
  }, [lastChange]);

  useEffect(() => setPage(1), [filters, sort, pageSize]);

  const statusColors = useMemo(() => {
    const map = new Map();
    for (const i of data?.issues ?? []) if (i.status.color) map.set(i.status.name.toLowerCase(), i.status.color);
    return map;
  }, [data]);
  const colorFor = useCallback((name) => statusColors.get(name.toLowerCase()) ?? null, [statusColors]);

  const setSaving = (key, on) =>
    setSavingIds((s) => {
      const next = new Set(s);
      on ? next.add(key) : next.delete(key);
      return next;
    });

  // person null = unassign. Optimistic; reverts if the PMS refuses.
  const changeAssignee = async (issue, person) => {
    const previous = issue.assignee;
    patchIssue(issue.id, { assignee: person });
    setSaving(`a:${issue.id}`, true);
    try {
      const fresh = await api.setAssignee(issue.id, person?.id ?? '');
      patchIssue(issue.id, { assignee: fresh.assignee });
      showToast('success', `${issue.key} ${fresh.assignee ? `assigned to ${fresh.assignee.name}` : 'unassigned'}`);
    } catch (err) {
      patchIssue(issue.id, { assignee: previous });
      if (err.code === 'session_expired') onError(err);
      showToast('error', `Could not reassign ${issue.key}: ${errorMessage(err)}`);
    } finally {
      setSaving(`a:${issue.id}`, false);
    }
  };

  const changeStatus = async (issue, state) => {
    const previous = issue.status;
    patchIssue(issue.id, { status: { name: state.name, color: colorFor(state.name) } });
    setSavingIds((s) => new Set(s).add(issue.id));
    try {
      const { status } = await api.setState(issue.id, state.id);
      patchIssue(issue.id, { status: { name: status.name, color: colorFor(status.name) } });
      showToast('success', `${issue.key} moved to ${status.name}`);
    } catch (err) {
      patchIssue(issue.id, { status: previous });
      if (err.code === 'session_expired') onError(err);
      showToast('error', `Could not update ${issue.key}: ${errorMessage(err)}`);
    } finally {
      setSavingIds((s) => {
        const next = new Set(s);
        next.delete(issue.id);
        return next;
      });
    }
  };

  // Workload per person, busiest first.
  const team = useMemo(() => {
    const counts = new Map();
    for (const i of data?.issues ?? []) {
      const key = i.assignee?.name ?? UNASSIGNED;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const statuses = useMemo(() => [...new Set((data?.issues ?? []).map((i) => i.status.name))], [data]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const list = (data?.issues ?? []).filter(
      (i) =>
        (!q || i.key.toLowerCase().includes(q) || i.title.toLowerCase().includes(q)) &&
        (filters.status === 'all' || i.status.name === filters.status) &&
        (filters.priority === 'all' || i.priority === filters.priority) &&
        (filters.assignee === 'all' || (i.assignee?.name ?? UNASSIGNED) === filters.assignee) &&
        (!filters.overdue || i.overdue),
    );
    return sort === 'default' ? list : [...list].sort(SORTS[sort].fn);
  }, [data, filters, sort]);

  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={15} /> All projects
      </button>

      <div className="project-head">
        <span className="project-icon large" style={{ '--c': project.color ?? '#8b6fe8' }}>
          {project.icon || project.name[0] || '?'}
        </span>
        <div className="project-head-text">
          <h1>
            {project.name} {project.key && <span className="key">{project.key}</span>}
          </h1>
          {project.description && <p className="subtitle">{project.description}</p>}
        </div>
        <div className="project-head-actions">
          <button className="icon-btn" onClick={load} disabled={loading} title="Reload issues">
            <RefreshCw size={17} className={loading ? 'spin' : undefined} />
          </button>
          <a className="secondary-btn" href={`${PMS_BASE}/projects/${project.id}`} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> Open in PMS
          </a>
          <button className="primary-btn new-issue-btn" onClick={() => onNewIssue(project)}>
            <Plus size={16} /> New issue
          </button>
        </div>
      </div>

      {data && team.length > 0 && (
        <div className="team">
          <span className="team-label">
            <Users size={14} /> Team
          </span>
          {team.map(([name, count]) => {
            const active = filters.assignee === name;
            return (
              <button
                key={name}
                className={active ? 'team-chip active' : 'team-chip'}
                onClick={() => set('assignee')(active ? 'all' : name)}
                title={active ? 'Show everyone' : `Show only ${name === UNASSIGNED ? 'unassigned' : name}`}
              >
                <span className="avatar tiny">{name === UNASSIGNED ? '–' : name[0].toUpperCase()}</span>
                {name === UNASSIGNED ? 'Unassigned' : name}
                <span className="team-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="filters">
        <label className="search">
          <Search size={16} />
          <input type="search" placeholder="Search by key or title" value={filters.q} onChange={(e) => set('q')(e.target.value)} />
          {filters.q && (
            <button className="search-clear" onClick={() => set('q')('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </label>
        <div className="filter-group">
          <Select
            ariaLabel="Status"
            value={filters.status}
            onChange={set('status')}
            options={[
              { value: 'all', label: 'All statuses' },
              ...statuses.map((s) => ({ value: s, label: s, dot: colorFor(s) ?? '#94a3b8' })),
            ]}
          />
          <Select
            ariaLabel="Priority"
            value={filters.priority}
            onChange={set('priority')}
            options={[
              { value: 'all', label: 'All priorities' },
              ...Object.keys(PRIORITY_RANK).map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1), dot: PRIORITY_COLORS[p] })),
            ]}
          />
          <Select
            ariaLabel="Assignee"
            value={filters.assignee}
            onChange={set('assignee')}
            options={[
              { value: 'all', label: 'Everyone' },
              ...team.map(([n, count]) => ({ value: n, label: n === UNASSIGNED ? 'Unassigned' : n, hint: String(count) })),
            ]}
          />
          <Select
            ariaLabel="Sort"
            prefix="Sort:"
            value={sort}
            onChange={setSort}
            options={Object.entries(SORTS).map(([id, s]) => ({ value: id, label: s.label }))}
          />
          <button
            className={filters.overdue ? 'toggle-btn on' : 'toggle-btn'}
            onClick={() => set('overdue')(!filters.overdue)}
            aria-pressed={filters.overdue}
          >
            <AlertTriangle size={14} /> Overdue
          </button>
          {filtersActive && (
            <button className="link-btn" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-card">
          <div>
            <strong>Could not load this project</strong>
            <p>{errorMessage(error)}</p>
          </div>
          <button className="secondary-btn" onClick={load}>Try again</button>
        </div>
      )}

      {!error && (
        <div className="table project-table">
          <div className="table-head">
            <span>Key</span>
            <span>Title</span>
            <span>Assignee</span>
            <span>Priority</span>
            <span>Target</span>
            <span>Status</span>
          </div>

          {!data &&
            Array.from({ length: 8 }, (_, i) => (
              <div className="row skeleton" key={i}>
                {Array.from({ length: 6 }, (_, j) => (
                  <span key={j} className="bone" />
                ))}
              </div>
            ))}

          {data && filtered.length === 0 && (
            <div className="empty">
              <Inbox size={28} />
              <p>{data.issues.length ? 'No issues match these filters' : 'This project has no issues yet'}</p>
            </div>
          )}

          {pageItems.map((issue) => (
            <div className="row" key={issue.id}>
              <span className="key">{issue.key}</span>
              <button className="title" onClick={() => onOpenIssue(issue.id)} title={issue.title}>
                {issue.title}
              </button>
              <AssigneeSelect
                issue={issue}
                people={data.assignees}
                saving={savingIds.has(`a:${issue.id}`)}
                onChange={changeAssignee}
              />
              <span className={`priority priority-${issue.priority}`}>{issue.priority}</span>
              <span className={issue.overdue ? 'target overdue' : 'target'}>
                {issue.overdue && <AlertTriangle size={13} />}
                {issue.targetDate ?? '—'}
              </span>
              <StatusSelect issue={issue} colorFor={colorFor} saving={savingIds.has(issue.id)} onChange={changeStatus} />
            </div>
          ))}
        </div>
      )}

      {data && filtered.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={setPageSize} />
      )}
    </>
  );
}
