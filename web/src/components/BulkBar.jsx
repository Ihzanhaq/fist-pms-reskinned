import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { loadPeople, loadStates } from '../api.js';
import Select from './Select.jsx';

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

// Everyone assignable in any of the selected issues' projects.
function usePeopleOptions(issues) {
  const [options, setOptions] = useState(null);
  const projectKey = [...new Set(issues.map((i) => i.projectId))].sort().join(',');

  useEffect(() => {
    let live = true;
    setOptions(null);
    const onePerProject = [...new Map(issues.map((i) => [i.projectId, i])).values()];
    Promise.allSettled(onePerProject.map(loadPeople)).then((results) => {
      if (!live) return;
      const byId = new Map();
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        for (const p of r.value) {
          const entry = byId.get(p.id) ?? { person: p, projects: 0 };
          entry.projects += 1;
          byId.set(p.id, entry);
        }
      }
      const list = [...byId.values()].sort((a, b) => a.person.name.localeCompare(b.person.name));
      setOptions({ list, total: onePerProject.length });
    });
    return () => {
      live = false;
    };
  }, [projectKey]);

  return options;
}

const UNASSIGN = '__unassign__';

export default function BulkBar({ issues, running, colorFor, onApply, onClear }) {
  const options = useStatusOptions(issues);
  const people = usePeopleOptions(issues);
  const [choice, setChoice] = useState('');
  const [assignee, setAssignee] = useState('');

  const apply = () => {
    const person =
      assignee === '' ? undefined : assignee === UNASSIGN ? null : people.list.find((o) => o.person.id === assignee).person;
    onApply({ status: choice, person });
    setChoice('');
    setAssignee('');
  };

  return (
    <div className="bulkbar" role="region" aria-label="Bulk actions">
      <span className="bulk-count">
        <strong>{issues.length}</strong> selected
      </span>
      <span className="bulk-sep" />
      <span className="bulk-label">Move to</span>
      <Select
        ariaLabel="New status"
        placeholder={options ? 'Choose status…' : 'Loading statuses…'}
        value={choice}
        onChange={setChoice}
        disabled={!options || running}
        options={(options?.list ?? []).map((o) => ({
          value: o.name,
          label: o.name,
          dot: colorFor?.(o.name) ?? '#94a3b8',
          hint: o.projects < options.total ? `${o.projects} of ${options.total} projects` : undefined,
        }))}
      />
      <span className="bulk-label">Assign to</span>
      <Select
        ariaLabel="New assignee"
        placeholder={people ? 'Choose person…' : 'Loading people…'}
        value={assignee}
        onChange={setAssignee}
        disabled={!people || running}
        options={[
          { value: UNASSIGN, label: 'Unassigned' },
          ...(people?.list ?? []).map((o) => ({
            value: o.person.id,
            label: o.person.name,
            person: o.person,
            hint: o.projects < people.total ? `${o.projects} of ${people.total} projects` : undefined,
          })),
        ]}
      />
      <button className="primary-btn bulk-apply" disabled={(!choice && !assignee) || running} onClick={apply}>
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
