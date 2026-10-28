#!/usr/bin/env node
// v18: Lighthouse, several runs per target, medians. Desktop preset and the mobile default (Moto G Power, 4x CPU,
// slow 4G simulated) against one base URL; prints the medians of the four scores, LCP / CLS / TBT / FCP, the LCP
// breakdown (TTFB, load delay, load time, render delay) and the largest layout-shift sources of the median run.
//   node scripts/qa-lh-runs.mjs [--base http://localhost:4173] [--runs 3] [--out review/lh] [--label local] [--only mobile|desktop]
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, def) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : def; };
const BASE = opt('base', 'http://localhost:4173').replace(/\/$/, '');
const RUNS = +opt('runs', 3);
const LABEL = opt('label', 'local');
const ONLY = opt('only', '');
const OUT = path.resolve(ROOT, opt('out', 'review/lh'));
fs.mkdirSync(OUT, {recursive: true});
process.env.CHROME_PATH = chromium.executablePath();
const lh = path.join(ROOT, 'node_modules', 'lighthouse', 'cli', 'index.js');

const median = (xs) => { const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const r1 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
const targets = [
  {name: 'desktop', extra: ['--preset=desktop']},
  {name: 'mobile', extra: []},
].filter((t) => !ONLY || t.name === ONLY);

const summary = {base: BASE, label: LABEL, runs: RUNS, date: new Date().toISOString(), targets: {}};
for (const t of targets) {
  const runs = [];
  for (let i = 1; i <= RUNS; i++) {
    const outPath = path.join(OUT, `${LABEL}-${t.name}-${i}`);
    const res = spawnSync(process.execPath, [lh, `${BASE}/`, ...t.extra, '--output=json', `--output-path=${outPath}.json`, '--chrome-flags=--headless=new --no-sandbox', '--quiet'], {stdio: ['ignore', 'ignore', 'inherit'], env: process.env});
    if (res.status !== 0 || !fs.existsSync(`${outPath}.json`)) { console.error(`lighthouse ${t.name} run ${i} failed`); continue; }
    const j = JSON.parse(fs.readFileSync(`${outPath}.json`, 'utf8'));
    const a = j.audits;
    const lcpEl = a['largest-contentful-paint-element'];
    const phases = {};
    if (lcpEl && lcpEl.details && lcpEl.details.items) {
      for (const it of lcpEl.details.items) if (it.items) for (const p of it.items) if (p.phase) phases[p.phase] = p.timing;
    }
    const lcpNode = lcpEl && lcpEl.details && lcpEl.details.items && lcpEl.details.items[0] && lcpEl.details.items[0].items && lcpEl.details.items[0].items[0] && lcpEl.details.items[0].items[0].node;
    const shiftsAudit = a['layout-shifts'] || a['layout-shift-elements'];
    const shifts = shiftsAudit && shiftsAudit.details && shiftsAudit.details.items ? shiftsAudit.details.items.slice(0, 4).map((s) => ({score: r1(s.score), node: s.node && (s.node.selector || s.node.nodeLabel), subItems: s.subItems && s.subItems.items ? s.subItems.items.map((x) => (x.node && x.node.selector) || x.cause || x.extra).slice(0, 3) : undefined})) : [];
    runs.push({
      run: i, file: path.relative(ROOT, `${outPath}.json`), version: j.lighthouseVersion,
      performance: Math.round(j.categories.performance.score * 100), accessibility: Math.round(j.categories.accessibility.score * 100),
      bestPractices: Math.round(j.categories['best-practices'].score * 100), seo: Math.round(j.categories.seo.score * 100),
      lcp: a['largest-contentful-paint'].numericValue, cls: a['cumulative-layout-shift'].numericValue, tbt: a['total-blocking-time'].numericValue,
      fcp: a['first-contentful-paint'].numericValue, si: a['speed-index'].numericValue,
      lcpElement: lcpNode && (lcpNode.selector || lcpNode.nodeLabel), lcpPhases: phases, shifts,
      bytes: a['total-byte-weight'] && a['total-byte-weight'].numericValue, requests: a['network-requests'] && a['network-requests'].details ? a['network-requests'].details.items.length : null,
    });
    console.log(`${LABEL} ${t.name} run ${i}: P ${runs[runs.length - 1].performance} A ${runs[runs.length - 1].accessibility} BP ${runs[runs.length - 1].bestPractices} SEO ${runs[runs.length - 1].seo} LCP ${Math.round(runs[runs.length - 1].lcp)} ms CLS ${r1(runs[runs.length - 1].cls)} TBT ${Math.round(runs[runs.length - 1].tbt)} ms`);
  }
  const med = {};
  for (const k of ['performance', 'accessibility', 'bestPractices', 'seo', 'lcp', 'cls', 'tbt', 'fcp', 'si', 'bytes', 'requests']) med[k] = r1(median(runs.map((r) => r[k])));
  med.lcpPhases = {};
  for (const ph of ['TTFB', 'Load Delay', 'Load Time', 'Render Delay']) med.lcpPhases[ph] = r1(median(runs.map((r) => r.lcpPhases[ph])));
  // the run whose CLS is the median one carries the shift sources
  const byCls = runs.slice().sort((x, y) => x.cls - y.cls);
  const medRun = byCls[Math.floor((byCls.length - 1) / 2)];
  med.lcpElement = medRun && medRun.lcpElement;
  med.shifts = medRun && medRun.shifts;
  summary.targets[t.name] = {median: med, runs};
  console.log(`${LABEL} ${t.name} MEDIAN: P ${med.performance} A ${med.accessibility} BP ${med.bestPractices} SEO ${med.seo} | LCP ${Math.round(med.lcp)} ms (TTFB ${Math.round(med.lcpPhases.TTFB || 0)}, delay ${Math.round(med.lcpPhases['Load Delay'] || 0)}, load ${Math.round(med.lcpPhases['Load Time'] || 0)}, render ${Math.round(med.lcpPhases['Render Delay'] || 0)}) CLS ${med.cls} TBT ${Math.round(med.tbt)} ms | LCP element ${med.lcpElement} | shifts ${JSON.stringify(med.shifts)}`);
}
fs.writeFileSync(path.join(OUT, `${LABEL}-summary.json`), JSON.stringify(summary, null, 2));
console.log(`written ${path.relative(ROOT, path.join(OUT, `${LABEL}-summary.json`))}`);
