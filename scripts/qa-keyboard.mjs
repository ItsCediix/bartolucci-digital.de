#!/usr/bin/env node
// QA: keyboard navigation over the rail (desktop 1440 × 900). Focus the first rail link, press ArrowDown
// n times, check focus, aria-current and that the target section is at the top. Writes review/keyboard.json.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://localhost:4173';
const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
await page.goto(`${BASE}/?mode=desktop`, {waitUntil: 'load'});
await page.waitForTimeout(1500);
await page.focus('[data-rail="hook"]');
const out = [];
for (let n = 1; n <= 6; n++) {
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(2200);
  out.push(await page.evaluate(() => {
    const a = document.activeElement;
    const target = document.getElementById(a.getAttribute('href').slice(1));
    return {focused: a.getAttribute('data-rail'), current: document.querySelector('[data-rail][aria-current]')?.getAttribute('data-rail'), targetTop: Math.round(target.getBoundingClientRect().top)};
  }));
}
await browser.close();
console.log(out);
fs.mkdirSync(path.join(ROOT, 'review'), {recursive: true});
fs.writeFileSync(path.join(ROOT, 'review', 'keyboard.json'), JSON.stringify(out, null, 2));
// chapters land at 0 (their copy is sticky below the header), sections right below the 71 px header
if (out.some((o) => o.focused !== o.current || o.targetTop < -4 || o.targetTop > 75)) process.exitCode = 1;
