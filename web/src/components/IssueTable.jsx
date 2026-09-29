import { Inbox } from 'lucide-react';
import IssueRow from './IssueRow.jsx';

const HEADERS = ['Key', 'Title', 'Project', 'Priority', 'Target', 'Status'];

export default function IssueTable({ issues, loading, savingIds, colorFor, onStatusChange }) {
  return (
    <div className="table">
      <div className="table-head">
        {HEADERS.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>

      {loading &&
        Array.from({ length: 6 }, (_, i) => (
          <div className="row skeleton" key={i}>
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
            onStatusChange={onStatusChange}
          />
        ))}
    </div>
  );
}
