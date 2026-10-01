import { useLayoutEffect, useState } from 'react';

function scrollBounds(anchor) {
  const area = anchor.closest('.page, .drawer-body, .modal-body')?.getBoundingClientRect();
  return {
    top: Math.max(area?.top ?? 0, 0),
    bottom: Math.min(area?.bottom ?? window.innerHeight, window.innerHeight),
    left: Math.max(area?.left ?? 0, 8),
    right: Math.min(area?.right ?? window.innerWidth, window.innerWidth - 8),
  };
}

// Keeps dropdown menus inside the scroll area vertically and horizontally.
export function useMenuPlacement(open, anchorRef, menuRef, contentKey) {
  const [up, setUp] = useState(false);
  const [alignRight, setAlignRight] = useState(false);

  useLayoutEffect(() => {
    if (!open) {
      setUp(false);
      setAlignRight(false);
      return;
    }
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const a = anchor.getBoundingClientRect();
    const { top, bottom, right } = scrollBounds(anchor);
    const needed = menu.offsetHeight + 8;
    const below = bottom - a.bottom;
    const above = a.top - top;
    setUp(below < needed && above > below);

    const m = menu.getBoundingClientRect();
    setAlignRight(m.right > right);
  }, [open, anchorRef, menuRef, contentKey]);

  return { up, alignRight };
}

// Returns true when an open dropdown menu does not fit below its trigger but
// has more room above, so the caller can open it upwards instead.
export function useDropUp(open, anchorRef, menuRef, contentKey) {
  return useMenuPlacement(open, anchorRef, menuRef, contentKey).up;
}
