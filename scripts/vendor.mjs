#!/usr/bin/env node
// Copies the few third-party files the site uses from node_modules into public/ so the
// site is served from a single origin (no CDN). Run after `npm install`: `npm run vendor`.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NM = path.join(ROOT, 'node_modules');
const PUB = path.join(ROOT, 'public');

const files = [
  ['gsap/dist/gsap.min.js', 'vendor/gsap.min.js'],
  ['gsap/dist/ScrollTrigger.min.js', 'vendor/ScrollTrigger.min.js'],
  ['lenis/dist/lenis.min.js', 'vendor/lenis.min.js'],
  ['@fontsource/inter/files/inter-latin-400-normal.woff2', 'fonts/inter-latin-400-normal.woff2'],
  ['@fontsource/inter/files/inter-latin-600-normal.woff2', 'fonts/inter-latin-600-normal.woff2'],
  ['@fontsource/inter/files/inter-latin-800-normal.woff2', 'fonts/inter-latin-800-normal.woff2'],
  ['@fontsource/inter/LICENSE', 'fonts/LICENSE-Inter-OFL.txt'],
];
for (const [from, to] of files) {
  const dst = path.join(PUB, to);
  fs.mkdirSync(path.dirname(dst), {recursive: true});
  fs.copyFileSync(path.join(NM, from), dst);
  console.log(`${to}  ${(fs.statSync(dst).size / 1024).toFixed(1)} KB`);
}
