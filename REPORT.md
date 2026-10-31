# REPORT Website v19: Hero-Wording, Demo-Badge, Anker-Navigation, CSP-Gate (2026-10-31)

**Maschine:** Main-PC · **Modell:** Claude Opus 5.5 · **Laufzeit:** geschätzt 40 min, tatsächlich ca. 40 min (11:22 bis ca. 12:02)
**Branch:** `feature/hero-demo-nav` auf `main` 6bee798, 7 Commits · **Push:** 403, Bundle · Screenshots: `review_2026-10-31_v19\`

## 1. Was `main` seit v18 enthielt
- `5849158` (29.10.) v18.1 Cederic: info@-Adresse, Kopier-Icons in beiden Kontaktzeilen, Icon am Mail-Button, einzeilige Fußnote, "AUCH OHNE TERMIN". Brachte CRLF-Hashes in `_headers` und CRLF-`?v=`-Werte.
- `6bee798` (30.10.) v18.1.1 Cederic: CSP-Hashes zurück auf die LF-Werte von v18. Alles bleibt drin.

## 2. C1 Hero-Wording (`v19: C1 Hero-Wording`)
| Datei, Zeile | vorher | nachher |
|---|---|---|
| `public/index.html:80` (jetzt :95), H2 Kapitel Website | Deine Website. Von Hand gebaut. | Deine Webseite, maßgeschneidert. |

Suche über das ganze Repo (ohne node_modules), Muster laut Prompt, mit und ohne Bindestrich: das war der einzige Treffer. Meta, og, twitter, JSON-LD, alt, 404, Rechtsseiten, Sitemap, `data/`, README, og.png-Skript: keine Treffer.

## 3. C2 Demo-Badge (`v19: C2 Demo-Badge`)
- Desktop: `<p class="stage-badge">Beispielprojekt</p>` in `.panel-sticky` direkt vor `#stage`, also am Bühnenrahmen, nicht in einer Szene. Oben rechts, z-index 4 über allen Szenen und dem Lichtstreifen; blendet bei der Übergabe an "So läuft's" mit der Bühne aus. Text (vom Screenreader lesbar), Tokens `--surface`, `--line`, `--ink-2`, Punkt in `--accent`, Pillen-Radius.
- Mobil: dieselbe Pille auf der `.m-stage` der Website-Karte (mobile.js); `aria-hidden` sitzt dort jetzt an der Szene statt an der ganzen Bühne. Header, Chat-Hook und Sticky-CTA werden nicht verdeckt (geprüft).
- Preiszeile der Demo "REPARATUR AB 12 €": Laptop 52 auf 38 px, Handy 40 auf 30 px, Schrift `#5b5a54` statt fast schwarz; Abstände halten den Rest der Demo an seinem Platz. Nicht gelöscht.
- Browserfenster-Rahmen nicht gebaut: die Bühne ist seit v11 bewusst rahmenlos, die Szene hat schon ein "Demo-Projekt · erfunden"-Schild.

## 4. C3 Anker-Navigation (`v19: C3 Anker-Navigation`)
| Label | Ziel | Desktop | Mobil |
|---|---|---|---|
| Beispiel | `#k-website` | ja | ja |
| Betreuung | `#k-betreuung` | ja | ja |
| Ablauf | `#ablauf` | ja | ja |
| Preise | `#preise` | ja | ja |
| Über uns | `#ueber-uns` | ja | ja |
| Kontakt | `#kontakt` | Button (bestehend) | Link im Menü (mobil hat keinen Kontakt-Button) |

- `<nav aria-label="Hauptnavigation">` mit echten `<a href="#…">`, Fokusring = bestehendes `:focus-visible`. Headerhöhe 71 px bleibt (gemessen 1440, 1920, 390).
- Unter 900 px und im Mobil-Layout: runder Menü-Button (`aria-expanded`, `aria-controls`), dieselbe Nav als Panel unter dem Header; schließt bei Linkklick, Escape (Fokus zurück auf den Button), Klick daneben, Fokus raus. Keine Bibliothek.
- `scroll-behavior: smooth` stand schon auf `html` inkl. Reset bei reduzierter Bewegung. `scroll-margin-top: calc(71px + 8px)` auf Abschnitten, Mobil-Karten und Kapiteln im schmalen Layout. **Abweichung:** die 100vh-Kapitel im breiten Desktop-Layout (ab 1100 px) landen bei 0 wie Rail und v16-Einrasten; mit 79 px zog das Einrasten sie nach jedem Sprung zurück (Doppelbewegung).
- Desktop und mobil laufen die Klicks über `lenis.scrollTo` (beachtet scroll-margin, ScrollTrigger synchron). Nav-Links legen einen History-Eintrag an, `popstate` scrollt zurück: Zurück-Taste geprüft. "Preise" landet mit abgegebener Bühne (`handed: true`), "Beispiel" mit Website-Szene.

## 5. CSP
- Gate `scripts/qa-csp.mjs` (ohne Abhängigkeiten): CRLF in einer Seite, Inline-Skript ohne Hash, verwaister Hash, `'unsafe-inline'` in script-src, `form-action`/`connect-src` nicht `'none'` führen zu Exit 1 mit Tabelle. Läuft am Ende von `npm run build` und als `npm run qa:csp`. Gegenprobe mit CRLF-Kopie: schlägt wie erwartet fehl.
- **Ergebnis auf `main` 6bee798: PASS.** Cederic hatte die Hashes mit v18.1.1 schon korrigiert, daher kein eigener `v19: CSP-Hashes`-Commit. Hashes in v19 unverändert (`98Sfjrha…`, `uRfEjmz5…`): beide Inline-Skripte sind unangetastet, C2/C3 liegen in den externen Dateien.
- `.gitattributes` (`* text=auto eol=lf`) neu als erster Commit; `--renormalize` ergab keinen Diff (main speichert LF). `core.autocrlf false` in diesem Clone.
- `?v=` (Prompt §4.4): auf main waren gsap, ScrollTrigger, lenis, logo.svg, skyline usw. SHA-256 der CRLF-Fassung (gsap `dd7dc87e02` = CRLF, LF ergibt `92bb9a9647`). Pipeline-Fix: `build-version.mjs` und `build-headers.mjs` hashen Textdateien in LF-Form. Die Werte ändern sich einmalig und bleiben ab jetzt auf jeder Maschine gleich (in allen v19-Commits identisch).
- Neu `scripts/serve-headers.mjs`: lokaler Server mit der CSP aus `_headers` (`serve` ignoriert sie), damit ein falscher Hash schon lokal als Konsolenfehler auffällt.

## 6. Gates
- `npm run build` sauber. qa-v19 **62/62** (Label über allen drei Szenen ohne Überlappung, hell/dunkel, 1440/1920/390; Nav-Ziele; Zurück; Mobil-Menü; ohne JS; 0 Konsolenfehler unter echter CSP; 0 Fremdanfragen).
- Bestehend: qa-csp, qa-fouc 10/10, qa-gates, qa-jsonld, qa-keyboard, qa-legal (0 Unterschiede), qa-scenes, qa-shots, qa-static, qa-v13, qa-v15, qa-v17, qa-v18, check-sizes (0,87 MB): PASS. Angepasst mit Grund: qa-gates (verbietet "maßgeschneidert"; Lucas Überschrift ist als genau diese Zeile freigestellt), qa-keyboard (Abschnitte bei 79 statt 71 px, Grenze 75 auf 83). **qa-v12 FAIL wie auf main:** Zeilenlänge 88 Zeichen in Cederics einzeiliger Fußnote (v18.1), nicht angefasst.
- Lighthouse, ein Lauf je Ziel, lokaler CSP-Server: main Desktop 100/100/100/92, Mobil 89/100/100/92 · v19 Desktop 100/100/100/92, Mobil 91/100/100/92 (CLS 0,001). SEO 92 = robots.txt-Abruf von der CSP geblockt (bekannt seit v18).
- Diffstat je Commit: gitattributes 1 Datei +1 · CSP-Gate 8 Dateien +121/-27 · C1 1 Datei +1/-1 · C2 5 Dateien +55/-9 · C3 11 Dateien +165/-17 · QA 4 Dateien +242/-4.

## 7. Weitere Befunde (nicht behoben)
- Mobil landet `#kontakt` ca. 74 px tiefer als Ziel, ebenso der bestehende CTA "Erstgespräch anfragen" auf main: Lenis begrenzt vor dem echten Seitenende. Überschrift voll sichtbar.
- "Webseite" in der neuen Überschrift, sonst überall "Website" (Lucas exakter Wortlaut, bewusst so übernommen).
- Website-Szene zeigt jetzt zwei Hinweise ("Demo-Projekt · erfunden" in der Szene und die Pille); wer will, streicht das Szenen-Schild.
- `style-src 'unsafe-inline'` bleibt nötig (style-Attribute in der Skyline). C2PA-Block (mehrere KB Base64) steckt weiter in `index.html`. Leere Datei `npm` im Repo-Root (seit fb1a6c6). `review_v18/` aus qa-v18 steht nicht in `.gitignore`.

## 8. Schwachstellen
- **Technik:** Anker-Sprünge über Lenis halten ScrollTrigger synchron; Deep-Link `/#preise` springt beim Laden nativ (vor Lenis), mit scroll-margin. History-Einträge nur für die Nav-Links, Hero-CTAs ersetzen den Hash wie bisher. Das Mobil-Menü ist ein Disclosure, keine Falle: Fokus raus schließt es. Ohne JS bleibt die Nav eine seitlich scrollbare Zeile; bei 390 px ist davon nur "Beis…" sichtbar (Mobil-Layout braucht ohnehin JS). Label z-index 4 über Szenen (Streifen 3), mit der Bühne ausgeblendet; ohne JS gibt es keine Bühne, der Text-Hinweis "ein Demo-Projekt" bleibt.
- **Recht/Marketing:** "maßgeschneidert" stand auf unserer eigenen Floskel-Liste und verspricht individuelle Anfertigung. Haltbar, solange jede Seite eigene Gestaltung und eigene Texte bekommt; arbeiten wir mit wiederverwendeten Vorlagen, sind "maßgeschneidert", "Eigene Gestaltung" und "nach deinem Laden" die Stellen, die zuerst angreifbar wären. "Von Hand" ist weg.
- **CSP:** Das Gate prüft den Build im Repo, nicht den Live-Deploy (Cloudflare-Beacon, M13). Keine Integrity für die selbst gehosteten Vendor-Dateien (gleiche Herkunft, `'self'`). Inline-Styles nicht gehasht. Eine CRLF-Arbeitskopie bricht jetzt `npm run build` ab: Cederic einmal `git add --renormalize .` bzw. Neu-Checkout nach dem Merge.
- **Cederics Änderungen seit v18:** v18.1.1 hat den CSP-Bruch richtig behoben; die CRLF-`?v=`-Werte aus v18.1 sind mit dem LF-Hashing erledigt.

## 9. Push
`Push: 403, Bundle` ("denied to LucaW0204"). Bundle `bartolucci-website-v19.bundle` (alle Refs) und Screenshot-ZIP im Kurier an Cederic. Einspielen: `git fetch bartolucci-website-v19.bundle feature/hero-demo-nav:feature/hero-demo-nav`, dann pushen, prüfen, mergen, `npm run build`, deployen.
