// Cleans description HTML from the dashboard's Quill editor before it goes to the PMS.
// Keeps only what the PMS toolbar can produce; everything else is unwrapped or dropped.
import { parse } from 'node-html-parser';

const ALLOWED = new Set(['p', 'br', 'strong', 'em', 'u', 's', 'a', 'ol', 'ul', 'li', 'h1', 'h2', 'h3', 'blockquote', 'pre', 'code', 'span']);
// Removed with everything inside them.
const DROPPED = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'img', 'svg', 'math', 'form', 'input', 'textarea', 'button', 'select']);
const QUILL_CLASS = /^ql-(align-(center|right|justify)|indent-[1-8]|syntax)$/;
const SAFE_HREF = /^(https?:|mailto:)/i;

const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function attrsFor(tag, el) {
  const out = [];
  const classes = (el.getAttribute('class') ?? '').split(/\s+/).filter((c) => QUILL_CLASS.test(c));
  if (classes.length) out.push(`class="${escapeAttr(classes.join(' '))}"`);
  if (tag === 'a') {
    const href = (el.getAttribute('href') ?? '').trim();
    if (SAFE_HREF.test(href)) out.push(`href="${escapeAttr(href)}"`, 'target="_blank"', 'rel="noopener noreferrer"');
  }
  if (tag === 'pre' && classes.includes('ql-syntax')) out.push('spellcheck="false"');
  return out.length ? ' ' + out.join(' ') : '';
}

function render(node) {
  if (node.nodeType === 3) return escapeText(node.text); // text, decoded then re-escaped
  if (node.nodeType !== 1) return ''; // comments
  const tag = node.rawTagName?.toLowerCase();
  if (DROPPED.has(tag)) return '';
  const inner = node.childNodes.map(render).join('');
  if (!ALLOWED.has(tag)) return inner;
  if (tag === 'br') return '<br>';
  return `<${tag}${attrsFor(tag, node)}>${inner}</${tag}>`;
}

export function cleanRichHtml(html) {
  const out = parse(String(html ?? '')).childNodes.map(render).join('').trim();
  // Quill's empty document is <p><br></p>; store nothing instead.
  return out.replace(/<[^>]+>/g, '').trim() ? out : '';
}
