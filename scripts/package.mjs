#!/usr/bin/env node
// Delivery helper: builds the two ZIPs on the Desktop (full = public/ + scripts, src = without
// frames/ and video/) with bsdtar, and copies review/ to a target folder.
//   node scripts/package.mjs [--desktop C:/Users/luca/Desktop] [--review-to "<folder>"]
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, def) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : def; };
const DESKTOP = opt('desktop', path.join(process.env.USERPROFILE || process.env.HOME, 'Desktop'));
const reviewTo = opt('review-to', null);

const items = ['public', 'scripts', 'package.json', 'package-lock.json', 'README.md', 'wrangler.jsonc', '.gitignore', '.htmlvalidate.json'].filter((f) => fs.existsSync(path.join(ROOT, f)));
// Windows ships bsdtar (zip via -a); Git Bash's GNU tar would misread "C:" as a host name
const TAR = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
const zip = (name, excludes) => {
  const out = path.join(DESKTOP, name);
  const a = ['-a', '-cf', out, ...excludes.map((e) => `--exclude=${e}`), '-C', ROOT, ...items];
  const r = spawnSync(TAR, a, {stdio: 'inherit'});
  if (r.status !== 0) throw new Error(`tar failed for ${name}`);
  console.log(`${name}: ${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB`);
};
zip('bartolucci-website-v9_full.zip', ['node_modules']);
zip('bartolucci-website-v9_src.zip', ['node_modules', 'public/frames', 'public/video']);

if (reviewTo) {
  fs.mkdirSync(reviewTo, {recursive: true});
  fs.cpSync(path.join(ROOT, 'review'), reviewTo, {recursive: true});
  console.log(`review/ copied to ${reviewTo} (${fs.readdirSync(reviewTo).length} entries)`);
}
