import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderOpen, ListChecks, Loader2, Pin, PinOff, Search, X } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import { projectIconLabel } from '../projectDisplay.js';
import Select from './Select.jsx';

const SORTS = {
  name: { label: 'Name A–Z', fn: (a, b) => a.name.localeCompare(b.name) },
  nameDesc: { label: 'Name Z–A', fn: (a, b) => b.name.localeCompare(a.name) },
  most: { label: 'Most issues', fn: (a, b) => (b.issueCount ?? 0) - (a.issueCount ?? 0) || a.name.localeCompare(b.name) },
  fewest: { label: 'Fewest issues', fn: (a, b) => (a.issueCount ?? 0) - (b.issueCount ?? 0) || a.name.localeCompare(b.name) },
  pinned: { label: 'Pinned first', fn: (a, b) => b.pinned - a.pinned || a.name.localeCompare(b.name) },
};

export default function ProjectsGrid({
  title = 'All projects',
  mineOnly = false,
  onOpen,
  onError,
  showToast,
  showCovers = true,
  showEmojis = true,
}) {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('name');
  const [pinning, setPinning] = useState(() => new Set());

  // Optimistic; reverts if the PMS refuses.
  const togglePin = async (p) => {
    const want = !p.pinned;
    const patch = (pinned) => setProjects((list) => list.map((x) => (x.id === p.id ? { ...x, pinned } : x)));
    patch(want);
    setPinning((s) => new Set(s).add(p.id));
    try {
      const { pinned } = await api.setPinned(p.id, want);
      patch(pinned);
      showToast?.('success', `${p.name} ${pinned ? 'pinned' : 'unpinned'}`);
    } catch (err) {
      patch(p.pinned);
      if (err.code === 'session_expired') onError(err);
      showToast?.('error', `Could not ${want ? 'pin' : 'unpin'} ${p.name}: ${errorMessage(err)}`);
    } finally {
      setPinning((s) => {
        const next = new Set(s);
        next.delete(p.id);
        return next;
      });
    }
  };

  const load = useCallback(() => {
    setError(null);
    const fetchProjects = mineOnly ? api.myProjects() : api.projects();
    fetchProjects
      .then(({ projects }) => setProjects(projects))
      .catch((err) => {
        if (err.code === 'session_expired') onError(err);
        setError(err);
      });
  }, [mineOnly, onError]);
  useEffect(() => {
    load();
  }, [load]);

  const pool = projects ?? [];

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    const cmp = SORTS[sort].fn;
    return pool
      .filter((p) => !term || [p.name, p.key, p.description].some((t) => t.toLowerCase().includes(term)))
      .sort((a, b) => (b.pinned - a.pinned) || cmp(a, b));
  }, [pool, q, sort]);

  const sortOptions = useMemo(() => {
    const keys = mineOnly ? Object.keys(SORTS).filter((k) => k !== 'pinned') : Object.keys(SORTS);
    return keys.map((id) => ({ value: id, label: SORTS[id].label }));
  }, [mineOnly]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {projects && (
            <p className="subtitle">
              {visible.length === pool.length
                ? `${pool.length} ${pool.length === 1 ? 'project' : 'projects'}`
                : `${visible.length} of ${pool.length} projects`}
            </p>
          )}
        </div>
      </div>

      <div className="filters">
        <label className="search">
          <Search size={16} />
          <input type="search" placeholder="Search by name, key or description" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button className="search-clear" onClick={() => setQ('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </label>
        <Select
          ariaLabel="Sort projects"
          prefix="Sort:"
          value={sort}
          onChange={setSort}
          options={sortOptions}
        />
      </div>

      {error && (
        <div className="error-card">
          <div>
            <strong>Could not load projects</strong>
            <p>{errorMessage(error)}</p>
          </div>
          <button className="secondary-btn" onClick={load}>Try again</button>
        </div>
      )}

      {!projects && !error && (
        <div className="project-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="project-card skeleton-card">
              <span className="bone" style={{ width: 40, height: 40 }} />
              <span className="bone" style={{ width: '60%' }} />
              <span className="bone" style={{ width: '90%' }} />
            </div>
          ))}
        </div>
      )}

      {projects && visible.length === 0 && (
        <div className="empty">
          <FolderOpen size={28} />
          <p>
            {q
              ? `No projects match “${q}”`
              : mineOnly
                ? 'No projects with your active issues. When you’re assigned work, those projects appear here.'
                : 'No projects found.'}
          </p>
        </div>
      )}

      {projects && visible.length > 0 && (
        <div className="project-grid">
          {visible.map((p) => (
            <div
              key={p.id}
              className={[
                'project-card',
                showCovers && 'has-cover',
                p.pinned && 'is-pinned',
                !showCovers && 'no-cover',
              ]
                .filter(Boolean)
                .join(' ')}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(p)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), onOpen(p))}
            >
              {showCovers && (
                <div className="project-cover" style={{ '--c': p.color ?? '#059669' }}>
                  {p.hasCover && <img src={`/api/project-covers/${p.id}`} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} />}
                  <button
                    className={p.pinned ? 'pin-btn on' : 'pin-btn'}
                    title={p.pinned ? 'Unpin' : 'Pin to your list'}
                    aria-label={p.pinned ? `Unpin ${p.name}` : `Pin ${p.name}`}
                    aria-pressed={p.pinned}
                    disabled={pinning.has(p.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(p);
                    }}
                  >
                    {pinning.has(p.id) ? <Loader2 size={14} className="spin" /> : p.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                  </button>
                </div>
              )}
              <div className="project-card-top">
                <span className="project-icon" style={{ '--c': p.color ?? '#059669' }}>
                  {projectIconLabel(p, showEmojis)}
                </span>
                {showCovers ? (
                  p.pinned && <Pin size={14} className="pinned" aria-label="Pinned" />
                ) : (
                  <button
                    className={p.pinned ? 'pin-btn on pin-btn-inline' : 'pin-btn pin-btn-inline'}
                    title={p.pinned ? 'Unpin' : 'Pin to your list'}
                    aria-label={p.pinned ? `Unpin ${p.name}` : `Pin ${p.name}`}
                    aria-pressed={p.pinned}
                    disabled={pinning.has(p.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(p);
                    }}
                  >
                    {pinning.has(p.id) ? <Loader2 size={14} className="spin" /> : p.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                  </button>
                )}
              </div>
              <div className="project-name-row">
                <strong>{p.name}</strong>
                {p.key && <span className="key">{p.key}</span>}
              </div>
              <p className="project-desc">{p.description || 'No description'}</p>
              {p.issueCount !== null && (
                <span className="project-count">
                  <ListChecks size={14} /> {p.issueCount}{' '}
                  {mineOnly
                    ? p.issueCount === 1
                      ? 'your issue'
                      : 'your issues'
                    : p.issueCount === 1
                      ? 'issue'
                      : 'issues'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
