#!/usr/bin/env node
// Runs Lighthouse (desktop preset + mobile default) against the local server using Playwright's
// Chromium. Writes JSON + HTML reports to review/ and prints the four category scores.
//   node scripts/qa-lighthouse.mjs [--base http://localhost:4173] [--out review]
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, def) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : def; };
const BASE = opt('base', 'http://localhost:4173');
const OUT = path.resolve(ROOT, opt('out', 'review'));
fs.mkdirSync(OUT, {recursive: true});
process.env.CHROME_PATH = chromium.executablePath();
const lh = path.join(ROOT, 'node_modules', 'lighthouse', 'cli', 'index.js');

const runs = [
  {name: 'desktop', url: `${BASE}/?mode=desktop`, extra: ['--preset=desktop']},
  {name: 'mobile', url: `${BASE}/?mode=mobile`, extra: []},
];
const summary = {};
for (const r of runs) {
  const outPath = path.join(OUT, `lighthouse-${r.name}`);
  const res = spawnSync(process.execPath, [lh, r.url, ...r.extra, '--output=json', '--output=html', `--output-path=${outPath}`, '--chrome-flags=--headless=new --no-sandbox', '--quiet'], {stdio: 'inherit', env: process.env});
  if (res.status !== 0) { console.error(`lighthouse ${r.name} failed`); continue; }
  const json = JSON.parse(fs.readFileSync(outPath + '.report.json', 'utf8'));
  const cats = json.categories;
  summary[r.name] = {
    performance: Math.round(cats.performance.score * 100),
    accessibility: Math.round(cats.accessibility.score * 100),
    bestPractices: Math.round(cats['best-practices'].score * 100),
    seo: Math.round(cats.seo.score * 100),
    lcp: json.audits['largest-contentful-paint'].displayValue,
    cls: json.audits['cumulative-layout-shift'].displayValue,
    tbt: json.audits['total-blocking-time'].displayValue,
  };
  console.log(r.name, summary[r.name]);
}
fs.writeFileSync(path.join(OUT, 'lighthouse-summary.json'), JSON.stringify(summary, null, 2));
