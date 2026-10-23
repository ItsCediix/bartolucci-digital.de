#!/usr/bin/env node
// Brand assets from the binding logo SVG (not redrawn): copies it to public/assets/logo.svg, writes
// logo-dark.svg (#141414 -> #FFFFFF, blue stays), logo-mark.svg (the two squares only) and the favicon
// set (favicon.svg with a dark-tab variant, favicon-32.png, apple-touch-icon.png).
//   node scripts/brand.mjs [--logo "<path to bartolucci-digital_logo.svg>"]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const i = args.indexOf('--logo');
const SRC = i >= 0 ? args[i + 1] : 'C:/Users/luca/Desktop/Gehirn/Lucas Gedanken/Wissen/Projekte/Bartolucci Digital/Design/Logo/SVG/bartolucci-digital_logo.svg';
const OUT = path.join(ROOT, 'public', 'assets');
fs.mkdirSync(OUT, {recursive: true});

const logo = fs.readFileSync(SRC, 'utf8');
fs.writeFileSync(path.join(OUT, 'logo.svg'), logo);
fs.writeFileSync(path.join(OUT, 'logo-dark.svg'), logo.replaceAll('#141414', '#FFFFFF'));

// the two squares are single subpaths inside the black and the blue path
const subpaths = (fill) => {
  const m = logo.match(new RegExp(`<g fill="${fill}"[^>]*><path d="([^"]+)"`));
  if (!m) throw new Error(`no path with fill ${fill}`);
  return m[1].split(/(?=M)/);
};
const black = subpaths('#141414').find((p) => p.startsWith('M136,243'));
const blue = subpaths('#5A6592').find((p) => p.startsWith('M536,636'));
if (!black || !blue) throw new Error('logo squares not found – did the logo change?');

// bounding box of both squares: x 75–1279, y 231–1383 -> square viewBox with a small margin
const VB = '37 187 1284 1240';
const VB_SQ = '57 187 1240 1240';
const mark = (vb, dark) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="bartolucci digital"><path fill="${dark ? '#FFFFFF' : '#141414'}" d="${black}"/><path fill="#5A6592" d="${blue}"/></svg>\n`;
fs.writeFileSync(path.join(OUT, 'logo-mark.svg'), mark(VB, false));
fs.writeFileSync(path.join(OUT, 'logo-mark-dark.svg'), mark(VB, true));

// favicon: black square turns white on dark browser chrome
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB_SQ}"><style>.k{fill:#141414}@media (prefers-color-scheme:dark){.k{fill:#FFFFFF}}</style><path class="k" d="${black}"/><path fill="#5A6592" d="${blue}"/></svg>\n`;
fs.writeFileSync(path.join(ROOT, 'public', 'favicon.svg'), favicon);

// PNGs: transparent 32 px, and a 180 px touch icon on white (iOS fills transparency with black)
const flat = Buffer.from(mark(VB_SQ, false));
await sharp(flat, {density: 72 * 32 / 1240 * 8}).resize(32, 32, {fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}}).png().toFile(path.join(ROOT, 'public', 'favicon-32.png'));
const touch = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-123 7 1600 1600"><rect x="-123" y="7" width="1600" height="1600" fill="#FFFFFF"/><path fill="#141414" d="${black}"/><path fill="#5A6592" d="${blue}"/></svg>`;
await sharp(Buffer.from(touch), {density: 72 * 180 / 1600 * 4}).resize(180, 180).flatten({background: '#FFFFFF'}).png().toFile(path.join(ROOT, 'public', 'apple-touch-icon.png'));

for (const f of ['assets/logo.svg', 'assets/logo-dark.svg', 'assets/logo-mark.svg', 'assets/logo-mark-dark.svg', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']) {
  console.log(`${f.padEnd(26)} ${fs.statSync(path.join(ROOT, 'public', f)).size} bytes`);
}
