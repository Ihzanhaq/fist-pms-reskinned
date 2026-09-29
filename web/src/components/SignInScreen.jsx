import { useId, useState } from 'react';
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

// Three poses of each curve. Every pose uses the same commands so the shapes
// can morph smoothly between them.
const SWEEP = [
  'M-40 -20 C 160 60, 300 220, 330 420 C 350 560, 470 640, 660 610',
  'M-40 -20 C 210 40, 250 260, 360 400 C 430 520, 500 600, 660 650',
  'M-40 -20 C 130 100, 330 190, 300 450 C 285 590, 440 620, 660 575',
];
const SWEEP_CLOSE = ' L 660 -20 Z';
const WAVE = [
  'M-40 560 C 90 470, 230 470, 330 560 C 430 650, 540 640, 660 560',
  'M-40 600 C 110 520, 250 440, 350 520 C 450 600, 560 690, 660 600',
  'M-40 530 C 70 500, 200 530, 310 595 C 420 660, 520 610, 660 525',
];
const WAVE_CLOSE = ' L 660 840 L -40 840 Z';

// Loops pose 0 → 1 → 2 → 0 with eased timing.
function Morph({ values, dur }) {
  return (
    <animate
      attributeName="d"
      dur={dur}
      repeatCount="indefinite"
      calcMode="spline"
      keyTimes="0;0.33;0.66;1"
      keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"
      values={[...values, values[0]].join(';')}
    />
  );
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Flowing abstract artwork in the current theme's brand colours. Moves slowly
// unless the system asks for reduced motion.
function FlowArt() {
  const id = useId().replace(/:/g, '');
  const [animate] = useState(() => !prefersReducedMotion());
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
        <filter id={`${id}-spark`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="60" />
        </filter>
      </defs>

      <rect width="600" height="800" fill={`url(#${id}-bg)`} />
      {/* soft light source top-left */}
      <circle className="flow-glow a" cx="120" cy="120" r="170" style={{ fill: 'var(--brand-1)', opacity: 0.45 }} filter={`url(#${id}-glow)`} />
      {/* main sweeping shape with a lit edge */}
      <path d={SWEEP[0] + SWEEP_CLOSE} fill={`url(#${id}-sweep)`} opacity="0.9">
        {animate && <Morph values={SWEEP.map((d) => d + SWEEP_CLOSE)} dur="20s" />}
      </path>
      <path d={SWEEP[0]} fill="none" stroke={`url(#${id}-edge)`} strokeWidth="10" filter={`url(#${id}-soft)`}>
        {animate && <Morph values={SWEEP} dur="20s" />}
      </path>
      <path d={SWEEP[0]} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.5">
        {animate && <Morph values={SWEEP} dur="20s" />}
      </path>
      {/* a short run of light travelling along the edge */}
      {animate && (
        <path d={SWEEP[0]} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" pathLength="1" className="flow-spark" filter={`url(#${id}-spark)`}>
          <Morph values={SWEEP} dur="20s" />
        </path>
      )}
      {/* lower wave */}
      <path d={WAVE[0] + WAVE_CLOSE} fill={`url(#${id}-wave)`} opacity="0.95">
        {animate && <Morph values={WAVE.map((d) => d + WAVE_CLOSE)} dur="24s" />}
      </path>
      <path d={WAVE[0]} fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.2">
        {animate && <Morph values={WAVE} dur="24s" />}
      </path>
      {/* depth glow bottom-right */}
      <circle className="flow-glow b" cx="520" cy="760" r="160" style={{ fill: 'var(--brand-1)', opacity: 0.35 }} filter={`url(#${id}-glow)`} />
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
