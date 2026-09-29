// Click handler for a whole issue row. Clicks on the row's own controls
// (checkbox, dropdowns, title button) and text selections are left alone.
const CONTROLS = 'button, a, input, select, textarea, label, [role="listbox"], [role="option"], [role="menu"], [role="dialog"]';

export const rowClick = (open) => (e) => {
  if (e.target.closest(CONTROLS)) return;
  if (window.getSelection()?.toString()) return;
  open();
};
