import { Search, X } from 'lucide-react';
import { todayIso } from '../dates.js';
import DatePicker from './DatePicker.jsx';
import Select from './Select.jsx';

export default function Filters({
  filters,
  onChange,
  scope,
  onScopeChange,
  projects,
  statuses,
  colorFor,
  showDateFilters = false,
}) {
  const set = (key) => (value) => onChange({ ...filters, [key]: value });
  const today = todayIso();
  const datesActive =
    filters.createdFrom ||
    filters.createdTo ||
    filters.targetFrom ||
    filters.targetTo;

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
        <Select
          ariaLabel="Project"
          value={filters.project}
          onChange={set('project')}
          options={[{ value: 'all', label: 'All projects' }, ...projects.map((p) => ({ value: p, label: p }))]}
        />
        <Select
          ariaLabel="Status"
          value={filters.status}
          onChange={set('status')}
          options={[
            { value: 'all', label: 'All statuses' },
            ...statuses.map((s) => ({ value: s, label: s, dot: colorFor?.(s) ?? '#94a3b8' })),
          ]}
        />
        <Select
          ariaLabel="Scope"
          value={scope}
          onChange={onScopeChange}
          options={[
            { value: 'active', label: 'Active only' },
            { value: 'all', label: 'Include completed' },
          ]}
        />
      </div>
      {showDateFilters && (
        <div className="filter-dates">
          <div className="filter-date-row">
            <span className="filter-date-label">Created</span>
            <DatePicker
              ariaLabel="Created from"
              placeholder="From"
              value={filters.createdFrom}
              max={filters.createdTo || today}
              onChange={set('createdFrom')}
            />
            <DatePicker
              ariaLabel="Created to"
              placeholder="To"
              value={filters.createdTo}
              min={filters.createdFrom || undefined}
              max={today}
              onChange={set('createdTo')}
            />
          </div>
          <div className="filter-date-row">
            <span className="filter-date-label">Target</span>
            <DatePicker
              ariaLabel="Target from"
              placeholder="From"
              value={filters.targetFrom}
              max={filters.targetTo || undefined}
              onChange={set('targetFrom')}
            />
            <DatePicker
              ariaLabel="Target to"
              placeholder="To"
              value={filters.targetTo}
              min={filters.targetFrom || undefined}
              onChange={set('targetTo')}
            />
          </div>
          {datesActive && (
            <button
              type="button"
              className="link-btn filter-date-clear"
              onClick={() =>
                onChange({
                  ...filters,
                  createdFrom: '',
                  createdTo: '',
                  targetFrom: '',
                  targetTo: '',
                })
              }
            >
              Clear dates
            </button>
          )}
        </div>
      )}
    </div>
  );
}
