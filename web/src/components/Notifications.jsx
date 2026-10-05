import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCircle2, Loader2 } from 'lucide-react';
import { useExtension } from '../useExtension.js';
import ClaudeIcon from './ClaudeIcon.jsx';

const TOAST_MS = 6000;
const TOASTED_KEY = 'pms-dashboard:toasted';
const SEEN_KEY = 'pms-dashboard:notifications-seen';

// Notifications are derived from app state; today that's only the Claude extension.
function useNotifications() {
  const ext = useExtension();
  const items = [];
  if (ext.status?.updateAvailable || ext.waiting) {
    items.push({
      id: `extension-${ext.status?.latest}`,
      icon: <ClaudeIcon size={16} />,
      title: 'Claude extension update',
      text: ext.waiting
        ? 'Confirm the install in Claude Desktop.'
        : `v${ext.status.installed} → v${ext.status.latest}. Update to get the newest Claude features.`,
      action: ext.waiting
        ? { label: 'Waiting…', busy: true }
        : { label: 'Update', busy: ext.installing, run: ext.install },
      error: ext.error,
    });
  }
  return items;
}

// Fixed position under an anchor, right-aligned to it. Rendered in <body> so the
// top bar's glass blur can't trap it.
function usePinnedBelow(anchorRef, active) {
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!active) return;
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [active, anchorRef]);
  return pos;
}

export default function Notifications() {
  const items = useNotifications();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [seen, setSeen] = useState(() => localStorage.getItem(SEEN_KEY) ?? '');
  const bellRef = useRef(null);
  const panelRef = useRef(null);
  const pos = usePinnedBelow(bellRef, open || Boolean(toast));

  const ids = items.map((i) => i.id).join(',');
  const unread = items.some((i) => !seen.split(',').includes(i.id));

  // A brief toast the first time each notification appears in this browser session.
  useEffect(() => {
    const shown = (sessionStorage.getItem(TOASTED_KEY) ?? '').split(',');
    const fresh = items.find((i) => !shown.includes(i.id) && !i.action.busy);
    if (!fresh) return;
    sessionStorage.setItem(TOASTED_KEY, [...shown, fresh.id].join(','));
    setToast(fresh);
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [ids]); // only when the set of notifications changes

  useEffect(() => {
    if (!open) return;
    setToast(null);
    localStorage.setItem(SEEN_KEY, ids);
    setSeen(ids);
    const onDown = (e) =>
      !panelRef.current?.contains(e.target) && !bellRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, ids]);

  return (
    <>
      <button
        ref={bellRef}
        className={open ? 'icon-btn notif-bell open' : 'icon-btn notif-bell'}
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        aria-label={unread ? 'Notifications (new)' : 'Notifications'}
        aria-expanded={open}
      >
        <Bell size={17} />
        {unread && <span className="notif-dot" />}
      </button>

      {open &&
        pos &&
        createPortal(
          <div className="notif-panel" ref={panelRef} style={pos} role="dialog" aria-label="Notifications">
            <header>Notifications</header>
            {items.length ? (
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <span className="notif-icon">{n.icon}</span>
                    <div>
                      <strong>{n.title}</strong>
                      <p>{n.text}</p>
                      {n.error && <p className="notif-error">{n.error}</p>}
                    </div>
                    {n.action && (
                      <button className="notif-action" onClick={n.action.run} disabled={n.action.busy || !n.action.run}>
                        {n.action.busy && <Loader2 size={13} className="spin" />}
                        {n.action.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="notif-empty">
                <CheckCircle2 size={16} /> You’re all caught up.
              </p>
            )}
          </div>,
          document.body,
        )}

      {toast &&
        !open &&
        pos &&
        createPortal(
          <button
            className="notif-toast"
            style={pos}
            onClick={() => setOpen(true)}
            onAnimationEnd={(e) => e.animationName === 'notif-out' && setToast(null)}
          >
            <span className="notif-icon">{toast.icon}</span>
            <span>
              <strong>{toast.title}</strong>
              <small>Click to view</small>
            </span>
          </button>,
          document.body,
        )}
    </>
  );
}
