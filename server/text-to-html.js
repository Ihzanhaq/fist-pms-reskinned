// The PMS stores descriptions as Quill editor HTML: one <p> per line,
// blank lines as <p><br></p>.
const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function textToHtml(text) {
  const trimmed = (text ?? '').replace(/\r\n/g, '\n').trim();
  if (!trimmed) return '';
  return trimmed
    .split('\n')
    .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : '<p><br></p>'))
    .join('');
}
