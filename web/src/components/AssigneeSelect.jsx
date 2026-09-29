import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Lock, Search } from 'lucide-react';
import { useDropUp } from '../useDropUp.js';

const initial = (name) => (name ? name[0].toUpperCase() : '–');

// Assignee cell that opens a searchable people picker, like StatusSelect does for status.
export default function AssigneeSelect({ issue, people, saving, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    const onPointer = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? people.filter((p) => p.name.toLowerCase().includes(term)) : people;
  }, [people, q]);

  const up = useDropUp(open, ref, menuRef, matches.length);

  const current = issue.assignee;
  const label = (
    <>
      <span className="avatar tiny">{initial(current?.name)}</span>
      <span className="assignee-name">{current?.name ?? 'Unassigned'}</span>
    </>
  );

  if (issue.assigneeLocked) {
    return (
      <span
        className={current ? 'assignee locked-cell' : 'assignee none locked-cell'}
        title="This issue is closed. Reopen it to change the assignee."
      >
        {label}
        <Lock size={12} className="lock-icon" />
      </span>
    );
  }

  const pick = (person) => {
    setOpen(false);
    if ((person?.id ?? null) !== (current?.id ?? null)) onChange(issue, person);
  };

  return (
    <div className="assignee-picker" ref={ref}>
      <button
        className={current ? 'assignee assignee-btn' : 'assignee assignee-btn none'}
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={current ? `Assigned to ${current.name}. Click to change` : 'Click to assign'}
      >
        {label}
        {saving ? <Loader2 size={13} className="spin" /> : <ChevronDown size={13} className="chev" />}
      </button>

      {open && (
        <div ref={menuRef} className={up ? 'assignee-menu up' : 'assignee-menu'}>
          <label className="assignee-search">
            <Search size={14} />
            <input autoFocus placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <ul role="listbox">
            {!q && (
              <li>
                <button role="option" aria-selected={!current} className={!current ? 'active' : undefined} onClick={() => pick(null)}>
                  <span className="avatar tiny muted-avatar">–</span>
                  <span>Unassigned</span>
                  {!current && <Check size={14} className="menu-check" />}
                </button>
              </li>
            )}
            {matches.map((p) => {
              const active = current?.id === p.id;
              return (
                <li key={p.id}>
                  <button role="option" aria-selected={active} className={active ? 'active' : undefined} onClick={() => pick(p)}>
                    <span className="avatar tiny">{initial(p.name)}</span>
                    <span>{p.name}</span>
                    {active && <Check size={14} className="menu-check" />}
                  </button>
                </li>
              );
            })}
            {matches.length === 0 && <li className="menu-note">No one matches “{q}”</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
