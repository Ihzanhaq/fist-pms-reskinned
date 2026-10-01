// How project cards and headers show icons (emoji vs initial).
export function projectIconLabel(project, showEmojis) {
  const icon = project.icon?.trim();
  if (showEmojis && icon) return icon;
  const ch = project.name?.trim()[0];
  return ch ? ch.toUpperCase() : '?';
}
