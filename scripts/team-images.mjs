#!/usr/bin/env node
// Prepares the team photos (part of `npm run build`).
// v19.1: the photos are cut out (transparent background) so the dark theme no longer shows a white square. The masters
// are square PNGs with alpha in assets-src/team/<name>.png (not deployed). For each one this writes
// public/assets/team/<name>.webp (quality 82, alpha) and <name>.avif (quality 55, alpha), 800 x 800, all metadata
// stripped, only when missing or older than the master. index.html lists AVIF with WebP as the <img> fallback; the
// backdrop behind the cut-out (white in light, dark gradient in dark) comes from .card-photo-box in base.css.
// Missing photos are fine: the page then shows an initials tile (shared.js).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets-src', 'team');
const OUT = path.join(ROOT, 'public', 'assets', 'team');
const SIZE = 800;

const files = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter((f) => /\.png$/i.test(f)) : [];
if (!files.length) console.log('team-images: no masters in assets-src/team/ - initials tiles will be shown');
fs.mkdirSync(OUT, {recursive: true});
for (const f of files) {
  const src = path.join(SRC, f);
  const srcTime = fs.statSync(src).mtimeMs;
  for (const [ext, make] of [['webp', (s) => s.webp({quality: 82, alphaQuality: 90})], ['avif', (s) => s.avif({quality: 55})]]) {
    const target = path.join(OUT, f.replace(/\.png$/i, '.' + ext));
    if (fs.existsSync(target) && fs.statSync(target).mtimeMs >= srcTime) { console.log(`team-images: ${path.basename(target)} up to date`); continue; }
    const buf = await make(sharp(src).ensureAlpha().resize(SIZE, SIZE, {fit: 'cover'})).toBuffer();
    fs.writeFileSync(target, buf);
    console.log(`team-images: ${path.basename(target)} written, ${Math.round(buf.length / 1024)} KB`);
  }
}
