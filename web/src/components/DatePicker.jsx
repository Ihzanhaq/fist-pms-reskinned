import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useDropUp } from '../useDropUp.js';

// Styled replacement for <input type="date">. Value is 'YYYY-MM-DD' or ''.
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n) => String(n).padStart(2, '0');
const toIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => {
  const t = new Date();
  return toIso(t.getFullYear(), t.getMonth(), t.getDate());
};
const parseIso = (iso) => {
  const [y, m, d] = (iso || '').split('-').map(Number);
  return y ? { y, m: m - 1, d } : null;
};
const format = (iso) => {
  const p = parseIso(iso);
  return p ? `${pad(p.d)} ${MONTHS[p.m].slice(0, 3)} ${p.y}` : '';
};

// 6-week grid starting on Monday, including days from the neighbouring months.
function monthGrid(y, m) {
  const firstWeekday = (new Date(y, m, 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(y, m, 1 - firstWeekday + i);
    return { iso: toIso(date.getFullYear(), date.getMonth(), date.getDate()), day: date.getDate(), inMonth: date.getMonth() === m };
  });
}

export default function DatePicker({ value, onChange, min, placeholder = 'Pick a date', ariaLabel, disabled }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => parseIso(value) ?? parseIso(todayIso()));
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const up = useDropUp(open, rootRef, menuRef);

  useEffect(() => {
    if (!open) return;
    setView(parseIso(value) ?? parseIso(min) ?? parseIso(todayIso()));
    const onPointer = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]); // only when the menu opens or closes

  const shiftMonth = (delta) =>
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth(), d: 1 };
    });

  const choose = (iso) => {
    onChange(iso);
    setOpen(false);
  };

  const today = todayIso();

  return (
    <div
      className="sel sel-input date-picker"
      ref={rootRef}
      onKeyDown={(e) => {
        // Esc closes only the calendar, not the form around it.
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className={open ? 'sel-trigger open' : 'sel-trigger'}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <CalendarDays size={15} className="date-icon" />
        <span className={value ? 'sel-value' : 'sel-value placeholder'}>{value ? format(value) : placeholder}</span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            className="date-clear"
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onChange('');
              }
            }}
          >
            <X size={13} />
          </span>
        )}
      </button>

      {open && (
        <div ref={menuRef} className={up ? 'sel-menu calendar up' : 'sel-menu calendar'} role="dialog" aria-label={ariaLabel}>
          <div className="cal-head">
            <button type="button" className="cal-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <strong>
              {MONTHS[view.m]} {view.y}
            </strong>
            <button type="button" className="cal-nav" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="cal-grid">
            {WEEKDAYS.map((w) => (
              <span key={w} className="cal-weekday">{w}</span>
            ))}
            {monthGrid(view.y, view.m).map(({ iso, day, inMonth }) => {
              const blocked = Boolean(min && iso < min);
              const cls = ['cal-day', !inMonth && 'outside', iso === today && 'today', iso === value && 'selected']
                .filter(Boolean)
                .join(' ');
              return (
                <button type="button" key={iso} className={cls} disabled={blocked} onClick={() => choose(iso)} aria-label={format(iso)}>
                  {day}
                </button>
              );
            })}
          </div>
          <div className="cal-foot">
            <button type="button" className="link-btn" onClick={() => choose('')}>
              Clear
            </button>
            <button type="button" className="link-btn" disabled={Boolean(min && today < min)} onClick={() => choose(today)}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
