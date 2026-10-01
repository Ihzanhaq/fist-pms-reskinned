import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDropUp } from '../useDropUp.js';

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
const formatShort = (iso) => {
  const p = parseIso(iso);
  return p ? `${pad(p.d)} ${MONTHS[p.m].slice(0, 3)} ${p.y}` : '';
};

function monthGrid(y, m) {
  const firstWeekday = (new Date(y, m, 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(y, m, 1 - firstWeekday + i);
    return { iso: toIso(date.getFullYear(), date.getMonth(), date.getDate()), day: date.getDate(), inMonth: date.getMonth() === m };
  });
}

const orderRange = (a, b) => (a <= b ? [a, b] : [b, a]);

export default function DateRangePicker({ from, to, onChange, max, open, onOpenChange, ariaLabel = 'Date range' }) {
  const [pendingStart, setPendingStart] = useState(null);
  const [view, setView] = useState(() => parseIso(from) ?? parseIso(to) ?? parseIso(todayIso()));
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const up = useDropUp(open, rootRef, menuRef);
  const today = todayIso();
  const cap = max && max < today ? max : today;

  useEffect(() => {
    if (!open) {
      setPendingStart(null);
      return;
    }
    setView(parseIso(from) ?? parseIso(to) ?? parseIso(todayIso()));
    const onPointer = (e) => !rootRef.current?.contains(e.target) && onOpenChange(false);
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open, from, to, onOpenChange]);

  const shiftMonth = (delta) =>
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth(), d: 1 };
    });

  const pickDay = (iso) => {
    if (!pendingStart) {
      setPendingStart(iso);
      return;
    }
    const [start, end] = orderRange(pendingStart, iso);
    onChange(start, end);
    setPendingStart(null);
    onOpenChange(false);
  };

  const [rangeFrom, rangeTo] = from && to ? orderRange(from, to) : [null, null];
  const previewEnd = pendingStart && !rangeFrom ? pendingStart : rangeTo;
  const previewStart = pendingStart ?? rangeFrom;

  const label =
    from && to ? `${formatShort(from)} – ${formatShort(to)}` : 'Pick date range';

  return (
    <div
      className="sel sel-input date-picker date-range-picker"
      ref={rootRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          onOpenChange(false);
        }
      }}
    >
      <button
        type="button"
        className={open ? 'sel-trigger open' : 'sel-trigger'}
        onClick={() => onOpenChange(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <CalendarDays size={15} className="date-icon" />
        <span className={from && to ? 'sel-value' : 'sel-value placeholder'}>{label}</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          className={up ? 'sel-menu calendar range-calendar up' : 'sel-menu calendar range-calendar'}
          role="dialog"
          aria-label={ariaLabel}
        >
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
          <p className="cal-hint">{pendingStart ? 'Choose end date' : 'Choose start date'}</p>
          <div className="cal-grid">
            {WEEKDAYS.map((w) => (
              <span key={w} className="cal-weekday">
                {w}
              </span>
            ))}
            {monthGrid(view.y, view.m).map(({ iso, day, inMonth }) => {
              const blocked = iso > cap;
              const [lo, hi] =
                previewStart && (previewEnd || pendingStart)
                  ? orderRange(previewStart, previewEnd || pendingStart)
                  : [null, null];
              const inRange = lo && hi && iso >= lo && iso <= hi;
              const isStart = iso === lo;
              const isEnd = iso === hi && lo !== hi;
              const cls = [
                'cal-day',
                !inMonth && 'outside',
                iso === today && 'today',
                inRange && 'in-range',
                isStart && 'range-start',
                isEnd && 'range-end',
                inRange && lo === hi && iso === lo && 'selected',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button type="button" key={iso} className={cls} disabled={blocked} onClick={() => pickDay(iso)} aria-label={formatShort(iso)}>
                  {day}
                </button>
              );
            })}
          </div>
          <div className="cal-foot">
            <button type="button" className="link-btn" onClick={() => setPendingStart(null)}>
              Reset
            </button>
            <button
              type="button"
              className="link-btn"
              disabled={cap !== today}
              onClick={() => {
                onChange(cap, cap);
                setPendingStart(null);
                onOpenChange(false);
              }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
