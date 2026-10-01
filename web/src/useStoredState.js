import { useEffect, useState } from 'react';
import { FILTER_KEY_PREFIX, rememberFilters } from './filterMemory.js';

// useState that is remembered in this browser (localStorage).
// isValid drops stored values that no longer make sense.
export function useStoredState(key, initial, isValid = () => true, { enabled = true } = {}) {
  const [value, setValue] = useState(() => {
    if (!enabled) return initial;
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const stored = JSON.parse(raw);
        if (isValid(stored)) return stored;
      }
    } catch {
      // unreadable: fall back to the default
    }
    return initial;
  });

  useEffect(() => {
    if (!enabled) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or blocked: just not remembered
    }
  }, [key, value, enabled]);

  return [value, setValue];
}

// A filter kept outside the URL; only remembered when "Remember filters" is on.
export function useFilterState(name, initial, isValid) {
  return useStoredState(FILTER_KEY_PREFIX + name, initial, isValid, { enabled: rememberFilters() });
}
