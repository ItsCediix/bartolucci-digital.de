# Teamfotos

Seit v19.1 sind die Fotos freigestellt (transparenter Hintergrund). Die Vorlagen liegen als quadratische PNGs mit Alphakanal in `assets-src/team/` (luca.png, cederic.png, mind. 800 × 800, Augen bei ca. 52 %, Kinn nicht tiefer als ca. 88 % der Höhe). `npm run build` erzeugt daraus hier luca/cederic.webp und .avif (800 × 800, ohne Metadaten). Den Hintergrund hinter dem Foto malt `.card-photo-box` in base.css: weiß im hellen, dunkler Verlauf im dunklen Modus.
