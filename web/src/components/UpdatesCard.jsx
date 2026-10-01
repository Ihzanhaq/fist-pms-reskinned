import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Loader2, RefreshCw } from 'lucide-react';
import { api, errorMessage } from '../api.js';

const POLL_MS = 2000;
const GIVE_UP_MS = 10 * 60_000;

const when = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Waits for the server to come back on a different commit, then reloads.
async function waitForRestart(fromHash) {
  const start = Date.now();
  await new Promise((r) => setTimeout(r, 3000));
  while (Date.now() - start < GIVE_UP_MS) {
    try {
      const s = await api.updates();
      if (s.current?.hash !== fromHash || s.lastRun?.failed) return s;
    } catch {
      // Server is down while it updates.
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error('The update is taking too long. Close the app and open the shortcut again.');
}

export default function UpdatesCard() {
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

  const check = async () => {
    setChecking(true);
    setError(null);
    try {
      setStatus(await api.updates());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  };
  useEffect(() => {
    check();
  }, []);

  const update = async () => {
    setUpdating(true);
    setError(null);
    try {
      await api.applyUpdate();
      const after = await waitForRestart(status.current.hash);
      if (after.lastRun?.failed) {
        setStatus(after);
        setError('The update failed, so the previous version is still running. Details are below.');
        setUpdating(false);
      } else {
        window.location.reload();
      }
    } catch (err) {
      setError(errorMessage(err));
      setUpdating(false);
    }
  };

  const behind = status?.behind ?? [];
  const blocked = status && (!status.isRepo || status.dirty);

  return (
    <section className="settings-card">
      <header className="settings-head">
        <div>
          <h2>Updates</h2>
          <p className="muted">
            {!status
              ? 'Checking this copy…'
              : !status.isRepo
                ? 'This copy was not installed with git, so it cannot update itself.'
                : `Version ${status.current.hash} · ${when(status.current.date)}`}
          </p>
        </div>
        {status?.isRepo && !updating && (
          <button className="secondary-btn" onClick={check} disabled={checking}>
            <RefreshCw size={15} className={checking ? 'spin' : undefined} /> Check for updates
          </button>
        )}
      </header>

      {updating && (
        <p className="update-note">
          <Loader2 size={15} className="spin" /> Updating. The dashboard restarts and this page reloads by itself; it usually takes under a minute.
        </p>
      )}

      {!updating && status?.isRepo && !status.error && behind.length === 0 && !checking && (
        <p className="update-note ok">
          <CheckCircle2 size={15} /> You have the latest version.
        </p>
      )}

      {!updating && behind.length > 0 && (
        <>
          <p className="update-note">
            {behind.length} {behind.length === 1 ? 'update' : 'updates'} available:
          </p>
          <ul className="update-list">
            {behind.slice(0, 8).map((c) => (
              <li key={c.hash}>
                <span>{c.subject}</span>
                <span className="muted">{when(c.date)}</span>
              </li>
            ))}
            {behind.length > 8 && <li className="muted">and {behind.length - 8} more</li>}
          </ul>
          <button className="primary-btn" onClick={update} disabled={blocked}>
            <Download size={15} /> Update now
          </button>
        </>
      )}

      {status?.dirty && (
        <p className="update-note error">This copy has local code changes, so it has to be updated by hand (npm run update).</p>
      )}
      {status?.error && <p className="update-note error">{status.error}</p>}
      {error && <p className="update-note error">{error}</p>}
      {status?.lastRun?.failed && <pre className="update-log">{status.lastRun.log}</pre>}
    </section>
  );
}
