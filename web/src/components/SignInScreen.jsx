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
          <BrandMark size={40} />
          <strong>FIST PMS</strong>
        </div>
        <p className="signin-tagline">Issues, projects and daily reports for the FIST team.</p>
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

        </div>
      </section>
    </div>
  );
}
