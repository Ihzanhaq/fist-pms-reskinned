import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Crown, Medal, X } from 'lucide-react';
import ClaudeIcon from './ClaudeIcon.jsx';

// "Seen" is remembered per person in this browser. Bump the version to show a new tour.
const TOUR_VERSION = 1;
const seenKey = (userKey) => `pms-dashboard:tour-seen:v${TOUR_VERSION}:${userKey}`;
export const hasSeenTour = (userKey) => Boolean(userKey) && localStorage.getItem(seenKey(userKey)) === '1';
export const markTourSeen = (userKey) => userKey && localStorage.setItem(seenKey(userKey), '1');

/* ---------- small illustrations drawn with the app's own styles ---------- */

function DashboardArt() {
  const bars = [30, 55, 20, 70, 45, 85, 60];
  return (
    <div className="ta ta-dash">
      <div className="ta-tiles">
        {[
          ['Pending', '4'],
          ['Done today', '6'],
          ['This week', '18'],
        ].map(([label, n]) => (
          <div key={label} className="ta-tile">
            <span>{label}</span>
            <strong>{n}</strong>
          </div>
        ))}
      </div>
      <div className="ta-chart">
        {bars.map((h, i) => (
          <span key={i} className={i === bars.length - 1 ? 'today' : undefined} style={{ height: `${h}%`, '--i': i * 60 }} />
        ))}
      </div>
    </div>
  );
}

function ReportArt() {
  return (
    <div className="ta ta-report">
      <p className="ta-report-head">Today you completed 3 issues and worked on 1 more.</p>
      <div className="ta-report-sec done">
        <span className="ta-report-label">Completed</span>
        <span className="ta-report-line">
          Fix login flow <em>· resolved at 11:40</em>
        </span>
        <span className="ta-report-line">
          Sync price sheet <em>· done at 16:05</em>
        </span>
      </div>
      <div className="ta-report-sec prog">
        <span className="ta-report-label">In progress</span>
        <span className="ta-report-line">
          Update invoice PDF <em>· started at 14:20</em>
        </span>
      </div>
      <span className="ta-copy">
        <Check size={11} strokeWidth={3} /> Copied as text
      </span>
    </div>
  );
}

function IssuesArt() {
  return (
    <div className="ta ta-issues">
      {[
        ['DEMO-12', 'Fix login flow', 'Done', true],
        ['DEMO-15', 'Update invoice PDF', 'In progress', false],
        ['DEMO-18', 'Sync price sheet', 'Todo', false],
      ].map(([key, title, status, checked], i) => (
        <div key={key} className={`ta-row${i === 1 ? ' lifted' : ''}`}>
          <span className={checked ? 'ta-check on' : 'ta-check'}>{checked && <Check size={10} strokeWidth={3} />}</span>
          <span className="ta-key">{key}</span>
          <span className="ta-title">{title}</span>
          <span className={`ta-pill s${i}`}>
            {status} <ChevronDown size={10} />
          </span>
        </div>
      ))}
      <div className="ta-menu">
        <span className="on">In progress</span>
        <span>Resolved</span>
        <span>Done</span>
      </div>
    </div>
  );
}

function LeaderboardArt() {
  return (
    <div className="ta ta-podium">
      {[
        { place: 2, name: 'Arsha', n: 15, cls: 'silver' },
        { place: 1, name: 'Sakeer', n: 18, cls: 'gold' },
        { place: 3, name: 'You', n: 13, cls: 'bronze' },
      ].map((p) => (
        <div key={p.place} className={`ta-step ${p.cls}`}>
          <span className="ta-medal">{p.place === 1 ? <Crown size={12} /> : <Medal size={12} />}</span>
          <span className="ta-avatar">{p.name[0]}</span>
          <strong>{p.n}</strong>
          <span className="ta-step-name">{p.name}</span>
          <span className="ta-block">{p.place}</span>
        </div>
      ))}
    </div>
  );
}

function ThemesArt() {
  const themes = [
    { name: 'Light', bg: '#f3f6f5', side: '#0f6b61', accent: '#059669' },
    { name: 'Dark', bg: '#0c0c11', side: '#16161d', accent: '#34d399' },
    { name: 'Lavender', bg: '#f4f3f9', side: '#9187cf', accent: '#8b6fe8' },
    { name: 'Navy', bg: '#070e1d', side: '#0b1631', accent: '#60a5fa' },
  ];
  return (
    <div className="ta ta-themes">
      {themes.map((t) => (
        <div key={t.name} className="ta-theme">
          <span className="ta-theme-view" style={{ background: t.bg }}>
            <span style={{ background: t.side }} />
            <span style={{ background: t.accent }} />
          </span>
          <span>{t.name}</span>
        </div>
      ))}
      <div className="ta-theme glass">
        <span className="ta-theme-view">
          <span />
          <span />
        </span>
        <span>Liquid glass</span>
      </div>
    </div>
  );
}

function ClaudeArt() {
  return (
    <div className="ta ta-chat">
      <span className="ta-bubble me">What’s overdue for me?</span>
      <span className="ta-bubble claude">
        <ClaudeIcon size={13} /> BMS-2 is due since 23 Sep. Want me to move it to In progress?
      </span>
      <span className="ta-bubble me">Yes, do it</span>
      <span className="ta-bubble claude done">
        <Check size={13} /> BMS-2 moved to In progress.
      </span>
    </div>
  );
}

const STEPS = [
  {
    art: DashboardArt,
    title: 'Welcome to your FIST PMS dashboard',
    body: 'Everything assigned to you in one place: what’s pending, what’s due next and how much you finished this week.',
  },
  {
    art: ReportArt,
    title: 'Your day, written for you',
    body: 'The Daily report turns your PMS activity into a readable summary — what you completed and what’s in progress. Copy it as text for your standup or manager.',
    action: { label: 'Open today’s report', view: 'report' },
  },
  {
    art: IssuesArt,
    title: 'Manage issues without leaving the page',
    body: 'Change status or assignee straight from the list, select several issues to update them together, and open any issue to read or comment.',
  },
  {
    art: LeaderboardArt,
    title: 'See who’s leading',
    body: 'The Leaderboard ranks everyone by issues completed this week or month, with sign-offs counted separately.',
  },
  {
    art: ThemesArt,
    title: 'Make it yours',
    body: 'Pick Light, Dark, Lavender, Navy or Liquid glass — with your own photo or gradient behind frosted panels.',
    action: { label: 'Open Settings', view: 'settings' },
  },
  {
    art: ClaudeArt,
    title: 'Ask Claude about your work',
    body: 'Connect Claude Desktop to check what’s due, update statuses and create issues just by asking.',
    action: { label: 'Set up Claude', view: 'claude' },
  },
];

export default function WelcomeTour({ userName, onClose, onNavigate }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const dialogRef = useRef(null);
  const last = step === STEPS.length - 1;
  const { art: Art, title, body, action } = STEPS[step];

  const go = useCallback((next) => {
    setStep((current) => {
      const target = Math.max(0, Math.min(STEPS.length - 1, next));
      setDir(target >= current ? 1 : -1);
      return target;
    });
  }, []);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setStep((s) => (setDir(1), Math.min(STEPS.length - 1, s + 1)));
      else if (e.key === 'ArrowLeft') setStep((s) => (setDir(-1), Math.max(0, s - 1)));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const firstName = userName?.split(' ')[0];

  return (
    <div className="tour-backdrop">
      <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" tabIndex={-1} ref={dialogRef}>
        <button className="icon-btn tour-close" onClick={onClose} aria-label="Skip the tour">
          <X size={18} />
        </button>

        <div className="tour-art" key={`art-${step}`} data-dir={dir}>
          <Art />
        </div>

        <div className="tour-body" key={`body-${step}`} data-dir={dir}>
          <span className="tour-count">
            {step === 0 && firstName ? `Hi ${firstName} · ` : ''}
            {step + 1} of {STEPS.length}
          </span>
          <h2 id="tour-title">{title}</h2>
          <p>{body}</p>
          {action && (
            <button className="link-btn tour-action" onClick={() => onNavigate(action.view)}>
              {action.label} <ArrowRight size={14} />
            </button>
          )}
        </div>

        <div className="tour-foot">
          {step > 0 ? (
            <button className="secondary-btn" onClick={() => go(step - 1)}>
              <ArrowLeft size={15} /> Back
            </button>
          ) : (
            <button className="link-btn tour-skip" onClick={onClose}>
              Skip tour
            </button>
          )}
          <div className="tour-dots" role="tablist" aria-label="Tour steps">
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                role="tab"
                aria-selected={i === step}
                aria-label={`Step ${i + 1}: ${s.title}`}
                className={i === step ? 'on' : undefined}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <button className="primary-btn tour-next" onClick={() => (last ? onClose() : go(step + 1))}>
            {last ? 'Get started' : 'Next'} {!last && <ArrowRight size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
