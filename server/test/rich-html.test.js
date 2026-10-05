import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanRichHtml } from '../rich-html.js';

test('keeps Quill formatting', () => {
  const html = '<h2>T</h2><p>a <strong>b</strong> <em>c</em> <u>d</u> <s>e</s></p><ol><li class="ql-indent-1">x</li></ol><ul><li>y</li></ul><blockquote>q</blockquote>';
  assert.equal(cleanRichHtml(html), html);
});

test('keeps safe links and forces them to open in a new tab', () => {
  assert.equal(
    cleanRichHtml('<p><a href="https://x.com">ok</a></p>'),
    '<p><a href="https://x.com" target="_blank" rel="noopener noreferrer">ok</a></p>',
  );
});

test('drops scripts, handlers, unsafe links and images', () => {
  const out = cleanRichHtml('<p onclick="x"><a href="javascript:alert(1)">bad</a></p><script>alert(1)</script><img src=x onerror=alert(1)>');
  assert.equal(out, '<p><a>bad</a></p>');
});

test('unwraps unknown tags, keeps only Quill classes, escapes text', () => {
  assert.equal(
    cleanRichHtml('<div style="x"><h2 class="ql-align-center evil">1 &lt; 2</h2></div>'),
    '<h2 class="ql-align-center">1 &lt; 2</h2>',
  );
});

test('an empty editor stores nothing', () => {
  assert.equal(cleanRichHtml('<p><br></p>'), '');
  assert.equal(cleanRichHtml(''), '');
});
