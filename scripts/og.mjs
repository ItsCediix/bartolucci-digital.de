#!/usr/bin/env node
// Renders public/assets/og.png (1200 × 630) with Playwright from a small HTML template: the logo and the
// line "Websites · Automatisierung · Hamburg", with the own skyline drawing low in the background.
//   node scripts/og.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const logo = fs.readFileSync(path.join(PUB, 'assets', 'logo.svg'), 'utf8').replace(/<title>[^<]*<\/title>/, '');
const sky = fs.readFileSync(path.join(PUB, 'assets', 'skyline-hamburg.svg'), 'utf8');
const font = (w) => pathToFileURL(path.join(PUB, 'fonts', `inter-latin-${w}-normal.woff2`)).href;
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;font-weight:600;src:url('${font(600)}') format('woff2')}
html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{position:relative;background:linear-gradient(180deg,#faf8f3 0%,#f1ede4 100%);font-family:Inter,sans-serif;color:#141414}
.logo{position:absolute;left:96px;top:110px;width:700px}
.logo svg{width:100%;height:auto;display:block}
.line{position:absolute;left:100px;top:342px;font-size:40px;font-weight:600;letter-spacing:-0.01em;color:#334155}
.sky{position:absolute;left:0;right:0;bottom:0;height:170px;color:#5a6592;opacity:.16}
.sky svg{width:100%;height:100%}
.bar{position:absolute;left:0;right:0;bottom:0;height:10px;background:#5a6592}
</style></head><body>
<div class="sky">${sky.replace('<svg ', '<svg preserveAspectRatio="xMidYMax slice" ')}</div>
<div class="logo">${logo}</div>
<p class="line">Websites · Automatisierung · Hamburg</p>
<div class="bar"></div>
</body></html>`;
const tmp = path.join(ROOT, 'review', 'og-template.html');
fs.mkdirSync(path.dirname(tmp), {recursive: true});
fs.writeFileSync(tmp, html);
const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1200, height: 630}});
await page.goto(pathToFileURL(tmp).href);
await page.waitForTimeout(300);
await page.screenshot({path: path.join(PUB, 'assets', 'og.png')});
await browser.close();
console.log(`og.png ${fs.statSync(path.join(PUB, 'assets', 'og.png')).size} bytes`);
