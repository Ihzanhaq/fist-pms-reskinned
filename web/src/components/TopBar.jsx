import { Fragment } from 'react';
import { ChevronRight, Moon, RefreshCw, Sun } from 'lucide-react';

// crumbs: [{ label, onClick? }] — the last one is the current page.
export default function TopBar({ crumbs, theme, onToggleTheme, refreshing, onRefresh }) {
  const toDark = theme !== 'dark';
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
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title={toDark ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-label={toDark ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {toDark ? <Moon size={16} /> : <Sun size={16} />}
          <span>{toDark ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </header>
  );
}
