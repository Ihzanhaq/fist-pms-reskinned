import { useId } from 'react';

// FIST PMS mark: an "F" drawn as task rows — a full bar (done), a shorter bar
// (in progress) and a dot (next up) — on a tile in the current theme's brand colours.
export default function BrandMark({ size = 34, className = 'brand-mark' }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="FIST PMS">
      <defs>
        <linearGradient id={`${id}-tile`} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--brand-1)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--brand-2)' }} />
          <stop offset="1" style={{ stopColor: 'var(--brand-3)' }} />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="16" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id}-tile)`} />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill={`url(#${id}-shine)`} stroke="#fff" strokeOpacity="0.18" />
      {/* stem + top bar: the done row */}
      <path d="M9 10.5A2.5 2.5 0 0 1 11.5 8h9a2.5 2.5 0 0 1 0 5H12v10.5a1.5 1.5 0 0 1-3 0V10.5Z" fill="#fff" />
      {/* in-progress row */}
      <rect x="13.4" y="15" width="6.4" height="3.6" rx="1.8" fill="#fff" fillOpacity="0.78" />
      {/* next-up dot */}
      <circle cx="23" cy="16.8" r="1.8" fill="#fff" fillOpacity="0.5" />
    </svg>
  );
}
