/* Shared behaviour for both page bodies: theme toggle, offer block, contact lines, header state, year. */
(function () {
  'use strict';
  var d = document;
  var html = d.documentElement;
  var BD = window.BD || {};

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

  /* ---------- header shadow ---------- */
  var header = d.querySelector('[data-header]');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', (window.scrollY || 0) > 8); };
    addEventListener('scroll', onScroll, {passive: true});
    onScroll();
  }

  /* ---------- offer (pricing) ---------- */
  var fmt = function (n) { return n.toLocaleString('de-DE') + ' €'; };
  function renderOffer(el, compact) {
    var o = BD.offer;
    if (!o) return;
    var launch = o.slotsLeft > 0;
    var frag = d.createDocumentFragment();
    var mk = function (tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    var left = compact ? mk('div', 'offer-main') : frag;
    left.appendChild(mk('p', 'offer-label', launch ? 'Website · Einführungspreis' : 'Website'));
    left.appendChild(mk('p', 'offer-price', launch ? 'Einführungspreis ' + fmt(o.launchPrice) : fmt(o.regularPrice)));
    if (launch) {
      left.appendChild(mk('p', 'offer-sub', 'regulär ' + fmt(o.regularPrice) + ' · noch ' + o.slotsLeft + ' von ' + o.slotsTotal + ' Plätzen'));
    } else {
      left.appendChild(mk('p', 'offer-sub', 'Festpreis, alles drin'));
    }
    if (compact) frag.appendChild(left);
    if (compact) {
      var btn = mk('a', 'btn btn-primary btn-lg', 'Platz anfragen');
      btn.href = '#kontakt';
      frag.appendChild(btn);
    }
    if (launch) {
      frag.appendChild(mk('p', 'offer-why', 'Die ersten drei Kunden bekommen unseren Einführungspreis – weil wir mit ihnen unsere Referenzen aufbauen.'));
    }
    var care = mk('p', 'offer-care', 'Technische Betreuung ab ' + fmt(o.carePrice) + '/Monat ');
    care.appendChild(mk('span', null, '· Updates, Sicherung, kleine Änderungen'));
    frag.appendChild(care);
    frag.appendChild(mk('p', 'offer-fine', 'Alle Preise sind Endpreise. Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.'));
    el.textContent = '';
    el.appendChild(frag);
  }
  var offers = d.querySelectorAll('[data-offer]');
  for (var i = 0; i < offers.length; i++) renderOffer(offers[i], offers[i].getAttribute('data-offer') === 'compact');

  /* ---------- contact (assembled at runtime from split strings, so address harvesters that read the raw HTML find nothing) ---------- */
  var box = d.querySelector('[data-contact]');
  if (box) {
    var user = ['ceder', 'icla', 'ngpaap'].join('');
    var host = ['gmail', 'com'].join('.');
    var mail = user + '@' + host;
    var tel = ['0170', '7240', '195'];
    var telDisplay = tel.join(' ');
    var telHref = 'tel:+49' + tel.join('').slice(1);
    var line = function (href, label, svgPath, hint) {
      var a = d.createElement('a');
      a.className = 'contact-line';
      a.href = href;
      var ns = 'http://www.w3.org/2000/svg';
      var svg = d.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      var p = d.createElementNS(ns, 'path');
      p.setAttribute('d', svgPath);
      svg.appendChild(p);
      a.appendChild(svg);
      var span = d.createElement('span');
      span.textContent = label;
      a.appendChild(span);
      var hintEl = d.createElement('span');
      hintEl.className = 'small';
      hintEl.textContent = hint;
      a.appendChild(hintEl);
      return a;
    };
    box.appendChild(line('mailto:' + mail, mail, 'M3 6h18v12H3zM3 6l9 7 9-7', 'E-Mail'));
    box.appendChild(line(telHref, telDisplay, 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z', 'Telefon'));
  }

  /* ---------- year ---------- */
  var y = d.querySelector('[data-year]');
  if (y) y.textContent = String(new Date().getFullYear());
})();
