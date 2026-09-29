import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, ListChecks, Pin, Search, X } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import Select from './Select.jsx';

const SORTS = {
  name: { label: 'Name A–Z', fn: (a, b) => a.name.localeCompare(b.name) },
  nameDesc: { label: 'Name Z–A', fn: (a, b) => b.name.localeCompare(a.name) },
  most: { label: 'Most issues', fn: (a, b) => (b.issueCount ?? 0) - (a.issueCount ?? 0) || a.name.localeCompare(b.name) },
  fewest: { label: 'Fewest issues', fn: (a, b) => (a.issueCount ?? 0) - (b.issueCount ?? 0) || a.name.localeCompare(b.name) },
  pinned: { label: 'Pinned first', fn: (a, b) => b.pinned - a.pinned || a.name.localeCompare(b.name) },
};

export default function ProjectsGrid({ onOpen, onError }) {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('name');

  const load = () => {
    setError(null);
    api
      .projects()
      .then(({ projects }) => setProjects(projects))
      .catch((err) => {
        if (err.code === 'session_expired') onError(err);
        setError(err);
      });
  };
  useEffect(load, []); // load once on mount

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (projects ?? [])
      .filter((p) => !term || [p.name, p.key, p.description].some((t) => t.toLowerCase().includes(term)))
      .sort(SORTS[sort].fn);
  }, [projects, q, sort]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          {projects && (
            <p className="subtitle">
              {visible.length === projects.length ? `${projects.length} projects` : `${visible.length} of ${projects.length} projects`}
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
          options={Object.entries(SORTS).map(([id, s]) => ({ value: id, label: s.label }))}
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
          <p>No projects match “{q}”</p>
        </div>
      )}

      {projects && visible.length > 0 && (
        <div className="project-grid">
          {visible.map((p) => (
            <button key={p.id} className="project-card" onClick={() => onOpen(p)}>
              <div className="project-card-top">
                <span className="project-icon" style={{ '--c': p.color ?? '#8b6fe8' }}>{p.icon || p.name[0] || '?'}</span>
                {p.pinned && <Pin size={14} className="pinned" aria-label="Pinned" />}
              </div>
              <div className="project-name-row">
                <strong>{p.name}</strong>
                {p.key && <span className="key">{p.key}</span>}
              </div>
              <p className="project-desc">{p.description || 'No description'}</p>
              {p.issueCount !== null && (
                <span className="project-count">
                  <ListChecks size={14} /> {p.issueCount} {p.issueCount === 1 ? 'issue' : 'issues'}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
