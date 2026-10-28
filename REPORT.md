# REPORT Website v18: Audit-Umsetzung (2026-10-28)

**Maschine:** Main-PC · **Modell:** Claude Fable 5.1 · **Laufzeit:** geschätzt 90 min, tatsächlich 19:37 bis 20:31 (ca. 54 min Wandzeit)
**Branch:** `feature/website-v18-audit` (10 Maßnahmen-Commits + Report auf `main` c23f203) · **Push:** 403 ("denied to LucaW0204"), Bundle + Screenshots im Kurier an Cederic, `main` nicht angefasst

## 1. Basis: was `main` seit v17.1 (3969e74) enthielt
- `22d5906` Cederic: Rolle "Technik, Hosting, Updates, Compliance"; Crawler-Kopie: `build-static.mjs` rendert Kapitel, Abschnitte, Preiskarte und Telefon in ein verstecktes `#static-copy` (html.js blendet aus, Boot-Skript entfernt es); Telefon im JSON-LD; noscript-Hinweis raus.
- `c23f203` Cederic: IndexNow-Schlüsseldatei für Bing, Sitemap lastmod 28.10.
- Diffstat v17.1 → main: 7 Dateien, +273/-8 (package.json, _headers, IndexNow-Datei, index.html, sitemap.xml, build-static.mjs, qa-v13.mjs). Alles bleibt drin; die Crawler-Kopie wird durch echtes statisches HTML ersetzt (M1), die v17.1-Foto-CSS ist auf main vorhanden.
- Zeilenenden: main speichert LF, der Clone lieferte CRLF; die Commits wurden mit LF neu erzeugt, damit jede Maßnahme sauber auf main cherry-pickbar ist.

## 2. Maßnahmen (Audit-Nummerierung)
- **M1 statisches HTML (Commit `v18: M1 static HTML`):** Kapiteltexte, drei DOM-Szenen, Abschnitte, Preiskarte, Kontaktzeilen und Footer stehen als echtes HTML im `<body>`; keine `<template>`s, kein `#static-copy`, kein `site-data.js`, kein `window.BD`. `build-static.mjs` füllt Preiskarte, Kontaktzeilen und JSON-LD zwischen Markern aus `offer.json` + neuem `company.json` (Fakten wie im Impressum). Head-Skript setzt js-Marker, Theme und Modus vor dem ersten Paint; das Skript am Body-Ende baut nur im Mobil-Modus die Karten (DOM identisch mit v11, per Strukturvergleich geprüft: alter Boot-DOM ist exakte Teilmenge des neuen). Ohne JS: alle 8 Überschriften sichtbar und in Reihenfolge (Desktop und 390). Roh-HTML enthält H1, alle H2, 995 €, 1.990 €, 49 €, 79 €, 0170 7240 195, tel:, luca.bartolucci@. Gate `qa-static.mjs`.
  LCP-Renderverzögerung (Lighthouse-Breakdown, Median): Desktop main 376 ms → v18 357 ms, Mobil main 1754 ms → v18 1662 ms. Der Rest der Verzögerung ist CSS plus Schrift (render-blocking) in der simulierten 4G-Drosselung, nicht mehr JavaScript; der LCP-Knoten ist unverändert die H1 (Desktop) bzw. der Lead-Absatz (Mobil). Requests 23 → 19, Gewicht Mobil 271 → 193 KiB.
- **M6 CLS:** main als Build gemessen, 3 Läufe mobil Standard-Drosselung: CLS 0 / 0 / 0 (Median 0); vierter Lauf live: 0 (3 Läufe, alle 0). Der Audit-Wert 0,172 stammt vom Live-Stand v13/v14 (15:49), seit v15.1 sitzen die Farbfelder per translate statt top/left. Median < 0,1, deshalb keine CSS-Änderung; v18 mobil CLS 0 (3 Läufe).
- **M7 Title/Meta (`v18: M7 …`):** Title `Webdesign Hamburg: Website zum Festpreis | Bartolucci Digital` (61 Zeichen). Die Audit-Fassung mit "für kleine Betriebe" hat 81 Zeichen und widerspricht der v17-Entscheidung ohne "kleine Betriebe", deshalb gekürzt. Description 149 Zeichen mit Webdesign Hamburg, Festpreis, keine Cookies, kein Tracking. og:title und neues twitter:title folgen.
- **M11 JSON-LD (`v18: M11 …`):** legalName, telephone, email, PostalAddress mit Gardinger Weg 16 / 22609 Hamburg / DE, areaServed, founder (beide Personen), priceRange `995 € - 1990 €`, makesOffer mit drei Offers (Website 995, Betreuung 49 als UnitPriceSpecification P1M, Korrekturrunde 79), kein sameAs (keine Profil-URLs im Repo). Gate `qa-jsonld.mjs` (gültiges JSON, Pflichtfelder, keine leeren Strings, Adresse = Impressum, Preise = offer.json).
- **M12 CTAs (`v18: M12 …`):** Hero `Erstgespräch anfragen` / `Beispiel ansehen`, Header bleibt `Kontakt`; Satz "Wer das Formular abschickt, bekommt sofort eine Bestätigung." → "Wer uns schreibt, bekommt meistens am selben Tag eine Antwort." Mobil identisch (gleiches Markup).
- **M4 Mailto (`v18: M4 …`):** `Platz anfragen` und mobil `Schreib uns` öffnen `mailto:luca.bartolucci@…?subject=Platz anfragen&body=…` (Betrieb, Branche, Stadtteil, Wunschtermin je Zeile, Vorlage in company.json). Darunter die Adresse als Text mit Button "Kopieren" (Clipboard-API, Fallback markiert den Text; im Test Clipboard = Adresse, Label 1,8 s "Kopiert"). Telefon bleibt tel:, kein WhatsApp, kein Buchungstool.
- **M10 Telefon-Icon mobil (`v18: M10 …`):** runder tel:-Button (38 px) links vom Theme-Schalter, nur im Mobil-Modus (6 Zeilen mobile.css). H1 steht mobil weiter vor den Chat-Blasen (v14-Entscheidung, geprüft).
- **M14 Modus bei Resize (`v18: M14 …`):** shared.js prüft 300 ms nach resize/orientationchange die Regel (Touch + Hochformat oder < 768 px) und lädt neu, wenn der Modus wechselt. Playwright: iPad hoch → mobile, iPad quer → desktop, Drehung in beide Richtungen und 390 ↔ 1024 lösen genau einen Reload aus, 1440 → 1200 nicht.
- **M16 WebP/CSS (`v18: M16 …`):** team-images.mjs schreibt WebP und AVIF neben jedes JPEG (luca 74 → 24 / 16 KB, cederic 116 → 44 / 24 KB), `<picture>` mit JPEG-Fallback, Zuschnitt/Zoom/object-position unverändert. build-css.mjs bündelt base + scenes + desktop + mobile.css zu `site.css` (eine Anfrage statt vier; Quellen bleiben die vier Dateien, Rechtsseiten laden weiter base.css). Nicht gemacht: Critical-CSS inline mit asynchronem Rest (bräuchte onload-Handler, den die CSP verbietet, oder einen JS-Loader, der den ersten Paint wieder hinter JS legt); GSAP mobil unverändert.
- **M17 Footer/404 (`v18: M17 …`):** Footer und Rechtsseiten verlinken `/impressum` und `/datenschutz` (live 200, `.html` gab 307), Canonicals folgen; `404.html` im Seitendesign (Text, Startseite, tel:, mailto:, noindex, kein Formular) plus `not_found_handling: "404-page"` in wrangler.jsonc (Workers Static Assets, sonst leere 404). Sitemap unverändert.

## 3. Lighthouse (Median aus 3 Läufen, Lighthouse 12.8.2, Standard-Drosselung)
| Ziel | Perf | A11y | BP | SEO | LCP | davon Render | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| live (main, vorher) Desktop | 100 | 100 | 100 | 92* | 626 ms | 490 ms | 0 | 0 ms |
| live (main, vorher) Mobil | 97 | 100 | 100 | 92* | 2563 ms | 2105 ms | 0 | 0 ms |
| main lokal Desktop | 100 | 100 | 100 | 100 | 498 ms | 376 ms | 0 | 0 ms |
| main lokal Mobil | 99 | 100 | 100 | 100 | 2206 ms | 1754 ms | 0 | 0 ms |
| **v18 lokal Desktop** | 100 | 100 | 100 | 100 | 480 ms | 357 ms | 0 | 0 ms |
| **v18 lokal Mobil** | 99 | 100 | 100 | 100 | 2115 ms | 1662 ms | 0 | 5 ms |
\* live SEO 92 = "robots.txt is not valid": Lighthouse holt robots.txt per fetch aus der Seite, die CSP (`connect-src 'none'`) blockt das; lokal ohne Header-Datei 100. Live hat 24 Requests / 280 KiB gegen 20 / 191 KiB lokal: Cloudflare injiziert ein Beacon-Skript (M13, offen).

## 4. Gates
- `npm run build` sauber; qa-gates, qa-legal (0 Unterschiede), check-sizes (0,86 MB), qa-static, qa-jsonld, qa-fouc (10/10), qa-scenes, qa-keyboard, qa-v15, qa-v13 (slotsLeft-0-Test rendert die Karte jetzt über build-static statt über eine umgeschriebene Datendatei), qa-v17 (nach M16 angepasst: misst die Fotobox `.card-photo-box` statt des Eltern-Elements, das jetzt der `<picture>`-Wrapper ohne eigene Box ist; Werte wie v17.1), qa-shots, qa-v18: alle PASS (`analysis\qa-all-final.txt`, nach dem LF-Replay erneut `qa-all-replay.txt`).
- qa-v18: 0 Konsolenfehler, 0 Fremdanfragen, kein Gedankenstrich in den neuen Texten; Screenshots `review_2026-10-28_v18\` (hero/full je 1440, 1920, 390, iPad hoch, iPad quer × hell/dunkel; nojs_*; m4_copy; m10_header).

## 5. Offen (Luca / Cederic)
- M2 Google-Unternehmensprofil, Search Console, Bing WMT · M3 Bewertungen/Referenzen vertraglich · M5 Preisbox "Enthalten / Nicht enthalten" (braucht Kündigungsregel) · M8 FAQ · M9 Branchen-Landingpages · M13 Cloudflare-Beacon abschalten oder im Datenschutztext nennen, Erfolgsmessung · M15 Ratgeber · Sprungmarken im Header · WhatsApp · Buchungstool · GSAP mobil ersetzen.
- Cederic: `not_found_handling` greift erst nach Deploy mit der neuen wrangler.jsonc; nach dem Merge einmal `/nope` prüfen. Impressum/Datenschutz nennen weiter `info@`, die Startseite `luca.bartolucci@` (Entscheidung offen seit v16).

## 6. Schwachstellen
- **Technik, JS-Lebenszyklus:** Das Boot-Skript baut keinen DOM mehr; der Mobil-Umbau läuft am Body-Ende. Wird der Parser vorher unterbrochen (sehr langsame Verbindung), kann mobil ein Frame ohne Kapitel erscheinen (desktop.css blendet `.story` im Mobil-Modus aus, bis die Karten stehen). Kein doppelter DOM: die Szenen werden mobil geklont, die Desktop-Spalte entfernt. FOUC-Gate 10/10, Startzustände hängen wie bisher an `html.js`.
- **Technik:** Rechtsseiten laden `base.css`, die Startseite `site.css`; zwei Dateien mit gleichem Inhaltsteil im Cache. Das `?v=`-Hashing deckt jetzt auch srcset ab. Preiskarte und Kontakt entstehen nur noch im Build: offer.json/company.json ändern ohne `npm run build` ändert nichts.
- **SEO:** Der Title trägt "Webdesign Hamburg" und "Festpreis", die H1 bleibt "Eine Website für deinen Betrieb." (v17, ohne Ortssignal). Das Ortssignal kommt jetzt aus Title, Description, JSON-LD (Adresse, areaServed) und "Zwei Jungs aus Hamburg"; eine H2 mit Suchbegriff (Audit M7) wurde bewusst nicht gesetzt (Copy eingefroren). Title-Kürzung gegenüber dem Audit (siehe M7).
- **Recht/Datenschutz:** JSON-LD veröffentlicht Adresse und Telefon maschinenlesbar (standen schon im Impressum und seit 22d5906 teils im JSON-LD). Die E-Mail steht jetzt im Roh-HTML (vorher per JS zusammengesetzt gegen Harvester); mailto-Body enthält nur die Vorlage, keine Daten des Besuchers. Der Kopieren-Button nutzt die Clipboard-API nur beim Klick (write), keine Berechtigungsabfrage, kein Lesen.
- **Cederics Änderungen:** Seine Crawler-Kopie (22d5906) war eine versteckte Dublette des Inhalts (`display:none` für Crawler, von Google als Cloaking lesbar); M1 ersetzt sie durch einen einzigen sichtbaren DOM. `_headers` cached `/data/*` immutable, obwohl nichts mehr daraus geladen wird (harmlos).
- **Text:** Der neue Satz im Website-Kapitel wechselt das Subjekt (vom Postfach des Kunden zu "uns"); Alternative ohne Wechsel: "Anfragen landen direkt bei dir im Postfach, ohne Umweg." Lucas Entscheidung.

## Verknüpft
- [[Bartolucci Digital (Gründung)]] · [[BartolucciWebsite – Übersicht]] · [[Cederic]]
- Vorgänger: [[REPORT_website_v17_1_fotos]] · Prompt: [[PROMPT_website_v18_audit]] · Audit: [[2026-10-28 Website-Audit Sales-Kontakt]] · Übergabe: [[2026-10-28_Website-Audit]]
- Baustein: [[2026-10-28_2130 Bartolucci Website v18 Audit]]
