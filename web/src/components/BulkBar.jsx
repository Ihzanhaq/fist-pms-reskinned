import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { loadStates } from '../api.js';

// Statuses differ per project, so offer every status name found across the
// selected issues' projects and say when one is not available everywhere.
function useStatusOptions(issues) {
  const [options, setOptions] = useState(null);
  const projectKey = [...new Set(issues.map((i) => i.projectId))].sort().join(',');

  useEffect(() => {
    let live = true;
    setOptions(null);
    const onePerProject = [...new Map(issues.map((i) => [i.projectId, i])).values()];
    Promise.allSettled(onePerProject.map(loadStates)).then((results) => {
      if (!live) return;
      const byName = new Map();
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        for (const s of r.value) {
          const key = s.name.toLowerCase();
          const entry = byName.get(key) ?? { name: s.name, projects: 0 };
          entry.projects += 1;
          byName.set(key, entry);
        }
      }
      setOptions({ list: [...byName.values()], total: onePerProject.length });
    });
    return () => {
      live = false;
    };
    // Re-run only when the set of projects changes, not on every selection change.
  }, [projectKey]);

  return options;
}

export default function BulkBar({ issues, running, onApply, onClear }) {
  const options = useStatusOptions(issues);
  const [choice, setChoice] = useState('');

  return (
    <div className="bulkbar" role="region" aria-label="Bulk actions">
      <span className="bulk-count">
        <strong>{issues.length}</strong> selected
      </span>
      <span className="bulk-sep" />
      <span className="bulk-label">Move to</span>
      <select
        className="filter-select bulk-select"
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        disabled={!options || running}
        aria-label="New status"
      >
        <option value="">{options ? 'Choose status…' : 'Loading statuses…'}</option>
        {options?.list.map((o) => (
          <option key={o.name} value={o.name}>
            {o.name}
            {o.projects < options.total ? ` (${o.projects} of ${options.total} projects)` : ''}
          </option>
        ))}
      </select>
      <button className="primary-btn bulk-apply" disabled={!choice || running} onClick={() => onApply(choice)}>
        {running ? (
          <>
            <Loader2 size={16} className="spin" /> Updating…
          </>
        ) : (
          'Apply'
        )}
      </button>
      <button className="icon-btn bulk-close" onClick={onClear} disabled={running} title="Clear selection">
        <X size={17} />
      </button>
    </div>
  );
}
