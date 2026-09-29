import { BarChart3, Check, KeyRound, ListChecks, Loader2, Lock, Palette } from 'lucide-react';
import BrandMark from './BrandMark.jsx';
import Select from './Select.jsx';

const FEATURES = [
  { icon: BarChart3, text: 'Dashboard and daily report of your work' },
  { icon: ListChecks, text: 'Update statuses one by one or in bulk' },
  { icon: KeyRound, text: 'Use it from Claude with the same login' },
];

// Echoes the logo: a finished row, a row in progress, and what's next.
function TaskStack() {
  return (
    <div className="task-stack" aria-hidden="true">
      <div className="task-card done">
        <span className="task-check">
          <Check size={13} strokeWidth={3} />
        </span>
        <span className="task-lines">
          <span className="task-line w70" />
          <span className="task-line w40 soft" />
        </span>
        <span className="task-pill">Resolved</span>
      </div>
      <div className="task-card progress">
        <span className="task-ring" />
        <span className="task-lines">
          <span className="task-line w55" />
          <span className="task-line w30 soft" />
        </span>
        <span className="task-pill">In progress</span>
      </div>
      <div className="task-card next">
        <span className="task-dot" />
        <span className="task-lines">
          <span className="task-line w45" />
          <span className="task-line w25 soft" />
        </span>
      </div>
    </div>
  );
}

export function Splash() {
  return (
    <div className="splash" role="status" aria-label="Loading">
      <BrandMark size={52} />
    </div>
  );
}

export default function SignInScreen({ expired, loggingIn, onLogin, themes, theme, onThemeChange }) {
  return (
    <div className="signin">
      <div className="signin-theme">
        <Select
          variant="compact"
          iconOnly
          ariaLabel="Theme"
          prefix={<Palette size={17} />}
          value={theme}
          onChange={onThemeChange}
          options={themes.map((t) => ({ value: t.id, label: t.name, dot: t.preview?.accent ?? 'linear-gradient(135deg, #7cc4ff, #ff9ab8)' }))}
        />
      </div>

      <section className="signin-brand">
        <div className="signin-logo">
          <BrandMark size={44} />
          <span>
            <strong>FIST PMS</strong>
            <span>Issue dashboard</span>
          </span>
        </div>

        <div className="signin-pitch">
          <h1>Your PMS issues, at a glance.</h1>
          <p>See what’s due, move work along and share your day — using your own FIST login.</p>
          <ul>
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text}>
                <span className="signin-feature-icon">
                  <Icon size={16} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <TaskStack />
      </section>

      <section className="signin-panel">
        <div className="signin-card">
          <h2>{expired ? 'Your session ended' : 'Sign in'}</h2>
          <p className="signin-lead">
            {expired
              ? 'FIST signed you out after a while away. Sign in again to pick up where you left off.'
              : 'Use your FIST account to open your issues, projects and reports.'}
          </p>

          <button className="primary-btn signin-btn" onClick={onLogin} disabled={loggingIn}>
            {loggingIn ? (
              <>
                <Loader2 size={17} className="spin" /> Waiting for you to sign in…
              </>
            ) : (
              <>
                <KeyRound size={17} /> Sign in with FIST
              </>
            )}
          </button>

          <p className="signin-help">
            {loggingIn
              ? 'Finish signing in on the FIST page that opened. Don’t see it? It may be behind this window.'
              : 'A sign-in window opens on FIST’s own page and closes by itself when you’re done.'}
          </p>

          <div className="signin-note">
            <Lock size={14} />
            <span>Your password goes only to FIST’s sign-in page. This dashboard never sees it.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
