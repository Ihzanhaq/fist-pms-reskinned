export default function Switch({ on, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      className={on ? 'ui-switch on' : 'ui-switch'}
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      <span className="ui-switch-thumb" aria-hidden />
    </button>
  );
}
