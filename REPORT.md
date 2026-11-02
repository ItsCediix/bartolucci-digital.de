# REPORT Website v20.1: Nachprüfung von v20 mit allen Gates (2026-11-02)

**Maschine:** Main-PC · **Modell:** Claude Opus 5.5 · **Lauf:** main-20261102-091544-bartolucci-website-v20-1 · **Branch:** `feature/v20-1-qa` auf `origin/main` 1afffed, 1 Fix-Commit + Report · **Push:** 403, Bundle

## 1. Basis
- **Fall a:** `origin/main` enthält die v20-Commits (Cederic hat gemergt). Neuer Branch `feature/v20-1-qa` von `origin/main`. Vergleichsstand für Lighthouse und Gegenproben: `d8169c7` (Parent von `v20: C1`), als zweiter Worktree `base\` gebaut.
- Commits auf main seit v19 (`02b323c`): `a0149d7` v19.1 Feedback Cederic · `f4278e6` FAQ-Seite /faq mit FAQPage-JSON-LD, llms.txt, Sitemap (Commit heißt "v20:") · `697b1b1` v19.2 Teamfotos, FAQ-Links an die Preise · `d3736f0` v19.3 Betreuungs-Szene "Website + Google Maps" · `d8169c7` v19.3 Variante C Karten-Eintrag · `4c4e47c`, `a31d73b`, `1f08fe3`, `7d7315d`, `1afffed` v20 C1 bis C4 + REPORT.

## 2. Install und Build
- `npm ci` über den Node-Wrapper: 292 Pakete, 18 s (34 Audit-Hinweise, nicht angefasst). Erster Versuch scheiterte an `cmd.exe ENOENT`: Backslash-Pfad im `-e`-String unter Bash, mit Schrägstrichen sofort ok. `npx playwright install chromium` nötig (Browser fehlte).
- `npm run build`: sauber, keine Warnungen, kein Diff im Arbeitsbaum (Build reproduziert den committeten Stand). Basis ebenso.

## 3. Gates (v20 = origin/main, Basis = d8169c7)
| Gate | v20 | Basis | Zahl |
|---|---|---|---|
| qa-csp | PASS | PASS | 2 Inline-Skripte, Hashes `98Sfjrha…`, `uRfEjmz5…` unverändert |
| qa-legal | PASS | | Impressum 13, Datenschutz 31 Zeilen, 0 Unterschiede |
| qa-jsonld | PASS | | 3 Offers |
| FAQ-JSON-LD (eigen) | PASS | | 17 Question, 17 HTML-Einträge, Antwort 3 identisch, 0 Drift über alle 17 |
| Zählprüfung (eigen) | PASS | | index: Webdesign 3 (H2 Team, Team-Satz, Footer), Webseite 0; faq/404/impressum/datenschutz 0/0; gerendert in allen 6 Varianten 3/0 |
| Playwright-Matrix (eigen) | PASS | | 1440/1920/390 × hell/dunkel: 0 Konsolenfehler, 0 Fremdanfragen (CSP-Server), Karte scrollHeight = clientHeight (564/671/661), Zeile in der Karte, 13,5 px wie Fußnote |
| ohne JS | PASS | | C1 (3×), C2, C3, C4 bei 1440 und 390 im statischen HTML |
| qa-static, qa-fouc 10/10, qa-keyboard, qa-scenes, qa-shots, qa-v15, qa-v17, check-sizes 0,74 MB | PASS | | |
| qa-v13 | PASS nach Fix bis auf pageLength | PASS | pageLength 7,25 vh > 7,2 (Basis ≤ 7,2) |
| qa-v12 lineLength | FAIL | FAIL | v20 147 Zeichen ("Nicht enthalten"-Zeile, 2560/3440), Basis 88 (Fußnote) |
| qa-gates forbiddenWords | FAIL | FAIL | 3 Treffer "maßgeschneidert" in Cederics FAQ, identisch |
| qa-v18 m17 | FAIL | FAIL | Footer-Liste erwartet ohne /faq (Cederic v19.2), identisch |
| qa-v19 C2 | FAIL | FAIL | `.stage-badge` fehlt seit Cederics v19.x, Skript bricht ab, identisch |
| Lighthouse Desktop | 100/100/100/92 | 99/100/100/92 | LCP 0,8 s, CLS 0 |
| Lighthouse Mobil | 90/100/100/92 | 89/100/100/92 | LCP 3,6 vs 3,7 s, CLS 0 |
- LF: alle v20-Dateien `i/lf w/lf`, `.gitattributes` greift. Kein CSP-Hash-Fix nötig.

## 4. Fixes
- `scripts/qa-v13.mjs:256` teamTexts: vorher `startsWith('Zu zweit, kurze Wege: …')`, nachher mit dem v20-Satz "Wir machen Webdesign für Läden und Betriebe in Hamburg: …" davor.
- `scripts/qa-v13.mjs:191` Fußnote: vorher erste `.price-note` (jetzt die Nicht-enthalten-Zeile in der Karte), nachher die `.price-note` außerhalb der Karte.
- `scripts/qa-v13.mjs:223` slots0-Ersatz: vorher bis zur ersten `</p>` einer `.price-note` (schnitt die Karte jetzt mittendrin ab), nachher bis `<!-- offer:end -->`.
- Ein Commit `v20.1: qa-v13 an v20 angepasst`. Seite, Texte, CSS, CSP unverändert.

## 5. Weitere Befunde (nicht behoben)
- **qa-v13 pageLength:** Seite 7,25 statt max. 7,2 Bildschirmhöhen bei 1440 (Karte +55 px, Team-Satz). Kein Overflow; Fix wäre Spacing außerhalb der Karte oder Grenze anheben, Entscheidung Cederic.
- **qa-v12 Zeilenlänge:** die Nicht-enthalten-Zeile läuft auf breiten Schirmen über die ganze Kartenbreite (104 Zeichen bei 1440, 137 bei 1920, 147 ab 2560; Gate 80). Gate war vorher schon rot (88). Vorschlag: `max-width` in `ch` für `.price-note` in der Karte.
- qa-gates, qa-v18 m17, qa-v19 C2: Testerwartungen veraltet durch Cederics Änderungen (FAQ-Floskel, /faq im Footer, Badge entfernt). Gehört in eine Aufräumrunde der qa-Skripte.
- Theme folgt nur dem Schalter (`localStorage bd-theme`), nicht `prefers-color-scheme`; Playwright mit `colorScheme: dark` allein zeigt hell.

## 6. Schwachstellen
- **Technik:** Gates prüfen den lokalen Build, nicht den Cloudflare-Deploy (Header, Beacon). `serve-headers.mjs` sendet nur den `/*`-Block aus `_headers`, nicht die Pfadblöcke (`/faq`). Lighthouse je ein Lauf; auf diesem Rechner schwankt Mobil erfahrungsgemäß um 1 bis 2 Punkte, Differenz +1 liegt im Rauschen. Vier qa-Skripte sind dauerhaft rot, damit verliert die Suite ihre Signalwirkung.
- **Recht/Marketing:** nichts Neues gesehen.
- **Prozess:** kein Block. Git-Identität fehlte global, Commit mit `-c user.name/-c user.email` wie in v20. Push 403 wie immer.

## 7. Push
`Push: 403, Bundle` ("denied to LucaW0204"). Bundle `bartolucci-website-v20-1.bundle` (alle Refs). Einspielen: `git fetch bartolucci-website-v20-1.bundle feature/v20-1-qa:feature/v20-1-qa`, prüfen, mergen.

## 8. Laufzeit
Geschätzt 20 min, tatsächlich ca. 30 min (09:15 bis ca. 09:45); Mehrzeit durch Playwright-Download und Gegenproben auf der Basis.
