import { ExternalLink, FileText, FolderKanban, LayoutDashboard, ListChecks } from 'lucide-react';
import ClaudeIcon from './ClaudeIcon.jsx';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'issues', label: 'My Issues', icon: ListChecks },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'report', label: 'Daily report', icon: FileText },
  { id: 'claude', label: 'Connect to Claude', icon: ClaudeIcon },
];

export default function Sidebar({ view, onNavigate }) {
  return (
    <aside className="sidebar">
      <nav>
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={view === id ? 'nav-item active' : 'nav-item'}
            aria-current={view === id ? 'page' : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
        <a className="nav-item" href="https://pms.fistinnovations.com/" target="_blank" rel="noreferrer">
          <ExternalLink size={17} />
          Open PMS
        </a>
      </nav>
    </aside>
  );
}
