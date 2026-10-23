#!/usr/bin/env node
// Prepares the team photos in public/assets/team/ (part of `npm run build`): every *.jpg found there is
// re-encoded in place with sharp – all metadata stripped (EXIF, GPS, ICC comments), cover-cropped to
// 960 × 960, JPEG quality 82. Missing photos are fine: the page then shows an initials tile (shared.js).
// Already processed files (960 × 960, no EXIF) are left alone, so the build stays repeatable.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'public', 'assets', 'team');
const SIZE = 960;

const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => /\.jpe?g$/i.test(f)) : [];
if (!files.length) console.log('team-images: no photos in public/assets/team/ – initials tiles will be shown');
for (const f of files) {
  const p = path.join(DIR, f);
  const input = fs.readFileSync(p);
  const meta = await sharp(input).metadata();
  if (meta.width === SIZE && meta.height === SIZE && !meta.exif && !meta.xmp && !meta.iptc) {
    console.log(`team-images: ${f} already ${SIZE} × ${SIZE} without metadata, unchanged`);
    continue;
  }
  // sharp drops all metadata unless withMetadata() is called; rotate() applies the EXIF orientation first
  const out = await sharp(input).rotate().resize(SIZE, SIZE, {fit: 'cover', position: 'attention'}).jpeg({quality: 82, mozjpeg: true}).toBuffer();
  fs.writeFileSync(p, out);
  console.log(`team-images: ${f} ${meta.width} × ${meta.height} -> ${SIZE} × ${SIZE}, metadata stripped, ${Math.round(out.length / 1024)} KB`);
}
