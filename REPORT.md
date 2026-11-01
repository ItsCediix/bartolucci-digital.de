# NICHT FERTIG: REPORT Website v20, Webdesign und Preisbox (2026-11-01)

**Nicht fertig heißt hier:** alle vier Änderungen sind committet und geprüft, aber `npm install` war blockiert (BLOCKED.md). Playwright-Gates, Lighthouse und der volle `npm run build` liefen nicht; ersatzweise Prüfung im echten Chrome (§7).
**Maschine:** Main-PC · **Modell:** Claude Opus 5.5 · **Branch:** `feature/webdesign-preisbox` auf `main` d8169c7, 4 Commits + Report · **Push:** 403, Bundle

## 1. Was `main` seit v19 enthielt
- `a0149d7` (31.10.) v19.1 Cederic: Feedback-Runde (CSS, Szenen, Teamfotos).
- `f4278e6` (31.10.) FAQ-Seite `/faq` (17 Fragen, Quelle `data/faq.json`, `build-faq.mjs` schreibt HTML und FAQPage-JSON-LD), llms.txt, Sitemap, Nav- und Footer-Link. Commit heißt selbst schon "v20: FAQ-Seite" (Namenskollision mit diesem Lauf).
- `697b1b1` (31.10.) v19.2 Cederic: Teamfotos nachgebessert (JPEGs entfernt, nur WebP/AVIF), FAQ-Links an die Preise statt in die Sprungnavigation.
- `d3736f0`, `d8169c7` (01.11.) v19.3 Cederic: Betreuungs-Szene zeigt "Auch auf Google Maps aktualisiert" (eigener Pin, kein Google-Logo).

## 2. C1 "Webdesign" (`v20: C1 Webdesign-Nennungen`, 1 Datei +3/-3)
| Stelle | vorher | nachher |
|---|---|---|
| `public/index.html:333` H2 `#ueber-h` | Zwei Jungs aus Hamburg. | Webdesign aus Hamburg: zwei Jungs, ein Festpreis. |
| `public/index.html:334` erster Satz `.lead` | (Absatz begann mit "Zu zweit, kurze Wege:") | neuer erster Satz: Wir machen Webdesign für Läden und Betriebe in Hamburg: eine Website zum Festpreis, danach betreuen wir die Technik. |
| `public/index.html:383` Footer | Eine Website für deinen Betrieb · Hamburg | Webdesign Hamburg · Website zum Festpreis |
- Satz bewusst "danach betreuen wir die Technik" statt "kümmern wir uns um die Technik": der nächste Satz sagt schon "und der kümmert sich". Absatz +1 Satz, Rest unverändert. id, Anker `#ueber-uns`, Nav-Link unverändert.
- Footer-Tagline gibt es nur einmal (`index.html`); `/faq`, `/impressum`, `/datenschutz`, `/404` haben eigene `.foot`-Zeilen ohne Tagline. Mobil = dieselbe `index.html` (seit v18 M1 ein DOM, das Mobil-Skript ordnet nur die Kapitel um); Team und Footer sind geteilt.
- og:description weicht von der Meta-Description ab, daher unverändert. H1, Hero, Nav, JSON-LD unverändert.
- **Zählprüfung** (Node, sichtbarer Text ohne head/script/style/svg/Tags, `analysis\count.mjs`): `index.html` Webdesign main 0 / v20 **3**, Webseite main 1 / v20 **0**; faq, 404, impressum, datenschutz: 0 / 0.

## 3. C2 "Nicht enthalten" (`v20: C2 Nicht-enthalten-Zeile`, 3 Dateien +4/-1)
- Quelle `data/offer.json` `text.excluded`, gerendert von `scripts/build-static.mjs` `renderOffer()`. DOM: `#preise .price > ul.facts + p.price-note` (zwischen den Fakten und dem Button, in der Karte). `<strong>Nicht enthalten:</strong>` + Text, 79 € kommt aus `roundPrice`.
- Klasse `price-note` wiederverwendet: 13,5 px, Farbe wie die Fußnote (hell `#566274`, dunkel `--ink-2`), gemessen identisch. Kein neues CSS.
- Overflow (Chrome, feste Breiten): Karte nicht in einer GSAP-Szene (kein Pin). Höhe main → v20: 1440 511 → 566 px, 1920 619 → 673 px, 390 594 → 689 px; passt in jeden Viewport (900/1080/844), Zeile in der Karte, kein Clipping, kein Overflow, hell und dunkel. Zeile 2 Zeilen Desktop, 4 Zeilen mobil. Kein Spacing geändert.
- JSON-LD `Offer.description` der Website listet keine Inklusivleistungen auf, daher unverändert (qa-jsonld PASS).

## 4. C3 Webseite → Website (`v20: C3 Webseite zu Website`, 3 Dateien +5/-5)
- `public/index.html:95` H2 Kapitel Website: "Deine Webseite, maßgeschneidert." → "Deine Website, maßgeschneidert." (statisches HTML, kein Inline-Skript; Hashes unberührt).
- Mitgezogen: `scripts/qa-gates.mjs` (Ausnahme für "maßgeschneidert" auf neuen Wortlaut), `scripts/qa-v19.mjs` (2 Soll-Werte).
- Suche case-insensitive über alles (HTML, Daten, Meta, OG, alt, JSON-LD, FAQ, 404, llms.txt, README): sonst kein Treffer. Impressum/Datenschutz: 0 Treffer. Bleibt: `REPORT.md` von v19 im Repo (Protokoll).

## 5. C4 FAQ-Antwort 3 (`v20: C4 FAQ Domain-Satz`, 2 Dateien +4/-4)
- Vorher: "Nach dem Start kostet die technische Betreuung 49 € im Monat – weitere Gebühren gibt es nicht. / Darin sind Hosting, Domain (Domainkosten bis 20 €), regelmäßige Updates und kleine Änderungen enthalten. Plattformgebühren oder ein Baukasten-Abo fallen nicht an."
- Nachher: Wortlaut aus dem Prompt, Plattform-Satz unverändert am Ende. Absatz 1 (fett gesetzt als Direktantwort): Betreuung + Inhalt; Absatz 2: Gebührensatz + Plattform-Satz.
- Quelle `data/faq.json`, `build-faq.mjs` schreibt HTML und JSON-LD aus derselben Quelle. Node-Parse: 17 Question-Einträge, kein Fehler, `acceptedAnswer.text` = beide Absätze.

## 6. CSP
- `qa-csp.mjs` auf main: PASS. Vor jedem Commit: PASS. Hashes unverändert (`98Sfjrha…`, `uRfEjmz5…`), kein `v20: CSP-Hashes`-Commit.
- `?v=`: index 17, faq 5, 404 5 Werte, main und v20 identisch. `.gitattributes` LF vorhanden.

## 7. Gates
- Ohne Abhängigkeiten gelaufen: qa-csp PASS, qa-legal 0 Unterschiede, qa-jsonld PASS, check-sizes 0,74 MB OK. **qa-gates FAIL wie auf main** (3 Treffer "maßgeschneidert"/Floskeln in Cederics `faq.json`/`faq.html`), keine Regression, nicht angefasst.
- Chrome (Claude in Chrome) gegen `serve-headers.mjs` mit echter CSP: `/`, `/faq`, `/?mode=mobile` 0 Konsolenfehler; HTTP 200 für `/`, `/faq`, `/impressum`, `/datenschutz`, 404 für `/nope`; 0 externe Ressourcen (Datenschutz hat nur 2 Text-Links). Alle vier Änderungen stehen im Roh-HTML (also auch ohne JS).
- Screenshots `review_2026-11-01_v20\` (2 Stück: Preisbox 1440 + 390, Team 1440 + FAQ 3 offen 390). **Nicht gelaufen:** Playwright-Matrix (Skript `analysis\qa-v20.mjs` vorbereitet), übrige qa-Skripte mit Playwright, Lighthouse, voller Build. Seitliches `scrollWidth` > Viewport auch auf main (body `overflow-x: clip`), keine Regression.

## 8. Weitere Befunde (nicht behoben)
- Preiskarte sagt "Hosting, Domain" ohne 20-€-Grenze; die steht jetzt nur in der Nicht-enthalten-Zeile und im FAQ. llms.txt: "Domain (Domainkosten bis 20 €)", ohne Differenz-Satz.
- og.png und `og:image:alt` tragen weiter "Eine Website für deinen Betrieb, Hamburg" (`scripts/og.mjs`). Sitemap `lastmod` für `/` steht auf 2026-10-28.
- qa-gates schlägt seit der FAQ-Seite auf main fehl ("maßgeschneiderte Website" in FAQ, Floskelliste). Cederics FAQ-Commit heißt "v20".

## 9. Schwachstellen
- **Technik:** Preiskarte ist nicht gepinnt, Wachstum +54 bis +95 px unkritisch. Footer nur einmal vorhanden (keine Kopien, kein Drift). FAQ: HTML und JSON-LD aus einer Quelle, Drift nur bei Handbearbeitung von `faq.html`; Preise in `faq.json` sind Text, nicht an `offer.json` gekoppelt (49 €, 20 €, 79 € dreifach gepflegt: offer.json, faq.json, llms.txt). Ungeprüft wegen Blockade: Lighthouse-Werte, FOUC, Tastatur.
- **SEO:** 3 sichtbare Nennungen + Title + Description + llms.txt reichen für das Keyword ohne Stuffing. Die Team-H2 konkurriert nicht mit der H1 (Ebene H2, anderer Abschnitt); "Webdesign aus Hamburg" steht jetzt nur in einer H2 weit unten, das Ortssignal der H1 fehlt weiter. Übrige H2 halten ihr Versprechen ("So läuft's: drei Schritte" hat genau drei: Gespräch, Entwurf, Live).
- **Recht/Marketing:** "ein Festpreis" stimmt für 995 € und 1.990 €, solange jede Website zu einem Pauschalpreis läuft; mit der Zeile "weitere Unterseiten 79 € je Korrekturrunde" ist der Festpreis jetzt klar begrenzt (gut, schützt vor dem Vorwurf versteckter Kosten). "Domainkosten über 20 €": Differenz wird "weiterberechnet"; ob monatlich oder jährlich, steht nirgends. Der Sonderpreis für drei Kunden steht in der Karte, nicht in der H2.
- **CSP:** Gate prüft den Build im Repo, nicht den Live-Deploy; Inline-Styles ungehasht (`'unsafe-inline'` in style-src); JSON-LD-Blöcke sind Datenblöcke ohne Hash.
- **Cederics Änderungen:** FAQ-Seite sauber (Quelle + Generator, eigenes Hub-Linking, CSP-konform ohne JS), aber Floskel-Gate verletzt; `_headers` bekam einen `/faq`-Block; Teamfotos ohne JPEG-Fallback (nur WebP/AVIF, alte Browser ohne Bild).

## 10. Push und Laufzeit
- `Push: 403, Bundle` ("denied to LucaW0204"). Bundle `bartolucci-website-v20.bundle` (alle Refs) im Kurier an Cederic. Einspielen: `git fetch bartolucci-website-v20.bundle feature/webdesign-preisbox:feature/webdesign-preisbox`, dann `npm ci && npm run build`, prüfen, mergen, deployen.
- Geschätzt 30 min, tatsächlich ca. 35 min (12:04 bis ca. 12:40), davon 15 min Warten auf node_modules.
