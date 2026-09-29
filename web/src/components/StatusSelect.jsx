import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { api } from '../api.js';

const NEUTRAL = '#94a3b8';
const statesCache = new Map(); // projectId -> states

export default function StatusSelect({ issue, colorFor, saving, onChange }) {
  const [open, setOpen] = useState(false);
  const [states, setStates] = useState(() => statesCache.get(issue.projectId) ?? null);
  const [failed, setFailed] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || states) return;
    const cached = statesCache.get(issue.projectId);
    if (cached) return setStates(cached);
    let live = true;
    setFailed(false);
    api
      .states(issue)
      .then(({ states }) => {
        statesCache.set(issue.projectId, states);
        if (live) setStates(states);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [open, states, issue]);

  const current = issue.status.name.toLowerCase();
  const pick = (state) => {
    setOpen(false);
    if (state.name.toLowerCase() !== current) onChange(issue, state);
  };

  return (
    <div className="status" ref={ref}>
      <button
        className="status-pill"
        style={{ '--c': issue.status.color ?? NEUTRAL }}
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="dot" />
        <span className="status-name">{issue.status.name}</span>
        {saving ? <Loader2 size={13} className="spin" /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <ul className="status-menu" role="listbox">
          {!states && !failed && <li className="menu-note">Loading statuses…</li>}
          {failed && <li className="menu-note error">Could not load statuses</li>}
          {states?.map((state) => {
            const active = state.name.toLowerCase() === current;
            return (
              <li key={state.id}>
                <button role="option" aria-selected={active} className={active ? 'active' : undefined} onClick={() => pick(state)}>
                  <span className="dot" style={{ background: colorFor(state.name) ?? NEUTRAL }} />
                  <span>{state.name}</span>
                  {active && <Check size={14} className="menu-check" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
