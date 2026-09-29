import { useLayoutEffect, useState } from 'react';

// Returns true when an open dropdown menu does not fit below its trigger but
// has more room above, so the caller can open it upwards instead.
// Measures against the scrolling area it lives in (page, panel or modal).
export function useDropUp(open, anchorRef, menuRef, contentKey) {
  const [up, setUp] = useState(false);

  useLayoutEffect(() => {
    if (!open) {
      setUp(false);
      return;
    }
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const a = anchor.getBoundingClientRect();
    const area = anchor.closest('.page, .drawer-body, .modal-body')?.getBoundingClientRect();
    const top = Math.max(area?.top ?? 0, 0);
    const bottom = Math.min(area?.bottom ?? window.innerHeight, window.innerHeight);
    const needed = menu.offsetHeight + 8;
    const below = bottom - a.bottom;
    const above = a.top - top;
    setUp(below < needed && above > below);
  }, [open, anchorRef, menuRef, contentKey]);

  return up;
}
