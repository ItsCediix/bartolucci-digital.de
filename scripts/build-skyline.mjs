#!/usr/bin/env node
// The animated harbour skyline behind the contact section (cranes, city, gulls + cars on the Köhlbrandbrücke, drifting
// ship) has one source: partials/skyline.html. This copies it between the skyline markers of every page that shows it,
// so the start page and /stempelkarten stay identical. Runs in `npm run build` before build-version.mjs (?v= hashes).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const partial = fs.readFileSync(path.join(ROOT, 'partials', 'skyline.html'), 'utf8').replace(/\r\n/g, '\n');
const re = /(<!-- skyline:start[^>]*-->\n)[\s\S]*?(<!-- skyline:end -->)/;

for (const page of ['index.html', 'stempelkarten.html']) {
  const file = path.join(ROOT, 'public', page);
  const before = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (!re.test(before)) throw new Error(`build-skyline: skyline markers missing in ${page}`);
  const after = before.replace(re, (_, a, b) => a + partial + b);
  if (after !== before) fs.writeFileSync(file, after);
  console.log(`build-skyline: ${page}${after === before ? ' (unchanged)' : ''}`);
}
