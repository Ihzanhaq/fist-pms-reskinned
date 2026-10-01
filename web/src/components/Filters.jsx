import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { todayIso } from '../dates.js';
import DateRangePicker from './DateRangePicker.jsx';
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
  const [dateMenu, setDateMenu] = useState(null);
  const set = (key) => (value) => onChange({ ...filters, [key]: value });
  const today = todayIso();
  const openMenu = (key) => (open) => setDateMenu(open ? key : null);

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
        {showDateFilters && (
          <>
            <DateRangePicker
              variant="filter"
              emptyLabel="Created"
              from={filters.createdFrom}
              to={filters.createdTo}
              max={today}
              capFuture
              open={dateMenu === 'created'}
              onOpenChange={openMenu('created')}
              onChange={(createdFrom, createdTo) => onChange({ ...filters, createdFrom, createdTo })}
              ariaLabel="Created date range"
            />
            <DateRangePicker
              variant="filter"
              emptyLabel="Target"
              from={filters.targetFrom}
              to={filters.targetTo}
              capFuture={false}
              open={dateMenu === 'target'}
              onOpenChange={openMenu('target')}
              onChange={(targetFrom, targetTo) => onChange({ ...filters, targetFrom, targetTo })}
              ariaLabel="Target date range"
            />
          </>
        )}
      </div>
    </div>
  );
}
