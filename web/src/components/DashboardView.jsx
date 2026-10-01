import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, RefreshCw, Table2, BarChart3 } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import { dayOfMonth, formatLong, formatShort, weekdayLetter } from '../dates.js';
import { BarList, ColumnChart, Sparkline } from './charts.jsx';
import Select from './Select.jsx';

const RANGES = [
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
];

function StatTile({ label, value, detail, children }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <div className="stat-row">
        <span className="stat-value">{value}</span>
        {children}
      </div>
      {detail && <span className="stat-detail">{detail}</span>}
    </div>
  );
}

const DONE_PREVIEW = 10;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function DashboardView({ days = 14, onDaysChange, onOpenIssue, onOpenReport, onError }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [asTable, setAsTable] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.dashboard(days));
    } catch (err) {
      if (err.code === 'session_expired') onError(err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [days, onError]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="dash">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">{data ? formatLong(data.today) : ' '}</p>
        </div>
        <button className="icon-btn" onClick={load} disabled={loading} title="Refresh">
          <RefreshCw size={17} className={loading ? 'spin' : undefined} />
        </button>
      </div>

      {error && (
        <div className="error-card">
          <div>
            <strong>Could not load the dashboard</strong>
            <p>{errorMessage(error)}</p>
          </div>
          <button className="secondary-btn" onClick={load}>Try again</button>
        </div>
      )}

      {!data && !error && <div className="dash-loading">Loading your numbers…</div>}

      {data && (
        <>
          <section className="stats">
            <StatTile
              label="Pending"
              value={data.pending.total}
              detail={
                data.pending.overdue || data.pending.dueToday
                  ? `${data.pending.overdue} overdue · ${data.pending.dueToday} due today`
                  : 'Nothing overdue'
              }
            />
            <StatTile label="Completed today" value={data.completed.today} detail={`${plural(data.actionsToday, 'update')} today`} />
            <StatTile
              label={`Completed · last ${data.days} days`}
              value={data.completed.inPeriod}
              detail={`${(data.completed.inPeriod / data.days).toFixed(1)} per day on average`}
            >
              <Sparkline values={data.daily.map((d) => d.completed)} />
            </StatTile>
            <StatTile label="Completed · all time" value={data.completed.total.toLocaleString()} detail="Issues assigned to you" />
          </section>

          <div className="dash-grid">
          <section className="card chart-card">
            <header className="card-head">
              <div>
                <h2>Completed per day</h2>
                <p className="muted">Issues you moved to Done, Resolved, Completed or Closed</p>
              </div>
              <div className="card-actions">
                <Select variant="compact" ariaLabel="Period" value={days} onChange={onDaysChange} options={RANGES} />
                <button
                  className="icon-btn"
                  onClick={() => setAsTable((t) => !t)}
                  title={asTable ? 'Show chart' : 'Show as table'}
                  aria-pressed={asTable}
                >
                  {asTable ? <BarChart3 size={17} /> : <Table2 size={17} />}
                </button>
              </div>
            </header>
            {asTable ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Completed</th>
                    <th>Updates</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.daily].reverse().map((d) => (
                    <tr key={d.date}>
                      <td>{formatShort(d.date)}</td>
                      <td>{d.completed}</td>
                      <td>{d.actions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <ColumnChart
                ariaLabel={`Issues completed per day, last ${data.days} days`}
                data={data.daily.map((d) => ({
                  key: d.date,
                  label: dayOfMonth(d.date),
                  sub: weekdayLetter(d.date),
                  value: d.completed,
                  tip: (
                    <>
                      <strong>{formatShort(d.date)}</strong>
                      <span>{plural(d.completed, 'completed')}</span>
                      <span className="muted">{plural(d.actions, 'update')}</span>
                    </>
                  ),
                }))}
              />
            )}
          </section>

            <div className="dash-side">
              <section className="card">
                <header className="card-head">
                  <h2>Up next</h2>
                  <span className="muted small">{data.pending.total} pending</span>
                </header>
                {data.pending.upcoming.length ? (
                  <ul className="next-list">
                    {data.pending.upcoming.map((i) => (
                      <li key={i.key}>
                        <button onClick={() => onOpenIssue(i.id)}>
                          <span className="dot" style={{ background: i.status.color ?? '#94a3b8' }} title={i.status.name} />
                          <span className="next-title">{i.title}</span>
                          <span className={i.overdue ? 'next-due overdue' : 'next-due'}>
                            {i.targetDate ? (i.overdue ? `Overdue · ${formatShort(i.targetDate)}` : formatShort(i.targetDate)) : 'No date'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted empty-note">Nothing pending.</p>
                )}
              </section>
            </div>
          </div>

          <div className="dash-pair">
            <section className="card">
              <header className="card-head">
                <h2>Pending by status</h2>
              </header>
              {data.pending.byStatus.length ? (
                <BarList rows={data.pending.byStatus.map((s) => ({ label: s.name, value: s.count, dot: s.color ?? '#94a3b8' }))} />
              ) : (
                <p className="muted empty-note">No pending issues.</p>
              )}
            </section>
            <section className="card">
              <header className="card-head">
                <h2>Pending by project</h2>
              </header>
              {data.pending.byProject.length ? (
                <BarList rows={data.pending.byProject.map((p) => ({ label: p.name, value: p.count }))} />
              ) : (
                <p className="muted empty-note">No pending issues.</p>
              )}
            </section>
          </div>

          <section className="card">
            <header className="card-head">
              <div>
                <h2>Completed today</h2>
                <p className="muted">{data.completed.today ? plural(data.completed.today, 'issue') + ' finished' : 'Nothing finished yet today'}</p>
              </div>
              <button className="link-btn" onClick={onOpenReport}>
                Daily report <ArrowRight size={14} />
              </button>
            </header>
            {data.completed.todayIssues.length > 0 && (
              <>
                <ul className="done-grid">
                  {(showAll ? data.completed.todayIssues : data.completed.todayIssues.slice(0, DONE_PREVIEW)).map((i) => (
                    <li key={i.key}>
                      <button onClick={() => onOpenIssue(i.id)}>
                        <CheckCircle2 size={16} className="done-icon" />
                        <span className="done-title">{i.title ?? i.key}</span>
                        <span className="key">{i.key}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {data.completed.todayIssues.length > DONE_PREVIEW && (
                  <button className="link-btn show-all" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Show fewer' : `Show all ${data.completed.todayIssues.length}`}
                  </button>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
