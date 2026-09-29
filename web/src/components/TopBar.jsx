import { LogOut, Moon, RefreshCw, Sun } from 'lucide-react';
import Avatar from './Avatar.jsx';

export default function TopBar({ userId, userName, loggedIn, refreshing, theme, onToggleTheme, onRefresh, onLogout }) {
  const themeToggle = (
    <button
      className="icon-btn"
      onClick={onToggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">F</span>
        <span className="brand-name">FIST PMS</span>
      </div>
      {!loggedIn && <div className="topbar-actions">{themeToggle}</div>}
      {loggedIn && (
        <div className="topbar-actions">
          {themeToggle}
          <button className="icon-btn" onClick={onRefresh} disabled={refreshing} title="Refresh issues">
            <RefreshCw size={17} className={refreshing ? 'spin' : undefined} />
          </button>
          <span className="topbar-divider" />
          <div className="account">
            <Avatar id={userId} name={userName} size="" />
            <span className="account-name">{userName}</span>
          </div>
          <span className="topbar-divider" />
          <button className="icon-btn" onClick={onLogout} title="Log out of dashboard">
            <LogOut size={17} />
          </button>
        </div>
      )}
    </header>
  );
}
