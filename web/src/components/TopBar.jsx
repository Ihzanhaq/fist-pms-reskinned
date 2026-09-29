import { Fragment } from 'react';
import { ChevronRight, Palette, RefreshCw } from 'lucide-react';
import Select from './Select.jsx';

const GLASS_DOT = 'linear-gradient(135deg, #7cc4ff, #ff9ab8)';

// crumbs: [{ label, onClick? }] — the last one is the current page.
export default function TopBar({ crumbs, themes, theme, onThemeChange, refreshing, onRefresh }) {
  return (
    <header className="topbar">
      <nav className="crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && <ChevronRight size={14} className="crumb-sep" />}
              {c.onClick && !last ? (
                <button className="crumb" onClick={c.onClick}>
                  {c.label}
                </button>
              ) : (
                <span className={last ? 'crumb current' : 'crumb'} aria-current={last ? 'page' : undefined}>
                  {c.label}
                </span>
              )}
            </Fragment>
          );
        })}
      </nav>
      <div className="topbar-actions">
        {onRefresh && (
          <button className="icon-btn" onClick={onRefresh} disabled={refreshing} title="Refresh issues" aria-label="Refresh issues">
            <RefreshCw size={17} className={refreshing ? 'spin' : undefined} />
          </button>
        )}
        <Select
          variant="compact"
          className="theme-picker"
          ariaLabel="Theme"
          prefix={<Palette size={15} />}
          value={theme}
          onChange={onThemeChange}
          options={themes.map((t) => ({ value: t.id, label: t.name, dot: t.preview?.accent ?? GLASS_DOT }))}
        />
      </div>
    </header>
  );
}
