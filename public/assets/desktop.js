/* Desktop scroll engine (v13: free flow). The page scrolls like a normal page: no pinned copy, no scrubbed
   timelines. Every [data-beat] element of the left column reveals once when it reaches 78 % of the viewport
   (time-based, never replayed, never hidden again); the sections after the story reveal once each.
   The stage on the right stays sticky for the whole story and switches scenes when a chapter's copy reaches
   55 % of the viewport: a time-based crossfade (swap(), 0.9 s), then the scene's three beats play once,
   back to back. Scrolling back up shows the earlier scene in its end state. When "So läuft's" reaches 70 %
   the stage steps back (fade + scale, 0.6 s). Rail (chapters + sections), keyboard, spotlight, magnetic
   buttons, skyline parallax.
   Runs only when <html data-mode="desktop">. Depends on gsap + ScrollTrigger + Lenis (local files). */
(function () {
  'use strict';
  var d = document;
  var html = d.documentElement;
  if (html.getAttribute('data-mode') !== 'desktop') return;
  var BD = window.BD;
  var S = window.BDScenes;
  // without the libraries nothing would ever reveal: drop html.js so the CSS start states no longer apply
  if (!BD || !S || !window.gsap || !window.ScrollTrigger) { html.classList.remove('js'); return; }
  gsap.registerPlugin(ScrollTrigger);

  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COARSE = matchMedia('(pointer: coarse)').matches;
  var NARROW = innerWidth < 1100;

  var stage = d.getElementById('stage');
  var railLinks = Array.prototype.slice.call(d.querySelectorAll('[data-rail]'));
  var chapters = BD.chapters.map(function (c) { return Object.assign({}, c, {el: d.getElementById('k-' + c.id)}); });

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

  /* ------------------------------------------------------------ active rail item */
  var active = null;
  function setActive(id) {
    if (active === id) return;
    active = id;
    railLinks.forEach(function (a) {
      if (a.getAttribute('data-rail') === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
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

  /* ------------------------------------------------------------ play-once reveals (left column + sections)
     Every [data-beat] element starts hidden in CSS (desktop.css, html.js, v12), so each tween starts exactly
     from that state (fromTo / immediateRender: false). once: true kills the trigger after the first play, so
     scrolling back never hides or replays anything. Elements that are already above the start line on load
     (reload mid-page) play at once. */
  var DUR = 0.75, STAGGER = 0.06;
  function onceAt(trigger, tl, start) {
    ScrollTrigger.create({trigger: trigger, start: start || 'top 78%', once: true, toggleActions: 'play none none none', animation: tl});
  }
  function revealCopy(el) {
    var tl = gsap.timeline({paused: true, defaults: {ease: S.ease.brand}});
    if (el.matches('h1, h2')) {
      tl.fromTo(el, {opacity: 0}, {opacity: 1, duration: 0.01, ease: 'none', immediateRender: false}, 0);
      tl.fromTo(splitWords(el), {opacity: 0, y: 18, rotateX: -30}, {opacity: 1, y: 0, rotateX: 0, duration: DUR, stagger: STAGGER}, 0);
    } else if (el.matches('.demo-note')) {
      tl.fromTo(el, {opacity: 0}, {opacity: 1, duration: DUR, ease: 'none', immediateRender: false}, 0);
    } else if (el.matches('p')) {
      tl.fromTo(el, {opacity: 0}, {opacity: 1, duration: 0.01, ease: 'none', immediateRender: false}, 0);
      tl.fromTo(wrapLine(el), {yPercent: 110}, {yPercent: 0, duration: DUR}, 0);
    } else if (el.matches('ul')) {
      tl.fromTo(el.children, {opacity: 0, x: -14}, {opacity: 1, x: 0, duration: 0.6, stagger: STAGGER, immediateRender: false}, 0);
    } else {
      tl.fromTo(el, {opacity: 0, x: -14}, {opacity: 1, x: 0, duration: 0.6, immediateRender: false}, 0);
    }
    onceAt(el, tl);
  }
  // one reveal per section after the story: its blocks rise in together (start state in desktop.css)
  function revealSection(sec, blocks, fromY) {
    if (!sec || !blocks.length) return;
    var tl = gsap.timeline({paused: true});
    tl.fromTo(blocks, {opacity: 0, y: fromY}, {opacity: 1, y: 0, duration: 0.8, stagger: STAGGER, ease: 'power3.out', immediateRender: false}, 0);
    onceAt(sec, tl);
  }
  if (!RM) {
    d.querySelectorAll('.chapter [data-beat]').forEach(revealCopy);
    ['ablauf', 'preise', 'morgens', 'ueber-uns'].forEach(function (id) {
      var sec = d.getElementById(id);
      if (sec) revealSection(sec, Array.prototype.slice.call(sec.querySelectorAll(':scope > .wrap > *')), 40);
    });
    // the contact block keeps its v12 start state (#kontakt > .wrap: opacity 0, 60 px down)
    var contactSec = d.getElementById('kontakt');
    if (contactSec) revealSection(contactSec, [contactSec.querySelector(':scope > .wrap')], 60);
  }

  // "morgens": its small scene plays once when the section reaches 70 % (reduced motion: the CSS end state)
  var morningStage = d.querySelector('[data-morning]');
  if (morningStage) {
    S.fit(morningStage);
    var morningScene = morningStage.querySelector('.scene');
    if (!RM && S.morning) {
      var mtl = gsap.timeline({paused: true, defaults: {ease: S.ease.brand}});
      // the scene layer starts hidden in CSS (scenes.css, html.js) like the story scenes
      mtl.fromTo(morningScene.querySelector('.scene-in'), {opacity: 0}, {opacity: 1, duration: 0.3, ease: 'none', immediateRender: false}, 0);
      S.morning(mtl, morningScene, 0.1);
      onceAt(d.getElementById('morgens'), mtl, 'top 70%');
    }
  }

  /* ------------------------------------------------------------ the sticky stage: scene switch + beats, time-based
     BEATS: start times of beat 1..3 inside a scene's beat timeline, so the three beats play back to back with
     0.4 s between them (beat lengths from scenes.js: website 1.55 / 1.5 / 0.95 s, betreuung 1.1 / 1.65 / 1.15 s). */
  var GAP = 0.4;
  var BEATS = {website: [0, 1.55 + GAP, 1.55 + GAP + 1.5 + GAP], betreuung: [0, 1.1 + GAP, 1.1 + GAP + 1.65 + GAP]};
  var SWAP_SECONDS = 0.9;
  var beatTl = {};
  var current = null; // index of the chapter whose scene is on the stage
  var loaded = false;

  if (RM) {
    stage.classList.add('is-ready'); // from here .is-hidden decides which static scene shows
  } else {
    // hook: the four bubbles spring in on load, the hero copy is visible at once (LCP)
    chapters[0].tl = S.intro(scenes.hook);
    chapters.forEach(function (c, i) {
      if (i === 0) return;
      // built paused now, so the scene sits in its pre-beat state (from() renders at once) behind its hidden layer
      var tl = gsap.timeline({paused: true, defaults: {ease: S.ease.brand}});
      S.beats[c.id](tl, scenes[c.id], BEATS[c.id] || [0, 1.6, 3.2]);
      beatTl[c.id] = tl;
      c.tl = tl;
    });
  }

  function playBeats(id, delay) {
    var tl = beatTl[id];
    if (tl && !tl._played) {
      tl._played = true;
      gsap.delayedCall(delay, function () { tl.play(); });
    }
  }
  function sceneIn(sc) { return sc.querySelector('.scene-in'); }
  // shows chapter i's scene at once (reload mid-page, reduced motion, first pick)
  function showInstant(i) {
    var id = chapters[i].id;
    if (RM) { S.show(scenes, id); return; }
    Object.keys(scenes).forEach(function (k) {
      var sc = scenes[k];
      gsap.killTweensOf([sc, sceneIn(sc)]);
      if (k === id) {
        gsap.set(sc, {yPercent: 0, opacity: 1});
        gsap.set(sceneIn(sc), {y: 0, yPercent: 0, scale: 1, opacity: 1});
      } else {
        gsap.set(sc, {opacity: 0});
      }
    });
    playBeats(id, 0.15);
  }
  // time-based crossfade with the existing swap() (hook -> website: the bubbles fly up into the laptop)
  function switchTo(i) {
    var prev = scenes[chapters[current].id];
    var next = scenes[chapters[i].id];
    gsap.killTweensOf([prev, sceneIn(prev), next, sceneIn(next)]);
    // the incoming scene may have left earlier (outer layer faded, hook layer flown up): reset it first
    gsap.set(next, {yPercent: 0, opacity: 1});
    if (next === scenes.hook) gsap.set(sceneIn(next), {y: 0, scale: 1});
    var tl = gsap.timeline();
    S.swap(tl, prev, next, 0);
    tl.timeScale(tl.duration() / SWAP_SECONDS);
    playBeats(chapters[i].id, SWAP_SECONDS * 0.3);
  }
  // hand-over at the end of the story: the stage steps back when "So läuft's" reaches 70 %
  var handed = false;
  function handover(on, instant) {
    if (handed === on) return;
    handed = on;
    if (RM || instant) gsap.set(stage, {opacity: on ? 0 : 1, scale: on ? 0.96 : 1});
    else gsap.to(stage, {opacity: on ? 0 : 1, scale: on ? 0.96 : 1, duration: 0.6, ease: S.ease.soft, overwrite: true});
  }
  var ablauf = d.getElementById('ablauf');
  var handMark = ablauf && ScrollTrigger.create({trigger: ablauf, start: 'top 70%'});

  // the chapter whose copy has passed 55 % of the viewport last; switches only when it changes
  function sync() {
    if (!chapterMarks) return; // a callback during the creation of the marks below
    var y = window.scrollY || 0;
    if (handMark) handover(y >= handMark.start - 1, !loaded);
    var i = 0;
    chapterMarks.forEach(function (st, k) { if (st.start <= y + 1) i = k; });
    if (i === current) return;
    // before load + a moment, a change means the browser restored a scroll position: no fly-in, jump straight there
    if (current === null || !loaded || RM) showInstant(i);
    else switchTo(i);
    current = i;
  }
  var chapterMarks = chapters.map(function (c, i) {
    return ScrollTrigger.create({trigger: c.el, start: 'top 55%', end: 'bottom 55%', onEnter: sync, onEnterBack: sync, onLeaveBack: sync});
  });
  // safety net for very fast jumps (Home/End, rail): the same check on every scroll update, cheap when unchanged
  ScrollTrigger.create({start: 0, end: 'max', onUpdate: sync, onRefresh: sync});
  sync();
  function markLoaded() { setTimeout(function () { loaded = true; ScrollTrigger.refresh(); sync(); }, 250); }
  if (d.readyState === 'complete') markLoaded();
  else addEventListener('load', markLoaded, {once: true});

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
  }

  addEventListener('resize', function () { ScrollTrigger.refresh(); });
  // test hooks for the QA scripts: chapters (with their paused beat timelines) and the scene now on the stage
  window.__bdChapters = chapters;
  window.__bdStage = function () { return {current: current === null ? null : chapters[current].id, handed: handed}; };
})();
