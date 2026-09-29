import { ExternalLink, ListChecks } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <nav>
        <a className="nav-item active" href="/">
          <ListChecks size={17} />
          My Issues
        </a>
        <a className="nav-item" href="https://pms.fistinnovations.com/" target="_blank" rel="noreferrer">
          <ExternalLink size={17} />
          Open PMS
        </a>
      </nav>
    </aside>
  );
}
