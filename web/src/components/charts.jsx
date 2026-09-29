// Small, dependency-free charts for the dashboard. One hue (the accent) for
// magnitude; the latest period is emphasised and the rest recede.
import { useEffect, useRef, useState } from 'react';
import { foldRows } from '../foldRows.js';

// Theme colours (see styles.css); SVG takes CSS variables only through style.
const ACCENT = 'var(--accent)';
const RECEDE = 'var(--chart-recede)';
const GRID = 'var(--chart-grid)';

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

// Clean axis maximum and 3-4 round ticks.
function niceTicks(max) {
  if (max <= 4) return [0, 1, 2, 3, 4].slice(0, Math.max(2, max + 1));
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => max / s <= 4) ?? Math.ceil(max / 4);
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

// Column path with a 4px rounded top and a square base.
function columnPath(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

// data: [{ key, label, sub, value, tip }]; the last item is emphasised.
export function ColumnChart({ data, height = 220, ariaLabel }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 22, right: 8, bottom: 40, left: 30 };
  const ticks = niceTicks(Math.max(...data.map((d) => d.value), 0));
  const top = ticks.at(-1) || 1;
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.min(24, band * 0.62);
  const y = (v) => pad.top + plotH - (v / top) * plotH;
  const last = data.length - 1;

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} style={{ stroke: GRID }} strokeWidth="1" />
              <text x={pad.left - 8} y={y(t)} className="chart-tick" textAnchor="end" dominantBaseline="middle">
                {t}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = pad.left + band * i + band / 2;
            const h = (d.value / top) * plotH;
            const isLast = i === last;
            return (
              <g key={d.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={cx - band / 2} y={pad.top} width={band} height={plotH + pad.bottom} fill="transparent" />
                {hover === i && <rect x={cx - band / 2 + 2} y={pad.top} width={band - 4} height={plotH} rx="6" style={{ fill: 'var(--accent-wash)' }} />}
                <path d={columnPath(cx - barW / 2, y(d.value), barW, h)} style={{ fill: isLast || hover === i ? ACCENT : RECEDE }} />
                {isLast && d.value > 0 && (
                  <text x={cx} y={y(d.value) - 7} textAnchor="middle" className="chart-value">
                    {d.value}
                  </text>
                )}
                <text x={cx} y={height - pad.bottom + 16} textAnchor="middle" className={isLast ? 'chart-x strong' : 'chart-x'}>
                  {d.label}
                </text>
                <text x={cx} y={height - pad.bottom + 30} textAnchor="middle" className="chart-x sub">
                  {d.sub}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <div
          className="chart-tip"
          style={{ left: Math.min(Math.max(pad.left + band * hover + band / 2, 80), width - 80), top: y(data[hover].value) - 12 }}
        >
          {data[hover].tip}
        </div>
      )}
    </div>
  );
}

// Tiny trend line for a stat tile; last point marked.
export function Sparkline({ values, width = 96, height = 28 }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 3 - (v / max) * (height - 6)]);
  const [lx, ly] = pts.at(-1);
  return (
    <svg width={width} height={height} className="sparkline" aria-hidden="true">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" style={{ stroke: RECEDE }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3.5" style={{ fill: ACCENT, stroke: 'var(--surface)' }} strokeWidth="2" />
    </svg>
  );
}

// Horizontal bars with the value at the tip. rows: [{ label, value, dot? }]
// Long lists show the top `limit` rows plus an "Other" row, expandable in place.
export function BarList({ rows, limit = 5 }) {
  const [expanded, setExpanded] = useState(false);
  const folded = foldRows(rows, limit);
  const shown = expanded ? rows : folded.rows;
  const top = Math.max(...rows.map((r) => r.value), 1);
  return (
    <>
      <ul className="bar-list">
        {shown.map((r) => (
          <li key={r.label} title={`${r.label}: ${r.value}`} className={r.other ? 'other' : undefined}>
            <span className="bar-label">
              {r.dot && <span className="dot" style={{ background: r.dot }} />}
              <span>{r.label}</span>
            </span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${Math.max(2, (r.value / top) * 100)}%` }} />
            </span>
            <span className="bar-value">{r.value}</span>
          </li>
        ))}
      </ul>
      {folded.hidden > 0 && (
        <button className="link-btn bar-more" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </>
  );
}
