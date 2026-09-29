import { Inbox } from 'lucide-react';
import Checkbox from './Checkbox.jsx';
import IssueRow from './IssueRow.jsx';

const HEADERS = ['Key', 'Title', 'Project', 'Priority', 'Target', 'Status'];

export default function IssueTable({
  issues,
  loading,
  savingIds,
  selectedIds = new Set(),
  selectionLocked = false,
  colorFor,
  onToggle,
  onToggleAll,
  onStatusChange,
  onOpen,
}) {
  const selectedCount = issues.filter((i) => selectedIds.has(i.id)).length;
  const allSelected = issues.length > 0 && selectedCount === issues.length;

  return (
    <div className="table">
      <div className="table-head">
        <Checkbox
          checked={allSelected}
          indeterminate={selectedCount > 0 && !allSelected}
          disabled={loading || issues.length === 0 || selectionLocked}
          onChange={() => onToggleAll(!allSelected)}
          label="Select all visible issues"
        />
        {HEADERS.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>

      {loading &&
        Array.from({ length: 6 }, (_, i) => (
          <div className="row skeleton" key={i}>
            <span />
            {HEADERS.map((h) => (
              <span key={h} className="bone" />
            ))}
          </div>
        ))}

      {!loading && issues.length === 0 && (
        <div className="empty">
          <Inbox size={28} />
          <p>No issues match these filters</p>
        </div>
      )}

      {!loading &&
        issues.map((issue) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            colorFor={colorFor}
            saving={savingIds.has(issue.id)}
            selected={selectedIds.has(issue.id)}
            selectionLocked={selectionLocked}
            onToggle={onToggle}
            onStatusChange={onStatusChange}
            onOpen={onOpen}
          />
        ))}
    </div>
  );
}
