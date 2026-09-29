import { AlertTriangle } from 'lucide-react';
import Checkbox from './Checkbox.jsx';
import StatusSelect from './StatusSelect.jsx';

const PMS = 'https://pms.fistinnovations.com';

export default function IssueRow({ issue, colorFor, saving, selected, selectionLocked, onToggle, onStatusChange }) {
  return (
    <div className={selected ? 'row selected' : 'row'}>
      <Checkbox
        checked={selected}
        disabled={selectionLocked}
        onChange={() => onToggle(issue.id)}
        label={`Select ${issue.key}`}
      />
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
