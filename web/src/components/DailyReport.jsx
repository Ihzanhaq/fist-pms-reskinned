import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, FileText } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import { formatLong, relativeDay, shiftIso, todayIso } from '../dates.js';
import { reportText, sections, sentence } from '../reportWording.js';
import DatePicker from './DatePicker.jsx';

const SECTION_NOTE = {
  completed: (n) => `You finished ${n === 1 ? 'this issue' : `these ${n} issues`}.`,
  inProgress: (n) => `Work started or continued on ${n === 1 ? 'this issue' : `${n} issues`}.`,
  created: (n) => `You raised ${n === 1 ? 'a new issue' : `${n} new issues`}.`,
  other: () => 'Status changes, dates and assignments.',
};

function Headline({ report, date }) {
  const s = report.summary;
  if (!s.actions) return null;
  const day = relativeDay(date) === 'Today' ? 'Today' : `On ${formatLong(date).split(',')[0]}`;
  const bits = [];
  if (s.completed) bits.push(`completed ${s.completed} ${s.completed === 1 ? 'issue' : 'issues'}`);
  const touched = s.issues - s.completed;
  if (touched > 0) bits.push(`worked on ${touched} ${s.completed ? 'more' : touched === 1 ? 'issue' : 'issues'}`);
  if (s.created) bits.push(`created ${s.created}`);
  if (s.comments) bits.push(`left ${s.comments} ${s.comments === 1 ? 'comment' : 'comments'}`);
  const text = bits.length > 1 ? `${bits.slice(0, -1).join(', ')} and ${bits.at(-1)}` : bits[0];
  return (
    <p className="report-headline">
      {day} you {text ?? `made ${s.actions} updates`}.
    </p>
  );
}

export default function DailyReport({ date, userName, onDateChange, onOpenIssue, onError }) {
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
    await navigator.clipboard.writeText(reportText(report, formatLong(date), { me: userName }));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

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

      {report && report.groups.length === 0 && (
        <div className="empty">
          <FileText size={28} />
          <p>No PMS activity {relativeDay(date) === 'Today' ? 'yet today' : 'on this day'}.</p>
        </div>
      )}

      {report && report.groups.length > 0 && (
        <article className="report-doc">
          <Headline report={report} date={date} />

          {sections(report.groups).map((section) => (
            <section key={section.id} className={`report-section ${section.id}`}>
              <header>
                <h2>
                  {section.title} <span className="count-badge">{section.groups.length}</span>
                </h2>
                <p className="muted">{SECTION_NOTE[section.id](section.groups.length)}</p>
              </header>
              <ul>
                {section.groups.map((g, i) => (
                  <li key={g.issue?.key ?? `${section.id}-${i}`}>
                    <div className="report-line">
                      {g.issue ? (
                        <button className="report-issue" onClick={() => onOpenIssue(g.issue.id)}>
                          {g.issue.title ?? g.issue.key}
                        </button>
                      ) : (
                        <span className="report-issue plain">{g.project ?? 'Other'}</span>
                      )}
                      <span className="report-ref">
                        {g.issue?.title && <span className="key">{g.issue.key}</span>}
                        {g.project && g.issue && <span className="muted">{g.project}</span>}
                      </span>
                    </div>
                    <p className="report-sentence">{sentence(g.entries, { me: userName })}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </article>
      )}
    </div>
  );
}
