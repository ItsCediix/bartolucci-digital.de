# bartolucci-digital.de

Statische Website von Bartolucci Digital (Hamburg). Kein Framework, kein Bundler, keine
Anfragen an fremde Server. Gehostet als Cloudflare Workers Static Assets (`wrangler.jsonc`,
`assets.directory = ./public`).

## Aufbau

```
public/
  index.html            eine Seite, zwei Bodies: <template id="tpl-desktop"> / <template id="tpl-mobile">
                        (ein Inline-Skript am Anfang von <body> wählt einmal vor dem ersten Paint)
  impressum.html        rechtlich finaler Text, nur neu gestylt
  datenschutz.html      rechtlich finaler Text, nur neu gestylt
  assets/               base.css (Tokens, Schrift, gemeinsame Abschnitte), desktop.css/js, mobile.css/js, shared.js
  data/                 chapters.json (Kapitelzeiten), offer.json (Preise), site-data.js (generiert)
  frames/<kapitel>/     WebP-Einzelbilder für das Scroll-Scrubbing (generiert), manifest.json
  video/                demo-720.mp4 (Fallback + Mobil), poster.webp, poster-hook.webp (generiert)
  fonts/                Inter 400/600/800 (woff2, OFL), kopiert aus @fontsource/inter
  vendor/               gsap.min.js, ScrollTrigger.min.js, lenis.min.js (lokal, kein CDN)
  _headers              CSP + Sicherheits-Header + Cache-Control (generiert)
scripts/
  frames.mjs            Video → Frames, Poster, Fallback-MP4, og.jpg
  build-data.mjs        JSON → public/data/site-data.js
  build-headers.mjs     schreibt public/_headers (Hash des Inline-Boot-Skripts)
  vendor.mjs            kopiert Bibliotheken + Schriften aus node_modules nach public/
  check-sizes.mjs       10 größte Dateien, 25-MB-Grenze
  qa-shots.mjs          Playwright-Screenshots + Netzwerk-Log (nur eigene Origin)
```

## Befehle

```bash
npm install                      # nur devDependencies
npm run vendor                   # Bibliotheken + Schriften nach public/
npm run frames -- <pfad.mp4>     # neues Video einbauen (Frames, Poster, MP4, OG-Bild)
npm run build                    # site-data.js + _headers neu erzeugen
npm run serve                    # http://localhost:4173
npm run qa:shots                 # Screenshots nach review/, Netzwerk-Assertion
npm run check:sizes
```

### Video austauschen

1. Kapitelgrenzen in `public/data/chapters.json` prüfen (Sekunden im neuen Film).
2. `npm run frames -- "C:\Pfad\zum\neuen\Film.mp4"` – schreibt alles nach `public/frames/`, `public/video/`, `public/og.jpg`.
   Standard: 12 fps, 540 px breit, WebP-Qualität 80. Liegt die Hochrechnung über 40 MB, nimmt das Skript automatisch 10 fps / Qualität 74.
3. `npm run build` – die Frame-Anzahl pro Kapitel landet in `site-data.js`.
4. Das Skript löscht nichts. Hat das neue Video weniger Frames, bleiben alte Dateien liegen, werden aber nicht referenziert. Vor dem Commit `public/frames/` einmal leeren.

### Preise ändern

`public/data/offer.json` bearbeiten, danach `npm run build`. Bei `slotsLeft: 0` zeigt die Seite automatisch nur den regulären Preis.

## Funktionsweise

- **Desktop (≥ 768 px, feiner Zeiger):** linke Spalte Kapiteltexte, rechte Spalte ein sticky Panel mit einem `<canvas>`, das die Frames des Films nach Scrollposition zeichnet (vor und zurück). Frames werden kapitelweise vorgeladen (max. 60 gleichzeitig). Ein verstecktes `<video>` liefert den Ton („Ton an“) und dient als Fallback: Wenn das erste Kapitel nach 4 s nicht geladen ist, bei `prefers-reduced-motion`, `pointer: coarse`, `saveData` oder unter 1100 px spielt das Video kapitelweise ab.
- **Mobil (grober Zeiger + Hochformat oder < 768 px):** eigener Body, Vollbild-Video im Kapitelmodus, Textkarten im unteren Drittel, Lenis-Scroll. `?mode=desktop|mobile` erzwingt einen Body (zum Testen).
- **Null Fremdanfragen:** erzwungen durch die CSP in `_headers` (`connect-src 'none'`, `default-src 'self'`). Deshalb liegen die JSON-Daten als `site-data.js` vor, nicht per `fetch()`.
