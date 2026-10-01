import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Columns3, List, Loader2, SquareKanban } from 'lucide-react';
import { loadStates } from '../api.js';
import Avatar from './Avatar.jsx';

const NEUTRAL = '#94a3b8';

// Rough workflow order for columns when the project's own order is unknown
// (My Issues mixes projects, each with its own statuses).
const STAGES = [/backlog/i, /^(todo|to do|open|new)$/i, /progress/i, /review|test|qa/i, /feedback/i, /done|resolved|completed/i, /closed/i, /cancel/i];
const stage = (name) => {
  const i = STAGES.findIndex((re) => re.test(name));
  return i === -1 ? 3.5 : i;
};

// Columns: every status of the project(s) shown. One project keeps its own
// order; several are merged in rough workflow order. Statuses outside the
// known lists still get a column.
function columnsFor(issues, lists) {
  const merged = [];
  const known = new Set();
  for (const list of lists)
    for (const s of list)
      if (!known.has(s.name.toLowerCase())) {
        known.add(s.name.toLowerCase());
        merged.push(s.name);
      }
  if (lists.length > 1) merged.sort((a, b) => stage(a) - stage(b) || a.localeCompare(b));
  const names = merged;
  const seen = new Set(names.map((n) => n.toLowerCase()));
  const extra = [];
  for (const i of issues) {
    const n = i.status.name;
    if (!seen.has(n.toLowerCase())) {
      seen.add(n.toLowerCase());
      extra.push(n);
    }
  }
  extra.sort((a, b) => stage(a) - stage(b) || a.localeCompare(b));
  return [...names, ...extra];
}

export default function KanbanBoard({ issues, states, loading, savingIds, colorFor, showProject, showAssignee, onStatusChange, onOpen, onMoveError }) {
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const boardRef = useRef(null);
  const [height, setHeight] = useState(null);
  const [hidden, setHidden] = useState(savedHidden);
  const toggleColumn = (name) =>
    setHidden((prev) => {
      const next = new Set(prev);
      const k = name.toLowerCase();
      next.has(k) ? next.delete(k) : next.add(k);
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
      return next;
    });
  const showAll = () => {
    localStorage.removeItem(HIDDEN_KEY);
    setHidden(new Set());
  };

  // Columns run to the bottom of the window; cards scroll inside them.
  useEffect(() => {
    const fit = () => {
      const el = boardRef.current;
      if (!el) return;
      // The page, not the window, is the scroll container.
      const scrolled = el.closest('.page')?.scrollTop ?? 0;
      setHeight(Math.max(420, Math.round(window.innerHeight - el.getBoundingClientRect().top - scrolled - 24)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  });
  const [projectStates, setProjectStates] = useState([]);

  // Without a states list (My Issues), fetch each project's statuses so empty
  // columns show too.
  const projectKey = states ? '' : [...new Set(issues.map((i) => i.projectId))].sort().join(',');
  useEffect(() => {
    if (!projectKey) return setProjectStates([]);
    let live = true;
    const firsts = projectKey.split(',').map((id) => issues.find((i) => i.projectId === id));
    Promise.all(firsts.map((i) => loadStates(i).catch(() => [])))
      .then((lists) => live && setProjectStates(lists.filter((l) => l.length)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey]);

  if (loading) {
    return (
      <div className="kanban" ref={boardRef} style={{ height }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div className="kanban-col" key={i}>
            <div className="kanban-col-head"><span className="bone" /></div>
            <div className="kanban-card skeleton"><span className="bone" /></div>
            <div className="kanban-card skeleton"><span className="bone" /></div>
          </div>
        ))}
      </div>
    );
  }

  const allColumns = columnsFor(issues, states?.length ? [states] : projectStates);
  const columns = allColumns.filter((c) => !hidden.has(c.toLowerCase()));
  const byColumn = new Map(allColumns.map((c) => [c.toLowerCase(), []]));
  for (const i of issues) byColumn.get(i.status.name.toLowerCase()).push(i);

  const drop = async (column) => {
    setOver(null);
    const issue = issues.find((i) => i.id === dragId);
    setDragId(null);
    if (!issue || issue.status.name.toLowerCase() === column.toLowerCase()) return;
    try {
      const list = states?.length ? states : await loadStates(issue);
      const state = list.find((s) => s.name.toLowerCase() === column.toLowerCase());
      if (state) onStatusChange(issue, state);
      else onMoveError?.(`${issue.key}'s project has no “${column}” status`);
    } catch {
      onMoveError?.(`Could not load statuses for ${issue.key}`);
    }
  };

  return (
    <>
    <div className="kanban-bar">
      <ColumnPicker columns={allColumns} hidden={hidden} colorFor={colorFor} onToggle={toggleColumn} onShowAll={showAll} />
    </div>
    <div className="kanban" ref={boardRef} style={{ height }}>
      {columns.map((column) => {
        const cards = byColumn.get(column.toLowerCase());
        return (
          <section
            key={column}
            className={over === column ? 'kanban-col over' : 'kanban-col'}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              if (over !== column) setOver(column);
            }}
            onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              drop(column);
            }}
          >
            <header className="kanban-col-head">
              <span className="dot" style={{ background: colorFor(column) ?? NEUTRAL }} />
              <span className="kanban-col-name">{column}</span>
              <span className="kanban-count">{cards.length}</span>
            </header>
            <div className="kanban-cards">
              {cards.map((issue) => (
                <article
                  key={issue.id}
                  className={dragId === issue.id ? 'kanban-card dragging' : 'kanban-card'}
                  draggable={!savingIds.has(issue.id)}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', issue.key);
                    setDragId(issue.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOver(null);
                  }}
                  onClick={() => onOpen(issue.id)}
                >
                  <div className="kanban-card-top">
                    <span className="key">{issue.key}</span>
                    {savingIds.has(issue.id) && <Loader2 size={13} className="spin" />}
                    <span className={`priority priority-${issue.priority}`}>{issue.priority}</span>
                  </div>
                  <p className="kanban-title">{issue.title}</p>
                  <div className="kanban-card-foot">
                    {showProject && <span className="kanban-project" title={issue.projectName}>{issue.projectName}</span>}
                    {showAssignee &&
                      (issue.assignee ? (
                        <span className="kanban-assignee" title={issue.assignee.name}>
                          <Avatar id={issue.assignee.id} name={issue.assignee.name} />
                        </span>
                      ) : (
                        <span className="kanban-project muted">Unassigned</span>
                      ))}
                    {issue.targetDate && (
                      <span className={issue.overdue ? 'target overdue' : 'target'}>
                        {issue.overdue && <AlertTriangle size={12} />}
                        {issue.targetDate}
                      </span>
                    )}
                  </div>
                </article>
              ))}
              {cards.length === 0 && <p className="kanban-empty">Drop issues here</p>}
            </div>
          </section>
        );
      })}
      {columns.length === 0 && <p className="kanban-empty">All columns are hidden. Use Columns to show some.</p>}
    </div>
    </>
  );
}

// List/Board switch, remembered per browser.
const VIEW_KEY = 'issueView';
export const savedView = () => (localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list');
export const saveView = (v) => localStorage.setItem(VIEW_KEY, v);

export function ViewSwitch({ view, onChange }) {
  const pick = (v) => {
    saveView(v);
    onChange(v);
  };
  return (
    <div className="view-switch" role="group" aria-label="Issue view">
      <button className={view === 'list' ? 'on' : undefined} aria-pressed={view === 'list'} onClick={() => pick('list')}>
        <List size={15} /> List
      </button>
      <button className={view === 'board' ? 'on' : undefined} aria-pressed={view === 'board'} onClick={() => pick('board')}>
        <SquareKanban size={15} /> Board
      </button>
    </div>
  );
}

// Which status columns are hidden, remembered per browser (lowercase names).
const HIDDEN_KEY = 'kanbanHidden';
function savedHidden() {
  try {
    return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY)) ?? []);
  } catch {
    return new Set();
  }
}

function ColumnPicker({ columns, hidden, colorFor, onToggle, onShowAll }) {
  const [open, setOpen] = useState(false);
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

  const shown = columns.filter((c) => !hidden.has(c.toLowerCase())).length;
  return (
    <div className="kanban-config" ref={ref}>
      <button className="toggle-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open}>
        <Columns3 size={14} /> Columns {shown < columns.length && <span className="kanban-count">{shown}/{columns.length}</span>}
      </button>
      {open && (
        <ul className="status-menu kanban-config-menu">
          {columns.map((c) => {
            const on = !hidden.has(c.toLowerCase());
            return (
              <li key={c}>
                <button role="menuitemcheckbox" aria-checked={on} onClick={() => onToggle(c)}>
                  <span className="dot" style={{ background: colorFor(c) ?? NEUTRAL }} />
                  <span>{c}</span>
                  {on && <Check size={14} className="menu-check" />}
                </button>
              </li>
            );
          })}
          {shown < columns.length && (
            <li>
              <button className="kanban-show-all" onClick={onShowAll}>Show all</button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
