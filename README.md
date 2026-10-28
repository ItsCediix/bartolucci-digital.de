# bartolucci-digital.de

Statische Website von Bartolucci Digital (Hamburg). Kein Framework, kein Bundler, keine
Anfragen an fremde Server. Gehostet als Cloudflare Workers Static Assets (`wrangler.jsonc`,
`assets.directory = ./public`).

## Aufbau (v18)

```
public/
  index.html            eine Seite, statisches HTML: Kapiteltexte, Preiskarte, Kontakt, die drei DOM-Szenen und
                        der Footer stehen komplett im <body> (lesbar ohne JavaScript, für Crawler ohne JS-Ausführung).
                        Ein Inline-Skript im <head> setzt vor dem ersten Paint Theme und Modus (desktop/mobile),
                        eines am Ende von <body> baut im Mobil-Modus die Kapitel zu Karten um. Keine <template>s mehr.
                        Preiskarte, Kontaktzeilen und JSON-LD werden von scripts/build-static.mjs zwischen
                        Markern (<!-- offer:start --> …) aus data/offer.json + data/company.json erzeugt.
  impressum.html        rechtlich finaler Text aus main, nur neu gestylt
  datenschutz.html      rechtlich finaler Text aus main, nur neu gestylt
  assets/               base.css, scenes.css/js (Handy-Szenen), desktop.css/js, mobile.css/js, shared.js,
                        logo.svg, logo-dark.svg, logo-mark(-dark).svg, skyline-hamburg.svg, og.png
  data/                 chapters.json (Kapitel, Beats: Doku), offer.json (Preise), company.json (Firmendaten für
                        Kontaktzeilen, Mailto und JSON-LD); nichts davon wird zur Laufzeit geladen
  fonts/                Inter 400/600/800 (woff2, OFL)
  vendor/               gsap.min.js, ScrollTrigger.min.js, lenis.min.js (lokal, kein CDN)
  _headers              CSP + Sicherheits-Header + Cache-Control (generiert)
scripts/
  brand.mjs             Logo-Varianten + Favicons aus dem verbindlichen Logo-SVG (sharp)
  og.mjs                og.png (1200 × 630) per Playwright
  build-static.mjs      offer.json + company.json → Preiskarte, Kontaktzeilen, JSON-LD in index.html (Marker)
  build-css.mjs         base + scenes + desktop + mobile.css → public/assets/site.css (nur die Startseite lädt die Datei)
  team-images.mjs       Teamfotos 960 × 960 ohne Metadaten, dazu .webp und .avif für das <picture> auf der Startseite
  build-version.mjs     ?v=<hash> an jede /assets-, /vendor- und /data-Referenz
  build-headers.mjs     schreibt public/_headers (Hashes der beiden Inline-Skripte)
  vendor.mjs            kopiert Bibliotheken + Schriften aus node_modules nach public/
  check-sizes.mjs       10 größte Dateien, 25-MB-Grenze je Datei, 3-MB-Budget für public/
  qa-shots.mjs          Playwright-Screenshots (Desktop hell/dunkel, Mobil 390/360, reduced motion) + Netzwerk-Log
  qa-scenes.mjs         Standbilder jeder Szene bei 0/50/100 % ihres Scroll-Timelines
  qa-lighthouse.mjs     Lighthouse Desktop + Mobil
  qa-legal.mjs          Textvergleich Impressum/Datenschutz gegen origin/main
  package.mjs           Liefer-ZIP
```

## Befehle

```bash
npm install                      # nur devDependencies
npm run vendor                   # Bibliotheken + Schriften nach public/
npm run brand                    # Logo-Varianten + Favicons neu erzeugen
npm run build                    # Preiskarte/Kontakt/JSON-LD, Asset-Hashes und _headers neu erzeugen
npm run serve                    # http://localhost:4173
npm run qa:shots                 # Screenshots nach review/, Netzwerk-Assertion
npm run qa:lighthouse
npm run check:sizes
```

### Preise ändern

`public/data/offer.json` bearbeiten, danach `npm run build`. Bei `slotsLeft: 0` zeigt die Seite automatisch nur den regulären Preis.

## Funktionsweise

- **Desktop (≥ 768 px, feiner Zeiger):** linke Spalte Kapiteltexte, rechte Spalte ein sticky Handy-Rahmen. Darin liegt eine feste Bühne von 540 × 960 CSS-px (per `transform: scale()` eingepasst) mit sechs Szenen aus HTML/CSS/SVG. Pro Kapitel ein GSAP-ScrollTrigger-Timeline mit `scrub: 0.6`: erst der Wechsel von der vorigen Szene (Wisch), dann 3 Beats mit Pausen dazwischen. Die Textteile links tragen `data-beat="n"` und erscheinen im selben Timeline genau dann, wenn Beat n rechts startet. Animiert werden nur `transform`, `opacity`, `clip-path` und `stroke-dashoffset`.
- **Hook:** die vier Blasen federn beim Laden ein (keine Scroll-Bindung, oben gibt es nichts zu scrubben); beim Weiterscrollen wischen sie nach oben in den Laptop.
- **Mobil (grober Zeiger + Hochformat oder < 768 px):** eigener Body, jede Kapitelkarte hat ein kleines Handy mit ihrer Szene; die Szene spielt einmal (~2,5 s), wenn sie zur Hälfte im Bild ist, und bleibt stehen. `?mode=desktop|mobile` erzwingt einen Body (zum Testen).
- **Reduzierte Bewegung:** keine Timelines; die Szenen zeigen ihr Endbild (das CSS beschreibt den Endzustand), auf dem Desktop wechselt das Bild ohne Animation mit dem aktiven Kapitel.
- **Theme:** hell ist immer der Start, `prefers-color-scheme` wird ignoriert; dunkel per Schalter, gespeichert in `localStorage` (`bd-theme`).
- **Null Fremdanfragen:** erzwungen durch die CSP in `_headers` (`connect-src 'none'`, `default-src 'self'`). Die JSON-Daten werden beim Build in das HTML gerendert, zur Laufzeit wird nichts geladen.
