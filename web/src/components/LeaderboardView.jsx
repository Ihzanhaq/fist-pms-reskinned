import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crown, Medal, RefreshCw, Trophy } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import { todayIso } from '../dates.js';
import Avatar from './Avatar.jsx';
import DateRangePicker from './DateRangePicker.jsx';
import Select from './Select.jsx';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
  { value: 'alltime', label: 'All time' },
];

const MEDALS = ['gold', 'silver', 'bronze'];

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function PodiumCard({ person, place, isMe, lifetime }) {
  const medal = MEDALS[place - 1];
  const Icon = place === 1 ? Crown : Medal;
  return (
    <div className={`podium-card place-${place} ${medal}`}>
      <span className="podium-badge">
        <Icon size={14} /> {place === 1 ? '1st' : place === 2 ? '2nd' : '3rd'}
      </span>
      <div className="podium-avatar">
        <Avatar id={person.id} name={person.name} size="large" />
      </div>
      <strong className="podium-name" title={person.name}>
        {person.name}
        {isMe && <span className="you-pill">You</span>}
      </strong>
      <span className="podium-score">{person.completed}</span>
      <span className="podium-label">completed</span>
      <span className="podium-meta">
        {lifetime
          ? `${person.closed} signed off · ${person.open} open`
          : `${person.closed} closed · ${plural(person.updates, 'update')}`}
      </span>
    </div>
  );
}

export default function LeaderboardView({
  period = 'week',
  rangeFrom,
  rangeTo,
  projectId = '',
  onPeriodChange,
  onRangeChange,
  onProjectChange,
  userName,
  onError,
}) {
  const [projects, setProjects] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [rangeOpen, setRangeOpen] = useState(false);

  const today = todayIso();
  const customFrom = rangeFrom ?? `${today.slice(0, 7)}-01`;
  const customTo = rangeTo ?? today;

  useEffect(() => {
    api
      .projects()
      .then(({ projects }) => setProjects(projects))
      .catch(() => {});
  }, []);

  // All time is counted on the server in the background; poll its progress
  // until it's ready. A newer load cancels an older one's polling.
  const loadId = useRef(0);
  const load = useCallback(
    async (refresh = false) => {
      if (period === 'custom' && (!rangeFrom || !rangeTo)) return;
      const id = ++loadId.current;
      setLoading(true);
      setError(null);
      setProgress(null);
      if (period === 'alltime') setData(null);
      try {
        let first = true;
        for (;;) {
          const result = await api.leaderboard(
            period,
            projectId || null,
            period === 'custom' ? rangeFrom : undefined,
            period === 'custom' ? rangeTo : undefined,
            refresh && first,
          );
          first = false;
          if (id !== loadId.current) return;
          if (result.status !== 'running') {
            setData(result);
            setProgress(null);
            break;
          }
          setProgress(result.progress);
          await new Promise((r) => setTimeout(r, 1200));
          if (id !== loadId.current) return;
        }
      } catch (err) {
        if (id !== loadId.current) return;
        if (err.code === 'session_expired') onError(err);
        setError(err);
      } finally {
        if (id === loadId.current) setLoading(false);
      }
    },
    [period, rangeFrom, rangeTo, projectId, onError],
  );

  useEffect(() => {
    load();
    return () => {
      loadId.current += 1; // stop polling when leaving or switching
    };
  }, [load]);

  useEffect(() => {
    if (period === 'custom') setRangeOpen(true);
  }, [period]);

  const selectPeriod = (value) => {
    if (value === 'custom') setRangeOpen(true);
    onPeriodChange(value);
  };

  const periodLabel = useMemo(() => {
    if (!data) return 'Top performers';
    if (data.period === 'alltime') return 'All time';
    return `${shortDate(data.from)} – ${shortDate(data.to)}`;
  }, [data]);

  const lifetime = data?.period === 'alltime';
  // Only people who did something; the podium needs completed work.
  const people = useMemo(
    () => (data?.people ?? []).filter((p) => p.updates > 0 || p.completed > 0 || p.closed > 0 || p.open > 0),
    [data],
  );
  const podium = people.filter((p) => p.completed > 0).slice(0, 3);
  const rest = people.slice(podium.length);
  const topScore = Math.max(1, ...people.map((p) => p.completed));
  const me = people.find((p) => p.name === userName);
  const above = me ? people.filter((p) => p.completed > me.completed).at(-1) : null;

  return (
    <div className="leaderboard">
      <div className="page-head">
        <div>
          <h1>Leaderboard</h1>
          <p className="subtitle">{data ? `Top performers · ${periodLabel}` : 'Top performers'}</p>
        </div>
        <div className="lb-controls">
          <div className="segmented">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                className={period === p.value ? 'active' : undefined}
                onClick={() => selectPeriod(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <DateRangePicker
              from={customFrom}
              to={customTo}
              max={today}
              open={rangeOpen}
              onOpenChange={setRangeOpen}
              onChange={onRangeChange}
              ariaLabel="Leaderboard date range"
            />
          )}
          <Select
            variant="compact"
            ariaLabel="Project"
            searchable
            value={projectId}
            onChange={onProjectChange}
            options={[{ value: '', label: 'All projects' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
          />
          <button className="icon-btn" onClick={() => load(true)} disabled={loading} title="Refresh" aria-label="Refresh">
            <RefreshCw size={17} className={loading ? 'spin' : undefined} />
          </button>
        </div>
      </div>

      {error && (
        <div className="error-card">
          <div>
            <strong>Could not load the leaderboard</strong>
            <p>{errorMessage(error)}</p>
          </div>
          <button className="secondary-btn" onClick={() => load()}>
            Try again
          </button>
        </div>
      )}

      {progress && (
        <div className="lb-progress" role="status">
          <strong>Counting every issue across {projectId ? 'this project' : 'all projects'}…</strong>
          <span className="lb-progress-bar">
            <span style={{ width: `${progress.total ? Math.max(4, (progress.done / progress.total) * 100) : 4}%` }} />
          </span>
          <span className="muted">
            {progress.total ? `${progress.done} of ${plural(progress.total, 'project')} read` : 'Finding projects…'} · this runs
            in the background, so you can leave this page and come back
          </span>
        </div>
      )}

      {!data && !error && !progress && <div className="dash-loading">Counting everyone’s work…</div>}

      {data && people.length === 0 && (
        <div className="empty">
          <Trophy size={28} />
          <p>{lifetime ? 'No assigned issues yet.' : 'No activity in this period yet.'}</p>
        </div>
      )}

      {data && people.length > 0 && (
        <>
          <div className="lb-summary">
            <div>
              <strong>{data.totals.completed}</strong>
              <span>issues completed</span>
            </div>
            <div>
              <strong>{data.totals.closed}</strong>
              <span>{lifetime ? 'signed off (Closed)' : 'closed after review'}</span>
            </div>
            <div>
              <strong>{data.totals.people}</strong>
              <span>{lifetime ? 'people with issues' : 'people active'}</span>
            </div>
            {me ? (
              <div className="lb-me">
                <strong>#{me.rank}</strong>
                <span>
                  your rank
                  {above
                    ? ` · ${above.completed - me.completed + 1} more to pass ${above.name.split(' ')[0]}`
                    : me.rank === 1
                      ? ' · top of the board'
                      : ''}
                </span>
              </div>
            ) : (
              <div>
                <strong>{lifetime ? data.totals.open : data.totals.updates}</strong>
                <span>{lifetime ? 'still open' : 'updates logged'}</span>
              </div>
            )}
          </div>

          {podium.length > 0 && (
            <section className={`podium count-${podium.length}`} aria-label="Top three">
              {podium.map((person, i) => (
                <PodiumCard
                  key={person.name}
                  person={person}
                  place={i + 1}
                  isMe={person.name === userName}
                  lifetime={lifetime}
                />
              ))}
            </section>
          )}

          {rest.length > 0 && (
            <section className={lifetime ? 'lb-table lifetime' : 'lb-table'} aria-label="Rankings">
              <div className="lb-head">
                <span>#</span>
                <span>Person</span>
                <span>Completed</span>
                {lifetime ? (
                  <>
                    <span>Signed off</span>
                    <span>Open</span>
                    <span>Projects</span>
                  </>
                ) : (
                  <>
                    <span>Closed</span>
                    <span>Started</span>
                    <span>Created</span>
                    <span>Updates</span>
                    <span>Active days</span>
                  </>
                )}
              </div>
              {rest.map((p) => (
                <div key={p.name} className={p.name === userName ? 'lb-row me' : 'lb-row'}>
                  <span className="lb-rank">{p.rank}</span>
                  <span className="lb-person">
                    <Avatar id={p.id} name={p.name} size="small" />
                    <span className="lb-name" title={p.name}>
                      {p.name}
                    </span>
                    {p.name === userName && <span className="you-pill">You</span>}
                  </span>
                  <span className="lb-completed">
                    <span className="lb-bar">
                      <span style={{ width: `${(p.completed / topScore) * 100}%` }} />
                    </span>
                    <strong>{p.completed}</strong>
                  </span>
                  {lifetime ? (
                    <>
                      <span className="lb-num">{p.closed}</span>
                      <span className="lb-num">{p.open}</span>
                      <span className="lb-num">{p.projects}</span>
                    </>
                  ) : (
                    <>
                      <span className="lb-num">{p.closed}</span>
                      <span className="lb-num">{p.started}</span>
                      <span className="lb-num">{p.created}</span>
                      <span className="lb-num">{p.updates}</span>
                      <span className="lb-num">{p.activeDays}</span>
                    </>
                  )}
                </div>
              ))}
            </section>
          )}

          <p className="muted lb-note">
            {lifetime
              ? 'Every issue counted by its assignee, as on the PMS project dashboard. Done, Resolved, Completed, Feedback and Closed count as completed; “Signed off” is how many of those are Closed. Rejected and Cancelled are left out.'
              : `Issues moved to Done, Resolved, Completed or Feedback, credited to the issue’s assignee; issues reopened since are not counted. “Closed” counts sign-offs by whoever closed them. From the PMS activity log${
                  data.truncated ? '; this period is very busy, so only the most recent activity was counted' : ''
                }.`}
          </p>
        </>
      )}
    </div>
  );
}
