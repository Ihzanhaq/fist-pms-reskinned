import { useId } from 'react';
import { KeyRound, Loader2, Palette } from 'lucide-react';
import BrandMark from './BrandMark.jsx';
import Select from './Select.jsx';

export function Splash() {
  return (
    <div className="splash" role="status" aria-label="Loading">
      <BrandMark size={52} />
    </div>
  );
}

// Flowing abstract artwork in the current theme's brand colours.
function FlowArt() {
  const id = useId().replace(/:/g, '');
  const stop = (offset, color, opacity = 1) => <stop offset={offset} style={{ stopColor: color, stopOpacity: opacity }} />;
  return (
    <svg className="flow-art" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          {stop(0, 'color-mix(in srgb, var(--brand-3) 70%, #05060d)')}
          {stop(1, 'color-mix(in srgb, var(--brand-3) 35%, #020308)')}
        </linearGradient>
        <linearGradient id={`${id}-sweep`} x1="0" y1="0" x2="1" y2="0.6">
          {stop(0, 'var(--brand-2)')}
          {stop(0.55, 'color-mix(in srgb, var(--brand-2) 60%, var(--brand-3))')}
          {stop(1, 'var(--brand-3)', 0.2)}
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0" y2="1">
          {stop(0, '#ffffff', 0.95)}
          {stop(1, 'var(--brand-1)', 0.35)}
        </linearGradient>
        <linearGradient id={`${id}-wave`} x1="0" y1="0" x2="1" y2="1">
          {stop(0, 'color-mix(in srgb, var(--brand-3) 80%, #05060d)')}
          {stop(1, 'var(--brand-2)', 0.9)}
        </linearGradient>
        <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="60" />
        </filter>
      </defs>

      <rect width="600" height="800" fill={`url(#${id}-bg)`} />
      {/* soft light source top-left */}
      <circle cx="120" cy="120" r="170" style={{ fill: 'var(--brand-1)', opacity: 0.45 }} filter={`url(#${id}-glow)`} />
      {/* main sweeping shape with a lit edge */}
      <path d="M-40 -20 C 160 60, 300 220, 330 420 C 350 560, 470 640, 660 610 L 660 -20 Z" fill={`url(#${id}-sweep)`} opacity="0.9" />
      <path
        d="M-40 -20 C 160 60, 300 220, 330 420 C 350 560, 470 640, 660 610"
        fill="none"
        stroke={`url(#${id}-edge)`}
        strokeWidth="10"
        filter={`url(#${id}-soft)`}
      />
      <path d="M-40 -20 C 160 60, 300 220, 330 420 C 350 560, 470 640, 660 610" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.5" />
      {/* lower wave */}
      <path d="M-40 560 C 90 470, 230 470, 330 560 C 430 650, 540 640, 660 560 L 660 840 L -40 840 Z" fill={`url(#${id}-wave)`} opacity="0.95" />
      <path d="M-40 560 C 90 470, 230 470, 330 560 C 430 650, 540 640, 660 560" fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.2" />
      {/* depth glow bottom-right */}
      <circle cx="520" cy="760" r="160" style={{ fill: 'var(--brand-1)', opacity: 0.35 }} filter={`url(#${id}-glow)`} />
    </svg>
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

      <main className="signin-frame">
        <section className="signin-form">
          <div className="signin-inner">
            <BrandMark size={48} />
            <h1>{expired ? 'Welcome back' : 'Welcome to FIST PMS'}</h1>
            <p className="signin-lead">
              {expired ? 'Your session ended. Sign in again to pick up where you left off.' : 'Sign in with your FIST account to continue.'}
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
          </div>
          <p className="signin-foot">Issues, projects and daily reports for the FIST team.</p>
        </section>

        <section className="signin-art">
          <FlowArt />
        </section>
      </main>
    </div>
  );
}
