/* Shared behaviour for all pages: theme toggle, header state, price card, team photos, contact lines, year. */
(function () {
  'use strict';
  var d = document;
  var html = d.documentElement;
  var BD = window.BD || {};
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

  /* ---------- header shadow ---------- */
  var header = d.querySelector('[data-header]');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', (window.scrollY || 0) > 8); };
    addEventListener('scroll', onScroll, {passive: true});
    onScroll();
  }

  /* ---------- price card: all numbers and texts come from offer.json ----------
     The struck regular price is never shown as "statt"/"vorher": it has not been charged yet, so it is only
     presented as the regular price from the 4th customer on (UWG § 5, no "Mondpreis"). */
  var fmt = function (n) { return n.toLocaleString('de-DE') + ' €'; };
  // a .facts row: lead clause (up to the first comma or bracket) semibold, the rest regular
  var fact = function (text) {
    var li = mk('li');
    var m = /^([^,(]+,?)(.*)$/.exec(text);
    li.appendChild(mk('strong', null, m ? m[1] : text));
    if (m && m[2]) li.appendChild(d.createTextNode(m[2]));
    return li;
  };
  function renderOffer(el) {
    var o = BD.offer;
    if (!o || !o.text) return;
    var t = o.text;
    var values = {launch: fmt(o.launchPrice), regular: fmt(o.regularPrice), care: fmt(o.carePrice), round: fmt(o.roundPrice), slotsLeft: o.slotsLeft, slotsTotal: o.slotsTotal};
    var fill = function (s) { return s.replace(/\{(\w+)\}/g, function (_, k) { return values[k]; }); };
    var launch = o.slotsLeft > 0;
    var frag = d.createDocumentFragment();
    if (launch) frag.appendChild(mk('p', 'price-tag', t.tag));
    var row = mk('div', 'price-row');
    row.appendChild(mk('p', 'price-now', fmt(launch ? o.launchPrice : o.regularPrice)));
    if (launch) {
      var reg = mk('p', 'price-reg');
      reg.appendChild(mk('s', null, fmt(o.regularPrice)));
      reg.appendChild(mk('span', null, t.regularLabel));
      row.appendChild(reg);
    }
    frag.appendChild(row);
    if (launch) {
      frag.appendChild(mk('p', 'price-line', fill(t.launchLine)));
      var slots = mk('p', 'price-slots');
      slots.appendChild(mk('i'));
      slots.appendChild(d.createTextNode(fill(t.slots)));
      frag.appendChild(slots);
    } else {
      frag.appendChild(mk('p', 'price-line', t.regularOnly));
    }
    var list = mk('ul', 'facts');
    list.appendChild(fact(fill(t.included)));
    list.appendChild(fact(fill(t.care)));
    frag.appendChild(list);
    var cta = mk('div', 'price-cta');
    var btn = mk('a', 'btn btn-primary btn-lg', t.button);
    btn.href = '#kontakt';
    cta.appendChild(btn);
    cta.appendChild(mk('p', 'price-fine', t.fine));
    frag.appendChild(cta);
    el.textContent = '';
    el.appendChild(frag);
  }
  d.querySelectorAll('[data-offer]').forEach(renderOffer);

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

  /* ---------- contact (assembled at runtime from split strings, so address harvesters that read the raw HTML find nothing) ---------- */
  var box = d.querySelector('[data-contact]');
  if (box) {
    var user = ['in', 'fo'].join('');
    var host = ['bartolucci-digital', 'de'].join('.');
    var mail = user + '@' + host;
    var tel = ['0170', '7240', '195'];
    var telDisplay = tel.join(' ');
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
      a.appendChild(mk('span', null, label));
      a.appendChild(mk('span', 'small', hint));
      return a;
    };
    box.appendChild(line('mailto:' + mail, mail, 'M3 6h18v12H3zM3 6l9 7 9-7', 'E-Mail'));
    box.appendChild(line(telHref, telDisplay, 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z', 'Telefon'));
  }

  /* ---------- year ---------- */
  var y = d.querySelector('[data-year]');
  if (y) y.textContent = String(new Date().getFullYear());
})();
