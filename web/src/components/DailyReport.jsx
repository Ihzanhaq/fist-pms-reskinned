import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Copy, FileText } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import { formatLong, relativeDay, shiftIso, todayIso } from '../dates.js';
import DatePicker from './DatePicker.jsx';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function describe(entry) {
  if (entry.kind === 'status') {
    return (
      <>
        <span className="pill-status">{entry.fromStatus}</span>
        <ArrowRight size={13} className="arrow" />
        <span className="pill-status to">{entry.toStatus}</span>
      </>
    );
  }
  return <span>{entry.text[0].toUpperCase() + entry.text.slice(1)}</span>;
}

// Plain-text version for pasting into chat or email.
function reportText(report) {
  const lines = [`Daily report – ${formatLong(report.date)}`, ''];
  const done = report.groups.filter((g) => g.completed);
  const other = report.groups.filter((g) => !g.completed);
  const name = (g) => (g.issue ? `${g.issue.key}${g.issue.title ? ` ${g.issue.title}` : ''}` : g.project ?? 'Other');
  if (done.length) {
    lines.push(`Completed (${done.length})`);
    done.forEach((g) => lines.push(`- ${name(g)}${g.project ? ` (${g.project})` : ''}`));
    lines.push('');
  }
  if (other.length) {
    lines.push(`Other updates (${other.length})`);
    other.forEach((g) => {
      const what = g.entries.map((e) => (e.kind === 'status' ? `${e.fromStatus} → ${e.toStatus}` : e.text)).join('; ');
      lines.push(`- ${name(g)}: ${what}`);
    });
  }
  if (!report.groups.length) lines.push('No PMS activity.');
  return lines.join('\n').trim();
}

export default function DailyReport({ date, onDateChange, onOpenIssue, onError }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const today = todayIso();

  const load = useCallback(async () => {
    setReport(null);
    setError(null);
    try {
      setReport(await api.report(date));
    } catch (err) {
      if (err.code === 'session_expired') onError(err);
      setError(err);
    }
  }, [date, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const copy = async () => {
    await navigator.clipboard.writeText(reportText(report));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const s = report?.summary;

  return (
    <div className="report">
      <div className="page-head">
        <div>
          <h1>Daily report</h1>
          <p className="subtitle">{formatLong(date)}</p>
        </div>
        <div className="report-controls">
          <div className="day-nav">
            <button className="page-btn" onClick={() => onDateChange(shiftIso(date, -1))} aria-label="Previous day">
              <ChevronLeft size={16} />
            </button>
            <DatePicker ariaLabel="Report date" value={date} onChange={(d) => onDateChange(d || today)} />
            <button className="page-btn" onClick={() => onDateChange(shiftIso(date, 1))} disabled={date >= today} aria-label="Next day">
              <ChevronRight size={16} />
            </button>
          </div>
          {date !== today && (
            <button className="secondary-btn" onClick={() => onDateChange(today)}>
              Today
            </button>
          )}
          <button className="primary-btn copy-btn" onClick={copy} disabled={!report}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy as text'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-card">
          <div>
            <strong>Could not load the report</strong>
            <p>{errorMessage(error)}</p>
          </div>
          <button className="secondary-btn" onClick={load}>Try again</button>
        </div>
      )}

      {!report && !error && <div className="dash-loading">Loading {relativeDay(date).toLowerCase()}…</div>}

      {report && (
        <>
          <div className="report-summary">
            <div>
              <strong>{s.completed}</strong>
              <span>completed</span>
            </div>
            <div>
              <strong>{s.issues}</strong>
              <span>{s.issues === 1 ? 'issue touched' : 'issues touched'}</span>
            </div>
            <div>
              <strong>{s.statusChanges}</strong>
              <span>status {s.statusChanges === 1 ? 'change' : 'changes'}</span>
            </div>
            <div>
              <strong>{s.created}</strong>
              <span>created</span>
            </div>
            <div>
              <strong>{s.comments}</strong>
              <span>{s.comments === 1 ? 'comment' : 'comments'}</span>
            </div>
          </div>

          {report.groups.length === 0 ? (
            <div className="empty">
              <FileText size={28} />
              <p>No PMS activity on {relativeDay(date) === 'Today' ? 'this day yet' : 'this day'}.</p>
            </div>
          ) : (
            <ol className="report-list">
              {report.groups.map((g, i) => (
                <li key={g.issue?.key ?? `g${i}`} className="report-item">
                  <div className="report-item-head">
                    {g.issue ? (
                      <button className="report-issue" onClick={() => onOpenIssue(g.issue.id)}>
                        <span className="key">{g.issue.key}</span>
                        <span className="report-title">{g.issue.title ?? 'Issue not assigned to you'}</span>
                      </button>
                    ) : (
                      <span className="report-title">{g.project ?? 'Other'}</span>
                    )}
                    {g.completed && (
                      <span className="done-badge">
                        <CheckCircle2 size={13} /> Completed
                      </span>
                    )}
                    {g.project && g.issue && <span className="muted report-project">{g.project}</span>}
                  </div>
                  <ul className="report-entries">
                    {g.entries.map((e, j) => (
                      <li key={j}>
                        <span className="report-time">{e.time}</span>
                        <span className="report-what">{describe(e)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
          <p className="muted report-note">{plural(s.actions, 'update')} recorded in the PMS activity log.</p>
        </>
      )}
    </div>
  );
}
