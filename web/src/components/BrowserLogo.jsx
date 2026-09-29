import { useId } from 'react';

// Brand marks for the browsers the PMS login can open, in each brand's own colours.
function Chrome({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 24 L4.95 13 A22 22 0 0 1 43.05 13 Z" />
      <path fill="#FBBC04" d="M24 24 L43.05 13 A22 22 0 0 1 24 46 Z" />
      <path fill="#34A853" d="M24 24 L24 46 A22 22 0 0 1 4.95 13 Z" />
      <circle cx="24" cy="24" r="10" fill="#fff" />
      <circle cx="24" cy="24" r="8" fill="#4285F4" />
    </svg>
  );
}

function Edge({ size }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0C59A4" />
          <stop offset="1" stopColor="#114A8B" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1B9DE2" />
          <stop offset="0.6" stopColor="#35C1F1" />
          <stop offset="1" stopColor="#66EB6E" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id}-b)`}
        d="M24 3C12.4 3 3 12.4 3 24c0 3 .6 5.8 1.8 8.4C6.3 22.6 14.3 16 23.4 16c6.5 0 11.5 3.6 11.5 8.3 0 2.2-1.3 3.4-2.4 4.1 4.8 1.4 12.5-.6 12.5-6.4C45 11.6 35.6 3 24 3z"
      />
      <path
        fill={`url(#${id}-a)`}
        d="M4.8 32.4C8 40 15.4 45 24 45c6.8 0 12.8-3.2 16.6-8.2-6 3-15.8 2.7-20.4-3.3-2.4-3.1-2.2-7.4.6-9.6-7.8.4-13.8 3.6-16 8.5z"
      />
    </svg>
  );
}

function Brave({ size }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF5601" />
          <stop offset="1" stopColor="#FF2000" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id}-g)`}
        d="M39 12l1.5-3.6L36.6 4H11.4L7.5 8.4 9 12l-2 5.6 5.7 21.6c1 3.8 2.8 5.1 5.4 6.9L24 50l5.9-3.9c2.6-1.8 4.4-3.1 5.4-6.9L41 17.6 39 12z"
        transform="translate(0 -2)"
      />
      <path
        fill="#fff"
        d="M24 30.6c.4 0 3 1.3 4.6 2.5.5.4.4.9-.1 1.3l-3.4 2.6c-.6.4-1.6.4-2.2 0l-3.4-2.6c-.5-.4-.6-.9-.1-1.3 1.6-1.2 4.2-2.5 4.6-2.5zm9.2-14.8l1.8.6-2.4 7.8c-.4 1.4-.9 2-1.9 2.3l-3 .8c-.5.1-.7.6-.4 1l2 2.7-3.4-.9c-.6-.2-1.1-.8-1.1-1.4v-2.3l2.7-2.2c.4-.3.4-.9 0-1.2L24 21.1l-3.5 1.9c-.4.3-.4.9 0 1.2l2.7 2.2v2.3c0 .6-.5 1.2-1.1 1.4l-3.4.9 2-2.7c.3-.4.1-.9-.4-1l-3-.8c-1-.3-1.5-.9-1.9-2.3l-2.4-7.8 1.8-.6c1.6-.5 3.3-.5 4.8.1L24 16l4.4-.1c1.5-.6 3.2-.6 4.8-.1z"
      />
    </svg>
  );
}

const LOGOS = { chrome: Chrome, msedge: Edge, brave: Brave };

export default function BrowserLogo({ id, size = 22 }) {
  const Logo = LOGOS[id];
  return Logo ? <Logo size={size} /> : null;
}
