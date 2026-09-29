import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textToHtml } from '../text-to-html.js';

test('each line becomes a paragraph and blank lines are kept', () => {
  assert.equal(textToHtml('First line\n\nSecond'), '<p>First line</p><p><br></p><p>Second</p>');
});

test('HTML in the text is escaped', () => {
  assert.equal(textToHtml('<b>bold</b> & "quoted"'), '<p>&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;</p>');
});

test('empty or whitespace-only text gives an empty description', () => {
  assert.equal(textToHtml(''), '');
  assert.equal(textToHtml('  \n '), '');
  assert.equal(textToHtml(undefined), '');
});

test('Windows line endings are handled', () => {
  assert.equal(textToHtml('a\r\nb'), '<p>a</p><p>b</p>');
});
