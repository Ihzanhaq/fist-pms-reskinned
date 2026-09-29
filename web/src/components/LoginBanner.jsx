import { Loader2, LogIn } from 'lucide-react';

export default function LoginBanner({ expired, loggingIn, onLogin }) {
  return (
    <div className="login-card">
      <div className="login-icon">
        <LogIn size={22} />
      </div>
      <h2>{expired ? 'Your PMS session expired' : 'Connect to FIST PMS'}</h2>
      <p>
        A browser window will open on the FIST sign-in page. Sign in there and the window closes by itself.
        The dashboard never sees your password.
      </p>
      <button className="primary-btn" onClick={onLogin} disabled={loggingIn}>
        {loggingIn ? (
          <>
            <Loader2 size={16} className="spin" /> Waiting for sign-in…
          </>
        ) : (
          'Log in'
        )}
      </button>
    </div>
  );
}
