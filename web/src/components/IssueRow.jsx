import { AlertTriangle } from 'lucide-react';
import { rowClick } from '../rowClick.js';
import Checkbox from './Checkbox.jsx';
import StatusSelect from './StatusSelect.jsx';

export default function IssueRow({ issue, colorFor, saving, selected, selectionLocked, onToggle, onStatusChange, onOpen }) {
  return (
    <div className={selected ? 'row clickable selected' : 'row clickable'} onClick={rowClick(() => onOpen(issue.id))}>
      <Checkbox
        checked={selected}
        disabled={selectionLocked}
        onChange={() => onToggle(issue.id)}
        label={`Select ${issue.key}`}
      />
      <span className="key">{issue.key}</span>
      <button className="title" onClick={() => onOpen(issue.id)} title={issue.title}>
        {issue.title}
      </button>
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
