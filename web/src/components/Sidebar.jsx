import { ExternalLink, ListChecks, Sparkles } from 'lucide-react';

const NAV = [
  { id: 'issues', label: 'My Issues', icon: ListChecks },
  { id: 'claude', label: 'Connect to Claude', icon: Sparkles },
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
