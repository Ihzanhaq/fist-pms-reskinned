import { useEffect, useState } from 'react';

// useState that is remembered in this browser (localStorage).
// isValid drops stored values that no longer make sense.
export function useStoredState(key, initial, isValid = () => true) {
  const [value, setValue] = useState(() => {
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
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or blocked: just not remembered
    }
  }, [key, value]);

  return [value, setValue];
}
