#!/usr/bin/env node
// Delivery helper (v10): stages public/, REPORT.md, review/ (screenshots + Lighthouse reports) and the
// local preview starter (START_Website.cmd + serve.ps1) in <project>/paket/ and zips them with bsdtar.
//   node scripts/package.mjs --report <REPORT.md> --starter <folder with START_Website.cmd + serve.ps1>
//                            [--out <zip path>] [--review-to <folder>]
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, def) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : def; };
const DESKTOP = path.join(process.env.USERPROFILE || process.env.HOME, 'Desktop');
const OUT = opt('out', path.join(DESKTOP, 'bartolucci-digital_website-v10.zip'));
const REPORT = opt('report', path.join(ROOT, '..', 'REPORT.md'));
const STARTER = opt('starter', path.join(ROOT, '..', 'v9ref'));
const reviewTo = opt('review-to', null);

const STAGE = path.join(ROOT, '..', 'paket');
fs.mkdirSync(STAGE, {recursive: true});
fs.cpSync(path.join(ROOT, 'public'), path.join(STAGE, 'public'), {recursive: true});
fs.copyFileSync(REPORT, path.join(STAGE, 'REPORT.md'));
for (const f of ['START_Website.cmd', 'serve.ps1']) fs.copyFileSync(path.join(STARTER, f), path.join(STAGE, f));
const reviewFiles = fs.readdirSync(path.join(ROOT, 'review')).filter((f) => /\.(png|html|json|txt)$/.test(f) && !f.startsWith('dom-') && !f.startsWith('og-template'));
fs.mkdirSync(path.join(STAGE, 'review'), {recursive: true});
for (const f of reviewFiles) fs.copyFileSync(path.join(ROOT, 'review', f), path.join(STAGE, 'review', f));

// Windows ships bsdtar (zip via -a); Git Bash's GNU tar would misread "C:" as a host name
const TAR = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
const r = spawnSync(TAR, ['-a', '-cf', OUT, '-C', STAGE, 'public', 'review', 'REPORT.md', 'START_Website.cmd', 'serve.ps1'], {stdio: 'inherit'});
if (r.status !== 0) throw new Error('tar failed');
const size = fs.statSync(OUT).size;
console.log(`${OUT}: ${(size / 1024 / 1024).toFixed(2)} MB (${reviewFiles.length} review files)`);
if (size > 49 * 1024 * 1024) { console.error('FAIL: ZIP over 49 MB'); process.exitCode = 1; }

if (reviewTo) {
  fs.mkdirSync(reviewTo, {recursive: true});
  for (const f of reviewFiles) fs.copyFileSync(path.join(ROOT, 'review', f), path.join(reviewTo, f));
  console.log(`review copied to ${reviewTo} (${reviewFiles.length} files)`);
}
