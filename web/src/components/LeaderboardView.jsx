import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crown, Medal, RefreshCw, Trophy } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import Avatar from './Avatar.jsx';
import Select from './Select.jsx';

// Same periods as the PMS leaderboard, which this view mirrors.
const PERIODS = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'alltime', label: 'All time' },
];

const MEDALS = ['gold', 'silver', 'bronze'];

function PodiumCard({ person, isMe }) {
  const place = person.rank;
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
      <span className="podium-meta">{person.meta}</span>
    </div>
  );
}

export default function LeaderboardView({ period = 'week', projectId = '', onPeriodChange, onProjectChange, userName, onError }) {
  const [projects, setProjects] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  // Older saved links may hold periods the PMS no longer offers.
  const activePeriod = PERIODS.some((p) => p.value === period) ? period : 'week';

  useEffect(() => {
    api
      .projects()
      .then(({ projects }) => setProjects(projects))
      .catch(() => {});
  }, []);

  // A newer load wins over an older one still in flight.
  const loadId = useRef(0);
  const load = useCallback(
    async (refresh = false) => {
      const id = ++loadId.current;
      setLoading(true);
      setError(null);
      try {
        const result = await api.leaderboard(activePeriod, projectId || null, refresh);
        if (id === loadId.current) setData(result);
      } catch (err) {
        if (id !== loadId.current) return;
        if (err.code === 'session_expired') onError(err);
        setError(err);
      } finally {
        if (id === loadId.current) setLoading(false);
      }
    },
    [activePeriod, projectId, onError],
  );

  useEffect(() => {
    load();
    return () => {
      loadId.current += 1;
    };
  }, [load]);

  const people = data?.people ?? [];
  const podium = data?.podium ?? [];
  const rest = data?.rows ?? [];
  const topScore = useMemo(() => Math.max(1, ...people.map((p) => p.completed)), [people]);

  return (
    <div className="leaderboard">
      <div className="page-head">
        <div>
          <h1>Leaderboard</h1>
          <p className="subtitle">{data?.subtitle || 'Top performers'}</p>
        </div>
        <div className="lb-controls">
          <div className="segmented">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                className={activePeriod === p.value ? 'active' : undefined}
                onClick={() => onPeriodChange(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
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

      {!data && !error && <div className="dash-loading">Loading the leaderboard…</div>}

      {data && (
        <>
          {data.stats.length > 0 && (
            <div className="lb-summary">
              {data.stats.map((s) => (
                <div key={s.label} className={s.isRank ? 'lb-me' : undefined}>
                  <strong>{s.value}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {people.length === 0 && (
            <div className="empty">
              <Trophy size={28} />
              <p>No activity in this period yet.</p>
            </div>
          )}

          {podium.length > 0 && (
            <section className={`podium count-${podium.length}`} aria-label="Top three">
              {podium.map((person) => (
                <PodiumCard key={person.name} person={person} isMe={person.name === userName} />
              ))}
            </section>
          )}

          {rest.length > 0 && (
            <section className="lb-table" aria-label="Rankings">
              <div className="lb-head">
                <span>#</span>
                <span>Person</span>
                <span>Completed</span>
                <span>Created</span>
                <span>Comments</span>
                <span>Status changes</span>
                <span>Updates</span>
                <span>Active days</span>
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
                  <span className="lb-num">{p.created}</span>
                  <span className="lb-num">{p.comments}</span>
                  <span className="lb-num">{p.statusChanges}</span>
                  <span className="lb-num">{p.updates}</span>
                  <span className="lb-num">{p.activeDays}</span>
                </div>
              ))}
            </section>
          )}

          {data.note && <p className="muted lb-note">{data.note}</p>}
        </>
      )}
    </div>
  );
}
