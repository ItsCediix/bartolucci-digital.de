#!/usr/bin/env node
// Prepares the team photos in public/assets/team/ (part of `npm run build`): every *.jpg found there is
// re-encoded in place with sharp – all metadata stripped (EXIF, GPS, ICC comments), cover-cropped to
// 960 × 960, JPEG quality 82. Missing photos are fine: the page then shows an initials tile (shared.js).
// Already processed files (960 × 960, no EXIF) are left alone, so the build stays repeatable.
// v18 (audit M16): next to every JPEG a WebP (quality 82) and an AVIF (quality 55) of the same 960 × 960 file,
// written only when missing or older than the JPEG; index.html lists them in a <picture>, the JPEG stays the
// fallback. The crop, the CSS zoom and the object-position are untouched (same pixels, other encodings).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'public', 'assets', 'team'); // optional folder for tests
const SIZE = 960;

const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => /\.jpe?g$/i.test(f)) : [];
if (!files.length) console.log('team-images: no photos in public/assets/team/ – initials tiles will be shown');
for (const f of files) {
  const p = path.join(DIR, f);
  const input = fs.readFileSync(p);
  const meta = await sharp(input).metadata();
  if (meta.width === SIZE && meta.height === SIZE && !meta.exif && !meta.xmp && !meta.iptc) {
    console.log(`team-images: ${f} already ${SIZE} × ${SIZE} without metadata, unchanged`);
  } else {
    // sharp drops all metadata unless withMetadata() is called; rotate() applies the EXIF orientation first
    const out = await sharp(input).rotate().resize(SIZE, SIZE, {fit: 'cover', position: 'attention'}).jpeg({quality: 82, mozjpeg: true}).toBuffer();
    fs.writeFileSync(p, out);
    console.log(`team-images: ${f} ${meta.width} × ${meta.height} -> ${SIZE} × ${SIZE}, metadata stripped, ${Math.round(out.length / 1024)} KB`);
  }
  // v18: modern encodings of the final JPEG (same pixels); regenerated when the JPEG is newer
  const jpgTime = fs.statSync(p).mtimeMs;
  for (const [ext, make] of [['webp', (s) => s.webp({quality: 82})], ['avif', (s) => s.avif({quality: 55})]]) {
    const target = p.replace(/\.jpe?g$/i, '.' + ext);
    if (fs.existsSync(target) && fs.statSync(target).mtimeMs >= jpgTime) { console.log(`team-images: ${path.basename(target)} up to date`); continue; }
    try {
      const buf = await make(sharp(fs.readFileSync(p))).toBuffer();
      fs.writeFileSync(target, buf);
      console.log(`team-images: ${path.basename(target)} written, ${Math.round(buf.length / 1024)} KB`);
    } catch (e) {
      console.log(`team-images: ${ext} not written (${e.message.split('\n')[0]})`);
    }
  }
}
