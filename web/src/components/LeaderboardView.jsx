import { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, Medal, RefreshCw, Trophy } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import Avatar from './Avatar.jsx';
import Select from './Select.jsx';

const PERIODS = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: '30d', label: 'Last 30 days' },
];

const MEDALS = ['gold', 'silver', 'bronze'];

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function PodiumCard({ person, place, isMe }) {
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
        {person.closed} closed · {plural(person.updates, 'update')}
      </span>
    </div>
  );
}

export default function LeaderboardView({ userName, onError }) {
  const [period, setPeriod] = useState('week');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .projects()
      .then(({ projects }) => setProjects(projects))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.leaderboard(period, projectId || null));
    } catch (err) {
      if (err.code === 'session_expired') onError(err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [period, projectId, onError]);

  useEffect(() => {
    load();
  }, [load]);

  // Only people who did something; the podium needs completed work.
  const people = useMemo(() => (data?.people ?? []).filter((p) => p.updates > 0), [data]);
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
          <p className="subtitle">
            {data ? `Top performers · ${shortDate(data.from)} – ${shortDate(data.to)}` : 'Top performers'}
          </p>
        </div>
        <div className="lb-controls">
          <div className="segmented">
            {PERIODS.map((p) => (
              <button key={p.value} className={period === p.value ? 'active' : undefined} onClick={() => setPeriod(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
          <Select
            variant="compact"
            ariaLabel="Project"
            searchable
            value={projectId}
            onChange={setProjectId}
            options={[{ value: '', label: 'All projects' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
          />
          <button className="icon-btn" onClick={load} disabled={loading} title="Refresh" aria-label="Refresh">
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
          <button className="secondary-btn" onClick={load}>Try again</button>
        </div>
      )}

      {!data && !error && <div className="dash-loading">Counting everyone’s work…</div>}

      {data && people.length === 0 && (
        <div className="empty">
          <Trophy size={28} />
          <p>No activity in this period yet.</p>
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
              <span>closed after review</span>
            </div>
            <div>
              <strong>{data.totals.people}</strong>
              <span>people active</span>
            </div>
            {me ? (
              <div className="lb-me">
                <strong>#{me.rank}</strong>
                <span>
                  your rank
                  {above ? ` · ${above.completed - me.completed + 1} more to pass ${above.name.split(' ')[0]}` : me.rank === 1 ? ' · top of the board' : ''}
                </span>
              </div>
            ) : (
              <div>
                <strong>{data.totals.updates}</strong>
                <span>updates logged</span>
              </div>
            )}
          </div>

          {podium.length > 0 && (
            <section className={`podium count-${podium.length}`} aria-label="Top three">
              {podium.map((person, i) => (
                <PodiumCard key={person.name} person={person} place={i + 1} isMe={person.name === userName} />
              ))}
            </section>
          )}

          {rest.length > 0 && (
            <section className="lb-table" aria-label="Rankings">
              <div className="lb-head">
                <span>#</span>
                <span>Person</span>
                <span>Completed</span>
                <span>Closed</span>
                <span>Started</span>
                <span>Created</span>
                <span>Updates</span>
                <span>Active days</span>
              </div>
              {rest.map((p) => (
                <div key={p.name} className={p.name === userName ? 'lb-row me' : 'lb-row'}>
                  <span className="lb-rank">{p.rank}</span>
                  <span className="lb-person">
                    <Avatar id={p.id} name={p.name} size="small" />
                    <span className="lb-name" title={p.name}>{p.name}</span>
                    {p.name === userName && <span className="you-pill">You</span>}
                  </span>
                  <span className="lb-completed">
                    <span className="lb-bar">
                      <span style={{ width: `${(p.completed / topScore) * 100}%` }} />
                    </span>
                    <strong>{p.completed}</strong>
                  </span>
                  <span className="lb-num">{p.closed}</span>
                  <span className="lb-num">{p.started}</span>
                  <span className="lb-num">{p.created}</span>
                  <span className="lb-num">{p.updates}</span>
                  <span className="lb-num">{p.activeDays}</span>
                </div>
              ))}
            </section>
          )}

          <p className="muted lb-note">
            Ranked by issues moved to Done, Resolved or Completed. “Closed” counts sign-offs separately. From the PMS activity
            log{data.truncated ? '; this period is very busy, so only the most recent activity was counted' : ''}.
          </p>
        </>
      )}
    </div>
  );
}
