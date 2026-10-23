/* Desktop scroll engine (v11): the sticky, frameless stage on the right shows three live DOM scenes
   (scenes.js). One ScrollTrigger timeline per chapter (scrub 0.6) plays the scene in three beats placed at
   fixed shares of the chapter's scroll; the left column's text for a beat reveals in the same timeline at
   the same moment, so the copy never runs ahead of the picture. After the last chapter the stage hands over
   (fade + scale over the last 10 %) and the page continues single-column. Rail (chapters + sections),
   keyboard, spotlight, magnetic buttons, skyline parallax.
   Runs only when <html data-mode="desktop">. Depends on gsap + ScrollTrigger + Lenis (local files). */
(function () {
  'use strict';
  var d = document;
  var html = d.documentElement;
  if (html.getAttribute('data-mode') !== 'desktop') return;
  var BD = window.BD;
  var S = window.BDScenes;
  if (!BD || !S || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COARSE = matchMedia('(pointer: coarse)').matches;
  var NARROW = innerWidth < 1100;

  var stage = d.getElementById('stage');
  var railLinks = Array.prototype.slice.call(d.querySelectorAll('[data-rail]'));
  var chapters = BD.chapters.map(function (c) { return Object.assign({}, c, {el: d.getElementById('k-' + c.id)}); });
  var last = chapters[chapters.length - 1];

  // chapter heights come from chapters.json (each ≥ 100 vh, room for the beats and the holds)
  chapters.forEach(function (c) { if (!NARROW) c.el.style.minHeight = c.vh + 'vh'; });

  S.fit(stage);
  var scenes = S.collect(stage);

  /* ------------------------------------------------------------ smooth scroll */
  var lenis = null;
  if (!RM && window.Lenis) {
    lenis = new Lenis({lerp: 0.11, smoothWheel: true});
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ------------------------------------------------------------ active item (rail + reduced-motion scene switch) */
  var active = null;
  function setActive(id) {
    if (active === id) return;
    active = id;
    railLinks.forEach(function (a) {
      if (a.getAttribute('data-rail') === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    if (RM && scenes[id]) S.show(scenes, id);
  }
  // the active item is the last one whose top has passed 55 % of the viewport. Picked from the scroll
  // position on every update, so exact boundaries and big jumps (rail click, Home/End) never leave a gap.
  var marks = railLinks.map(function (a) {
    var el = d.getElementById(a.getAttribute('href').slice(1));
    return {id: a.getAttribute('data-rail'), st: el && ScrollTrigger.create({trigger: el, start: 'top 55%'})};
  }).filter(function (m) { return m.st; });
  function pick(self) {
    var y = self && self.scroll ? self.scroll() : (window.scrollY || 0);
    var cur = marks[0];
    marks.forEach(function (m) { if (m.st.start <= y + 1) cur = m; });
    setActive(cur.id);
  }
  ScrollTrigger.create({start: 0, end: 'max', onUpdate: pick, onRefresh: pick});
  pick();

  /* ------------------------------------------------------------ text helpers */
  function splitWords(el) {
    var text = el.textContent;
    el.textContent = '';
    var frag = d.createDocumentFragment();
    // plain inline spans: screen readers and crawlers still read one continuous sentence
    text.split(/\s+/).forEach(function (w, i) {
      if (!w) return;
      if (i) frag.appendChild(d.createTextNode(' '));
      var s = d.createElement('span');
      s.className = 'w';
      s.textContent = w;
      frag.appendChild(s);
    });
    el.appendChild(frag);
    return el.querySelectorAll('.w');
  }
  function wrapLine(el) {
    var wrap = d.createElement('div');
    wrap.className = 'clip';
    var line = d.createElement('div');
    line.className = 'line';
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(line);
    line.appendChild(el);
    return line;
  }
  // adds the reveal of every [data-beat="n"] element of a chapter at the start of beat n
  function addTextBeats(tl, c, beatTimes) {
    var els = c.el.querySelectorAll('[data-beat]');
    Array.prototype.forEach.call(els, function (el) {
      var n = parseInt(el.getAttribute('data-beat'), 10) || 1;
      var at = beatTimes[Math.min(n, beatTimes.length) - 1];
      if (el.matches('h1, h2')) {
        tl.from(splitWords(el), {opacity: 0, y: 18, rotateX: -30, duration: 0.5, stagger: 0.03, ease: S.ease.brand}, at);
      } else if (el.matches('.demo-note')) {
        // the demo caption belongs to the inquiry card: same start, a plain fade (Cederic: it came too early)
        tl.from(el, {opacity: 0, duration: 0.6, ease: 'none'}, at);
      } else if (el.matches('p')) {
        tl.from(wrapLine(el), {yPercent: 110, duration: 0.55, ease: S.ease.brand}, at + 0.12);
      } else if (el.matches('ul')) {
        tl.from(el.children, {opacity: 0, x: -14, duration: 0.4, stagger: 0.08, ease: S.ease.brand}, at + 0.2);
      } else {
        tl.from(el, {opacity: 0, x: -14, duration: 0.45, ease: S.ease.brand}, at + 0.2);
      }
    });
  }

  /* ------------------------------------------------------------ scenes + text, bound to the scroll
     Every chapter timeline is 10 units long, so a time t is t × 10 % of the chapter's scroll. */
  var LEN = 10;
  var BEATS = {website: [0.8, 4.0, 7.3], betreuung: [0.8, 4.0, 7.0]};
  if (RM) {
    S.show(scenes, chapters[0].id);
  } else {
    // hook: the four bubbles spring in on load (nothing to scrub at scroll 0), the hero copy is visible at once (LCP)
    chapters[0].tl = S.intro(scenes.hook);
    chapters.forEach(function (c, i) {
      if (i === 0) return;
      var tl = gsap.timeline({
        defaults: {ease: S.ease.brand},
        scrollTrigger: {trigger: c.el, start: 'top 55%', end: 'bottom bottom', scrub: 0.6},
      });
      S.swap(tl, scenes[chapters[i - 1].id], scenes[c.id], 0);
      var beats = S.beats[c.id](tl, scenes[c.id], BEATS[c.id] || [0.8, 4.0, 7.0]);
      addTextBeats(tl, c, beats);
      if (c === last) {
        // hand-over: over the last 10 % of the chapter the stage fades out and steps back
        tl.to(stage, {opacity: 0, scale: 0.96, duration: 1, ease: S.ease.soft}, LEN - 1);
      }
      tl.set({}, {}, LEN); // hold until the end of the chapter
      c.tl = tl;
      c.beatShares = beats.map(function (t) { return t / LEN; });
    });
  }

  /* ------------------------------------------------------------ rail: click + keyboard */
  function scrollToEl(el) {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, {offset: 0, duration: 1.2});
    else el.scrollIntoView({behavior: RM ? 'auto' : 'smooth', block: 'start'});
  }
  d.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      var id = a.getAttribute('href').slice(1);
      var el = id && d.getElementById(id);
      if (!el) return;
      ev.preventDefault();
      scrollToEl(el);
      if (a.hasAttribute('data-rail')) a.focus({preventScroll: true});
      else history.replaceState(null, '', '#' + id);
    });
  });
  var rail = d.querySelector('.rail');
  if (rail) {
    rail.addEventListener('keydown', function (ev) {
      var i = railLinks.indexOf(d.activeElement);
      if (i < 0) return;
      var n = null;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') n = Math.min(railLinks.length - 1, i + 1);
      if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') n = Math.max(0, i - 1);
      if (ev.key === 'Home') n = 0;
      if (ev.key === 'End') n = railLinks.length - 1;
      if (n === null) return;
      ev.preventDefault();
      railLinks[n].focus({preventScroll: true});
      scrollToEl(d.getElementById(railLinks[n].getAttribute('href').slice(1)));
    });
  }

  /* ------------------------------------------------------------ mouse effects (fine pointer only; no tilt in v11) */
  if (!RM && !COARSE && !NARROW) {
    // 1) hero spotlight revealing a faint grid
    var hook = chapters[0].el;
    hook.addEventListener('mousemove', function (ev) {
      var r = hook.getBoundingClientRect();
      hook.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
      hook.style.setProperty('--my', (ev.clientY - r.top) + 'px');
      hook.classList.add('has-spot');
    });
    hook.addEventListener('mouseleave', function () { hook.classList.remove('has-spot'); });

    // 2) magnetic buttons in the contact and price sections
    d.querySelectorAll('#kontakt .contact-line, #preise .btn').forEach(function (btn) {
      btn.classList.add('magnetic');
      var qx = gsap.quickTo(btn, 'x', {duration: 0.4, ease: 'power3.out'});
      var qy = gsap.quickTo(btn, 'y', {duration: 0.4, ease: 'power3.out'});
      btn.addEventListener('mousemove', function (ev) {
        var r = btn.getBoundingClientRect();
        qx(((ev.clientX - (r.left + r.width / 2)) / r.width) * 14);
        qy(((ev.clientY - (r.top + r.height / 2)) / r.height) * 12);
      });
      btn.addEventListener('mouseleave', function () { qx(0); qy(0); });
    });
  }

  // 3) three-layer skyline parallax behind the contact section (cranes / city / ship), scroll only;
  //    the ship additionally drifts right -> left in a 90 s CSS loop (base.css)
  if (!RM) {
    d.querySelectorAll('.sky-layer').forEach(function (layer) {
      var depth = parseFloat(layer.getAttribute('data-depth') || '0.3');
      gsap.fromTo(layer, {yPercent: 30 * depth + 10}, {
        yPercent: -14 * depth, ease: 'none',
        scrollTrigger: {trigger: '#kontakt', start: 'top bottom', end: 'bottom top', scrub: 0.6},
      });
    });
    var contact = d.getElementById('kontakt');
    if (contact) {
      gsap.from(contact.querySelector('.wrap'), {
        y: 60, opacity: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: {trigger: contact, start: 'top 85%', toggleActions: 'play none none reverse'},
      });
    }
  }

  addEventListener('resize', function () { ScrollTrigger.refresh(); });
  // test hook for the QA screenshots: jump a chapter timeline to an exact progress without scrolling noise
  window.__bdChapters = chapters;
})();
