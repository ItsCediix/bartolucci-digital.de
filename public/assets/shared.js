// reload (F5) always starts at the top instead of restoring the old scroll position; #anchor links still work
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (!location.hash) window.scrollTo(0, 0);
/* Shared behaviour for all pages: theme toggle, header state, team photos, contact line fit, year.
   v18: the price card and the contact lines are static HTML (scripts/build-static.mjs), nothing is rendered here. */
(function () {
  'use strict';
  var d = document;
  var html = d.documentElement;
  var mk = function (tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /* ---------- theme ---------- */
  var toggle = d.querySelector('[data-theme-toggle]');
  function applyTheme(theme, persist) {
    html.setAttribute('data-theme', theme);
    var meta = d.querySelector('meta[data-theme-color]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b1220' : '#faf8f3');
    if (toggle) {
      toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      toggle.setAttribute('aria-label', theme === 'dark' ? 'Helles Design einschalten' : 'Dunkles Design einschalten');
    }
    if (persist) {
      try { localStorage.setItem('bd-theme', theme); } catch (e) { /* private mode */ }
    }
  }
  applyTheme(html.getAttribute('data-theme') || 'light', false);
  if (toggle) {
    toggle.addEventListener('click', function () {
      applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
    });
  }

  /* ---------- background fields (v15): each field is centred on its anchor in document coordinates – blue
     behind the hero, sand in between, blue at the price card. Re-measured whenever the page height changes
     (fonts, scenes, theme); pages without the anchors (legal) keep the CSS defaults ---------- */
  var fields = d.querySelectorAll('#bg .bg-f');
  // the price field sits beside the opaque card (desktop) or behind heading + lead above it (mobile)
  var ANCHORS = [['#k-hook', 0.45], ['#k-betreuung', 0.5], html.getAttribute('data-mode') === 'mobile' ? ['#preise', 0.22] : ['#preise .price-col', 0.2]];
  var place = function () {
    var top = d.body.getBoundingClientRect().top;
    for (var i = 0; i < fields.length && i < ANCHORS.length; i++) {
      var a = d.querySelector(ANCHORS[i][0]);
      if (!a) continue;
      var r = a.getBoundingClientRect();
      fields[i].style.setProperty('--y', Math.round(r.top - top + r.height * ANCHORS[i][1]) + 'px');
    }
  };
  if (fields.length) {
    place();
    if ('ResizeObserver' in window) new ResizeObserver(place).observe(d.body);
    addEventListener('load', place);
  }

  /* ---------- background fields (v13): a slight drift with the scroll, one rAF per scroll frame,
     at most 120 px; static with reduced motion and in the mobile layout ---------- */
  if (fields.length && html.getAttribute('data-mode') !== 'mobile' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var RATES = [0.04, -0.03, 0.025];
    var queued = false;
    var drift = function () {
      queued = false;
      var y = window.scrollY || 0;
      for (var i = 0; i < fields.length; i++) {
        var v = Math.max(-120, Math.min(120, y * RATES[i]));
        fields[i].style.transform = 'translate3d(0,' + v.toFixed(1) + 'px,0)';
      }
    };
    addEventListener('scroll', function () {
      if (!queued) { queued = true; requestAnimationFrame(drift); }
    }, {passive: true});
    drift();
  }

  /* ---------- header shadow ---------- */
  var header = d.querySelector('[data-header]');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', (window.scrollY || 0) > 8); };
    addEventListener('scroll', onScroll, {passive: true});
    onScroll();
  }

  /* ---------- price card: static HTML since v18, rendered at build time from data/offer.json (build-static.mjs,
     renderOffer); the UWG § 5 rule for the struck regular price lives there as well ---------- */

  /* ---------- team photos: /assets/team/<name>.jpg shows up by itself once the file exists; until then an
     initials tile takes its place (listener set here, no inline handler, CSP) ---------- */
  function photoFallback(img) {
    var tile = mk('div', 'card-photo card-photo--fallback', img.getAttribute('data-initials') || '');
    tile.setAttribute('role', 'img');
    tile.setAttribute('aria-label', img.getAttribute('alt') || '');
    img.replaceWith(tile);
  }
  d.querySelectorAll('img.card-photo').forEach(function (img) {
    if (img.complete && img.currentSrc && img.naturalWidth === 0) photoFallback(img);
    else img.addEventListener('error', function () { photoFallback(img); }, {once: true});
  });

  /* ---------- contact lines: static HTML since v18 (build-static.mjs from data/company.json; the address is in the
     raw HTML on purpose, the audit of 28.10. asked for it and the JSON-LD carries it anyway). Here only the v15 fit:
     the address stays on one line, and where it does not fit (very narrow screens, large text) the line reads
     "Mail schreiben" with the address still in href + title ---------- */
  var mailLine = d.querySelector('[data-contact] a[href^="mailto:"]');
  var val = mailLine && mailLine.querySelector('.contact-val');
  if (val) {
    var mail = val.textContent;
    var fitMail = function () {
      val.textContent = mail;
      if (val.scrollWidth > val.clientWidth + 1) val.textContent = 'Mail schreiben';
    };
    fitMail();
    addEventListener('resize', fitMail, {passive: true});
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(fitMail);
  }

  /* ---------- v18 (audit M14): the layout mode (desktop / mobile) is picked once in <head>: touch + portrait or narrower
     than 768 px. A rotation (iPad) or a window resize across that rule used to keep the old body until the next visit.
     Now the rule is re-evaluated 300 ms after the last resize / orientationchange and the page reloads when the mode
     would change. Skipped on the legal pages (no mode) and when ?mode= forces a body. ---------- */
  var mode = html.getAttribute('data-mode');
  var forced = false;
  try { forced = /^(desktop|mobile)$/.test(new URLSearchParams(location.search).get('mode') || ''); } catch (e) { /* ignore */ }
  if (mode && !forced) {
    var wanted = function () { return (matchMedia('(pointer: coarse)').matches && matchMedia('(orientation: portrait)').matches) || innerWidth < 768 ? 'mobile' : 'desktop'; };
    var modeTimer = 0;
    var recheck = function () {
      clearTimeout(modeTimer);
      modeTimer = setTimeout(function () { if (wanted() !== html.getAttribute('data-mode')) location.reload(); }, 300);
    };
    addEventListener('resize', recheck, {passive: true});
    addEventListener('orientationchange', recheck, {passive: true});
  }

  /* ---------- year ---------- */
  var y = d.querySelector('[data-year]');
  if (y) y.textContent = String(new Date().getFullYear());
})();
