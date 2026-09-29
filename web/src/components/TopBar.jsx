import { LogOut, RefreshCw } from 'lucide-react';

export default function TopBar({ userName, loggedIn, refreshing, onRefresh, onLogout }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">F</span>
        <span className="brand-name">FIST PMS</span>
      </div>
      {loggedIn && (
        <div className="topbar-actions">
          <button className="icon-btn" onClick={onRefresh} disabled={refreshing} title="Refresh issues">
            <RefreshCw size={17} className={refreshing ? 'spin' : undefined} />
          </button>
          <span className="topbar-divider" />
          <div className="account">
            <span className="avatar">{userName?.[0]?.toUpperCase() ?? '?'}</span>
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
