import { ExternalLink, FileText, FolderKanban, LayoutDashboard, ListChecks, LogOut, Settings } from 'lucide-react';
import Avatar from './Avatar.jsx';
import BrandMark from './BrandMark.jsx';
import ClaudeIcon from './ClaudeIcon.jsx';

const GROUPS = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'report', label: 'Daily report', icon: FileText },
    ],
  },
  {
    label: 'Work',
    items: [
      { id: 'issues', label: 'My Issues', icon: ListChecks },
      { id: 'projects', label: 'Projects', icon: FolderKanban },
    ],
  },
  {
    label: 'Integrations',
    items: [{ id: 'claude', label: 'Connect to Claude', icon: ClaudeIcon }],
  },
  {
    label: 'Preferences',
    items: [{ id: 'settings', label: 'Settings', icon: Settings }],
  },
];

export default function Sidebar({ view, onNavigate, user, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <BrandMark />
        <span className="brand-text">
          <span className="brand-name">FIST PMS</span>
          <span className="brand-sub">Issue dashboard</span>
        </span>
      </div>

      <nav>
        {GROUPS.map((group) => (
          <div className="nav-group" key={group.label}>
            <span className="nav-label">{group.label}</span>
            {group.items.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={view === id ? 'nav-item active' : 'nav-item'}
                aria-current={view === id ? 'page' : undefined}
                onClick={() => onNavigate(id)}
              >
                <Icon size={17} />
                <span>{label}</span>
              </button>
            ))}
            {group.label === 'Integrations' && (
              <a className="nav-item" href="https://pms.fistinnovations.com/" target="_blank" rel="noreferrer">
                <ExternalLink size={17} />
                <span>Open PMS</span>
              </a>
            )}
          </div>
        ))}
      </nav>

      {user?.name && (
        <div className="sidebar-user">
          <Avatar id={user.id} name={user.name} size="" />
          <span className="sidebar-user-text">
            <span className="sidebar-user-name">{user.name}</span>
            <span className="sidebar-user-sub">Signed in to FIST PMS</span>
          </span>
          <button className="icon-btn" onClick={onLogout} title="Log out of the dashboard" aria-label="Log out of the dashboard">
            <LogOut size={16} />
          </button>
        </div>
      )}
    </aside>
  );
}
