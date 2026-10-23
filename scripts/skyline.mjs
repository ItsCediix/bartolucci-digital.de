#!/usr/bin/env node
// Writes public/assets/skyline-hamburg.svg – an own vector drawing of the Hamburg skyline (no source image,
// no tracing, no imported paths). View from the south bank of the Elbe looking north: west left, east right.
// Scale ≈ 1.7 px per metre for the inner city (ground line y = 276), lighter and smaller for distant shapes.
// Groups: #sky-cranes, #sky-city (parallax layers), symbol #sky-ship (moves on its own). Single colour.
//   node scripts/skyline.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (n) => Math.round(n * 10) / 10;

// container gantry crane, local coordinates (legs at x 0 / 64, boom over the water to the west)
const crane = [
  'M0 150h8v126H0zM64 150h8v126h-8zM-4 144h80v10H-4zM4 108h6v36H4zM62 108h6v36h-6z', // legs, portal, upper posts
  'M-118 100h228v9h-228zM70 84h40v16H70zM-72 109h20v10h-20zM-63 119h2v32h-2z', // boom, machinery house, trolley, rope
  'M26 100L36 46h6l10 54h-6L39 56l-7 44z', // A-frame
  'M37 46l3 2.6L-114 104l-2-2.6zM41 46l-2.4 2.8L106 102l2.4-2.8z', // stays
  'M8 160l58 42-3 4-58-42zM64 160L8 202l3 4 58-42z', // cross bracing
].join('');

// Kaispeicher windows: regular rows of small openings cut out of the brick base (even-odd)
let windows = '';
for (const y of [224, 236, 248, 260]) {
  const inset = (276 - y) * (6 / 62);
  for (let x = 1012 + inset; x < 1182 - inset; x += 11) windows += `M${r(x)} ${y}h4.5v6h-4.5z`;
}

const city = [
  // quay / ground line
  'M0 276h1600v24H0z',
  // Köhlbrandbrücke: two A-shaped pylons, gently arched deck
  'M398 270Q540 196 692 270l-4 4Q540 204 402 274z',
  'M448 276L468 100h6l22 176h-8L471 132l-15 144zM588 276L608 100h6l22 176h-8L611 132l-15 144zM458 236h32v4h-32zM598 236h32v4h-32z',
  // St. Michaelis: nave, square shaft with two clock faces, stages, copper dome, open lantern, spire
  `M690 276v-44l45-18 45 18v44z`,
  '~M717 276V150h36v126zM721 162a5 5 0 1 0 10 0a5 5 0 1 0-10 0zM739 162a5 5 0 1 0 10 0a5 5 0 1 0-10 0z',
  `M714 150v-8h42v8zM720 142v-22h30v22zM724 120v-14h22v14z`,
  'M722 106q0-18 13-24 13 6 13 24z',
  'M727 82V70h3v12zM733.5 82V70h3v12zM740 82V70h3v12zM725 70v-3h20v3zM729 67q6-9 12 0zM734 61l1-9 1 9z',
  // Landungsbrücken: long hall at the waterline, clock tower with copper dome
  'M790 276v-20h112v20zM864 256v-34h12v34zM862 222q8-14 16 0zM869.5 211v-8h1v8z',
  // Rickmer Rickmers: hull and two tall masts with yards
  'M900 268h78l-6 8h-66zM919 268v-90h2.5v90zM944 268v-82h2.5v82z',
  'M911 196h18v2h-18zM913 214h14v2h-14zM936 202h18v2h-18zM938 220h14v2h-14zM976 266l22-10 1 2-22 10z',
  // Elbphilharmonie at the waterline: brick base (Kaispeicher) with window rows ...
  `~M1000 276l6-62h182l6 62z${windows}`,
  // ... and the glass body; the wave roof is highest at the western tip and falls east in three waves
  '~M1002 214l1-118q3-8 11-6 22 6 38 36 14-22 32-18 16 4 28 30 12-16 28-12 14 4 22 24 10-12 22-8l6 8v64zM1012 172h170v1.6h-170zM1012 194h172v1.6h-172z',
  // inner-city spires behind the Speicherstadt (west -> east)
  // St. Katharinen: baroque crown with stacked bulbs
  'M1218 276V170h20v106zM1220 170v-20h16v20zM1219 150q0-12 9-16 9 4 9 16zM1224 134v-10h8v10zM1223 124q5-10 10 0zM1227 118l1-38 1 38z',
  // St. Nikolai: the tallest, very slender neo-gothic openwork spire with corner pinnacles
  'M1290 276V140h20v136zM1288 140l2-16 2 16zM1308 140l2-16 2 16z',
  '~M1289 140l11-114 11 114zM1300 64l1.6 6-1.6 6-1.6-6zM1300 84l2.2 7-2.2 7-2.2-7zM1300 106l2.8 8-2.8 8-2.8-8z',
  // Rathaus: wide body, ornate tower, copper roof with a short spire
  'M1330 276v-71h60v71zM1328 205l32-9 32 9zM1352 276V150h16v126zM1350 150v-14h20v14z',
  'M1349 136q3-20 11-26 8 6 11 26zM1357 110v-10h6v10zM1359 100l1-14 1 14z',
  // St. Petri and St. Jacobi: slender spires
  'M1407 276V140h16v136zM1406 140l9-88 9 88zM1414.5 56V46h1v10z',
  'M1455 276V150h14v126zM1454 150l8-87 8 87z',
  // Speicherstadt: low warehouse blocks with stepped and pointed gables, small turrets
  'M1195 276v-48h10v-8h10v-8h10v8h10v8h10v48z',
  'M1248 276v-50l24-22 24 22v50zM1268 206v-14h8v14zM1266 192l6-12 6 12z',
  'M1300 276v-52h10v-8h10v-10h10v10h10v8h10v52z',
  'M1352 276v-48l24-24 24 24v48zM1396 214v-12h8v12zM1394 202l6-12 6 12z',
  'M1404 276v-56h10v-8h10v-8h10v8h10v8h10v56z',
  'M1456 276v-46l17-18 17 18v46z',
]
  // one <path> per shape: overlapping shapes in a single path could cancel out under the fill rule;
  // entries starting with "~" carry holes (windows, clock faces, openwork) and use even-odd on purpose
  .map((d) => (d.startsWith('~') ? `<path fill-rule="evenodd" d="${d.slice(1)}"/>` : d.match(/M[^M]+/g).map((m) => `<path d="${m}"/>`).join('')))
  .join('\n      ');

// Elbbrücken: two low steel bowstring arches far right (stroked)
const bridges = 'M1494 264q28-30 56 0M1550 264q28-30 56 0M1502 254v10M1512 247v17M1522 244v20M1532 246v18M1542 253v11M1558 254v10M1568 247v17M1578 244v20M1588 246v18M1598 253v11';

// distant Heinrich-Hertz-Turm: thin concrete shaft, one large pod about two thirds up, antenna
const tower = 'M960 276l3.5-206h5l3.5 206zM950 124q0-12 16-14 16 2 16 14 0 8-16 10-16-2-16-10zM955 104h22v4h-22zM965 70V34h2v36z';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 300" fill="currentColor">
  <!-- Hamburg skyline, own vector drawing for Bartolucci Digital (no source image, no tracing, no imported
       paths; generated by scripts/skyline.mjs). Seen from the south bank of the Elbe looking north, west on
       the left: container cranes, Köhlbrandbrücke, St. Michaelis, Landungsbrücken with Rickmer Rickmers,
       Heinrich-Hertz-Turm (distant), Elbphilharmonie, Speicherstadt with the spires of St. Katharinen,
       St. Nikolai, Rathaus, St. Petri, St. Jacobi behind it, Elbbrücken. Layers are separate groups for
       parallax: #sky-cranes, #sky-city; the container ship is a symbol (#sky-ship) so it can move on its own. -->
  <defs>
    <symbol id="sky-ship" viewBox="0 0 360 90" fill="currentColor">
      <path d="M2 58h344l-12 26H30Q12 74 2 58z"/>
      <path d="M40 34h28v23H40zM70 34h28v23H70zM100 26h28v31h-28zM130 34h28v23h-28zM160 26h28v31h-28zM190 34h28v23h-28zM220 30h28v27h-28zM250 38h24v19h-24z"/>
      <path d="M282 22h34v35h-34zM286 14h26v8h-26zM296 4h8v10h-8z"/>
      <path d="M14 50h20v8H14z"/>
    </symbol>
    <g id="sky-crane">${crane.match(/M[^M]+/g).map((m) => `<path d="${m}"/>`).join('')}</g>
    <g id="sky-cranes" fill="currentColor">
      <use href="#sky-crane" x="96"/>
      <use href="#sky-crane" x="196"/>
      <use href="#sky-crane" x="296"/>
    </g>
    <g id="sky-city" fill="currentColor">
      <path opacity="0.55" d="${tower}"/>
      ${city}
      <g fill="none" stroke="currentColor" stroke-width="1.4">
        <path d="M471 106L410 262M471 112L425 256M471 118L440 251M471 124L455 246M471 106L532 233M471 112L517 234M471 118L502 236M471 124L487 238"/>
        <path d="M611 106L550 233M611 112L565 234M611 118L580 236M611 124L595 238M611 106L672 262M611 112L657 256M611 118L642 251M611 124L627 246"/>
      </g>
      <path fill="none" stroke="currentColor" stroke-width="2.6" d="${bridges}"/>
      <path d="M1490 264h110v5h-110z"/>
    </g>
  </defs>
  <use href="#sky-cranes"/>
  <use href="#sky-city"/>
</svg>
`;
fs.writeFileSync(path.join(ROOT, 'public', 'assets', 'skyline-hamburg.svg'), svg);
console.log(`skyline-hamburg.svg written (${svg.length} bytes)`);
