import { AlertTriangle } from 'lucide-react';
import StatusSelect from './StatusSelect.jsx';

const PMS = 'https://pms.fistinnovations.com';

export default function IssueRow({ issue, colorFor, saving, onStatusChange }) {
  return (
    <div className="row" style={{ '--accent': issue.status.color ?? '#94a3b8' }}>
      <span className="key">{issue.key}</span>
      <a className="title" href={`${PMS}/issues/${issue.id}`} target="_blank" rel="noreferrer" title={issue.title}>
        {issue.title}
      </a>
      <span className="project" title={issue.projectName}>{issue.projectName}</span>
      <span className={`priority priority-${issue.priority}`}>{issue.priority}</span>
      <span className={issue.overdue ? 'target overdue' : 'target'}>
        {issue.overdue && <AlertTriangle size={13} />}
        {issue.targetDate ?? '—'}
      </span>
      <StatusSelect issue={issue} colorFor={colorFor} saving={saving} onChange={onStatusChange} />
    </div>
  );
}
