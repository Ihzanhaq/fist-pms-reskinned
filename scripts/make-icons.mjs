// Renders web/public/favicon.svg into the desktop-shortcut icons:
// scripts/icons/fist-pms.png (Linux) and scripts/icons/fist-pms.ico (Windows).
// Uses the installed Chromium browser through playwright-core. Run: node scripts/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { chosenBrowser, findExecutable } from '../server/browsers.js';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'scripts', 'icons');
const svg = fs.readFileSync(path.join(root, 'web', 'public', 'favicon.svg'), 'utf8');
const SIZES = [16, 24, 32, 48, 64, 128, 256];

const browser = await chromium.launch({ executablePath: findExecutable(chosenBrowser()) });
const page = await browser.newPage();
const pngs = {};
for (const size of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  pngs[size] = await page.screenshot({ omitBackground: true });
}
await browser.close();

// ICO file whose entries are plain PNGs (supported since Windows Vista).
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'fist-pms.png'), pngs[256]);
fs.writeFileSync(path.join(outDir, 'fist-pms.ico'), ico(SIZES.map((size) => ({ size, data: pngs[size] }))));
console.log(`Icons written to ${path.relative(root, outDir)}`);
