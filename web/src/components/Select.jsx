import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import Avatar from './Avatar.jsx';
import { useDropUp } from '../useDropUp.js';

// Styled replacement for <select>.
//   options: [{ value, label, dot?: color, hint?: string }]
//   variant: 'filter' (toolbar), 'input' (forms), 'prop' (detail panel), 'compact' (pagination)
//   searchable: shows a filter box; defaults to on for long lists.
export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  ariaLabel,
  variant = 'filter',
  searchable,
  disabled = false,
  className = '',
  prefix,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [alignRight, setAlignRight] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const withSearch = searchable ?? options.length > 10;
  const selected = options.find((o) => o.value === value);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? options.filter((o) => o.label.toLowerCase().includes(term)) : options;
  }, [options, q]);

  const up = useDropUp(open, rootRef, menuRef, shown.length);

  // Open: start on the selected option and keep the menu inside the window horizontally.
  useLayoutEffect(() => {
    if (!open) return;
    setQ('');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    const rect = menuRef.current?.getBoundingClientRect();
    setAlignRight(Boolean(rect && rect.right > window.innerWidth - 8));
    (withSearch ? menuRef.current?.querySelector('input') : listRef.current)?.focus();
  }, [open]); // only when the menu opens or closes

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  useEffect(() => setActive(0), [q]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const pick = (option) => {
    if (!option) return;
    close();
    if (option.value !== value) onChange(option.value);
  };

  const onMenuKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(shown.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // close only this menu, not the panel or modal around it
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  const onTriggerKey = (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div className={`sel sel-${variant} ${className}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={open ? 'sel-trigger open' : 'sel-trigger'}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
      >
        {prefix && <span className="sel-prefix">{prefix}</span>}
        {selected?.dot && <span className="dot" style={{ background: selected.dot }} />}
        {selected?.person && <Avatar id={selected.person.id} name={selected.person.name} />}
        <span className={selected ? 'sel-value' : 'sel-value placeholder'}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={15} className="sel-chevron" />
      </button>

      {open && (
        <div
          ref={menuRef}
          className={['sel-menu', up && 'up', alignRight && 'right'].filter(Boolean).join(' ')}
          onKeyDown={onMenuKey}
        >
          {withSearch && (
            <label className="sel-search">
              <Search size={14} />
              <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search options" />
            </label>
          )}
          <ul ref={listRef} id={listId} role="listbox" tabIndex={-1} aria-label={ariaLabel}>
            {shown.map((o, i) => {
              const isSelected = o.value === value;
              return (
                <li
                  key={String(o.value)}
                  role="option"
                  aria-selected={isSelected}
                  className={[i === active && 'active', isSelected && 'selected'].filter(Boolean).join(' ')}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                >
                  {o.dot && <span className="dot" style={{ background: o.dot }} />}
                  {o.person && <Avatar id={o.person.id} name={o.person.name} />}
                  <span className="sel-label">{o.label}</span>
                  {o.hint && <span className="sel-hint">{o.hint}</span>}
                  {isSelected && <Check size={14} className="sel-check" />}
                </li>
              );
            })}
            {shown.length === 0 && <li className="sel-empty">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
