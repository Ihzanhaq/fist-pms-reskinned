import { Search, X } from 'lucide-react';

function Select({ label, value, onChange, children }) {
  return (
    <select className="filter-select" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  );
}

export default function Filters({ filters, onChange, scope, onScopeChange, projects, statuses }) {
  const set = (key) => (value) => onChange({ ...filters, [key]: value });

  return (
    <div className="filters">
      <label className="search">
        <Search size={16} />
        <input
          type="search"
          placeholder="Search by key or title"
          value={filters.q}
          onChange={(e) => set('q')(e.target.value)}
        />
        {filters.q && (
          <button className="search-clear" onClick={() => set('q')('')} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </label>
      <div className="filter-group">
        <Select label="Project" value={filters.project} onChange={set('project')}>
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </Select>
        <Select label="Status" value={filters.status} onChange={set('status')}>
          <option value="all">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <Select label="Scope" value={scope} onChange={onScopeChange}>
          <option value="active">Active only</option>
          <option value="all">Include completed</option>
        </Select>
      </div>
    </div>
  );
}
