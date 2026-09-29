import { useEffect } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDone, 3500);
    return () => clearTimeout(timer);
  }, [toast, onDone]);

  if (!toast) return null;
  const Icon = toast.kind === 'error' ? XCircle : CheckCircle2;
  return (
    <div className={`toast toast-${toast.kind}`} role="status">
      <Icon size={18} />
      <span>{toast.text}</span>
    </div>
  );
}
