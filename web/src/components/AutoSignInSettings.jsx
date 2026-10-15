import { useEffect, useState } from 'react';
import { ExternalLink, Fingerprint, Loader2, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../api.js';
import Switch from './Switch.jsx';

const FISSO_SIGNING_IN = 'https://auth.fistinnovations.com/realms/fistinnovations/account/account-security/signing-in';

function SetupForm({ onDone, again }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(await api.setupAutoLogin(username, password));
      setPassword('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auto-signin-form" onSubmit={submit}>
      <div className="field-row">
        <label className="field">
          <span>FISSO username</span>
          <input
            className="input"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            required
          />
        </label>
      </div>
      <div className="auto-signin-actions">
        <button className="primary-btn" type="submit" disabled={busy || !username.trim() || !password}>
          {busy ? (
            <>
              <Loader2 size={16} className="spin" /> Waiting for FISSO…
            </>
          ) : again ? (
            'Set up again'
          ) : (
            'Set up'
          )}
        </button>
        <span className="muted small">
          {busy
            ? 'Confirm your passkey in the FISSO window. The rest happens by itself.'
            : 'A FISSO window opens: confirm your passkey there once.'}
        </span>
      </div>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

function NewPasswordForm({ onDone }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(await api.updateAutoLoginPassword(password));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auto-signin-form" onSubmit={submit}>
      <label className="field">
        <span>New FISSO password</span>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          required
        />
      </label>
      <div className="auto-signin-actions">
        <button className="primary-btn" type="submit" disabled={busy || !password}>
          {busy ? <Loader2 size={16} className="spin" /> : null} Save password
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

export default function AutoSignInSettings() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.autoLogin().then(setStatus, (err) => setError(errorMessage(err)));
  }, []);

  const run = async (fn) => {
    setError('');
    try {
      setStatus(await fn());
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = () => {
    if (!window.confirm('Turn off automatic sign-in and delete the saved password from this computer?')) return;
    run(api.removeAutoLogin);
  };

  const saved = status && status.username;
  const passwordProblem = /password/i.test(status?.pausedReason ?? '');

  return (
    <section className="settings-card auto-signin">
      <header className="settings-head">
        <div>
          <h2>
            <Fingerprint size={17} aria-hidden /> Automatic sign-in
          </h2>
          <p className="muted">
            Sign in to FISSO without the login window, like the HRMS app. Your password and a code generator are
            saved encrypted for your Windows account only.
          </p>
        </div>
      </header>

      {!status && !error && (
        <p className="loading-line">
          <Loader2 size={16} className="spin" /> Loading…
        </p>
      )}

      {status && !status.supported && <p className="muted">Available on Windows only.</p>}

      {status?.supported && !saved && <SetupForm onDone={setStatus} />}

      {saved && (
        <>
          {status.pausedReason ? (
            <div className="auto-signin-paused">
              <strong>Paused:</strong> {status.pausedReason}
            </div>
          ) : (
            <p className="auto-signin-on">
              On for <strong>{status.username}</strong>. This computer is listed in FISSO as “{status.label}”.
            </p>
          )}

          {status.pausedReason &&
            (passwordProblem ? <NewPasswordForm onDone={setStatus} /> : <SetupForm onDone={setStatus} again />)}

          <div className="pref-row">
            <div>
              <strong>Ask for Windows Hello</strong>
              <p className="muted">
                {status.askHello
                  ? 'Fingerprint, face or PIN before each sign-in. Background checks never ask; they wait for you.'
                  : 'Signs in with no prompt at all. Anyone using your Windows account can then use your FISSO login.'}
              </p>
            </div>
            <Switch on={status.askHello} onChange={(on) => run(() => api.setAutoLoginHello(on))} label="Ask for Windows Hello" />
          </div>

          <div className="pref-row">
            <div>
              <strong>Turn off</strong>
              <p className="muted">
                Deletes the saved password here. Also remove “{status.label}” from your FISSO{' '}
                <a href={FISSO_SIGNING_IN} target="_blank" rel="noreferrer">
                  signing-in settings <ExternalLink size={12} aria-hidden />
                </a>
                .
              </p>
            </div>
            <button className="secondary-btn" onClick={remove}>
              <Trash2 size={15} /> Turn off
            </button>
          </div>
        </>
      )}

      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
