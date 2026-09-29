import { useCallback, useEffect, useState } from 'react';

// Light/dark theme. The saved choice wins; otherwise follow the system setting.
// index.html applies the same rule before React loads, so there is no flash.
const KEY = 'pms-dashboard:theme';

const systemTheme = () => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function apply(theme) {
  document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem(KEY) ?? systemTheme());

  useEffect(() => apply(theme), [theme]);

  // Follow system changes until the user picks a theme themselves.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => !localStorage.getItem(KEY) && setTheme(systemTheme());
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      localStorage.setItem(KEY, next);
      return next;
    });
  }, []);

  return [theme, toggle];
}
