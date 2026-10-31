/* Desktop scroll engine (v13: free flow, v16: cuts). The page scrolls like a normal page: no pinned copy, no
   scrubbed timelines. Every [data-beat] element of the story copy reveals once when it reaches 70 % of the
   viewport (time-based, never replayed, never hidden again); the sections after the story reveal once each.
   v16: every story chapter is one viewport tall (desktop.css) and, once the scroll has come to rest, a chapter
   start within 25 % of the viewport is settled to (0.45 s, power2.out; never during wheel/touch/drag).
   The stage on the right stays sticky for the whole story and switches scenes when a chapter's top passes
   50 % of the viewport: a cut with motion (v17: old scene sucked out towards the text 0.28 s, then the new one
   flies in 0.38 s, never both visible, a light streak across the stage), then the scene's beats play once.
   Scrolling back up mirrors it and shows the earlier scene in its end state. v17: the story text block on the
   left cuts in the same rhythm (out 0.2 s with the old scene, in 0.4 s with the new one, lines 0.04 s apart).
   When "So läuft's" reaches 70 % the stage steps back (fade + scale, 0.6 s). Rail (chapters + sections),
   keyboard, spotlight, magnetic buttons, skyline parallax.
   Runs only when <html data-mode="desktop">. Depends on gsap + ScrollTrigger + Lenis (local files). */
(function () {
  'use strict';
  var d = document;
  var html = d.documentElement;
  if (html.getAttribute('data-mode') !== 'desktop') return;
  var S = window.BDScenes;
  // without the libraries nothing would ever reveal: drop html.js so the CSS start states no longer apply
  if (!S || !window.gsap || !window.ScrollTrigger) { html.classList.remove('js'); return; }
  gsap.registerPlugin(ScrollTrigger);

  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COARSE = matchMedia('(pointer: coarse)').matches;
  var NARROW = innerWidth < 1100;

  var stage = d.getElementById('stage');
  var railLinks = Array.prototype.slice.call(d.querySelectorAll('[data-rail]'));
  // v18: the chapters come from the static markup (one .chapter section per story scene), not from site-data.js
  var chapters = Array.prototype.slice.call(d.querySelectorAll('.chapter[data-chapter]')).map(function (el) { return {id: el.getAttribute('data-chapter'), el: el}; });

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
     from that state (fromTo / immediateRender: false). Played once (see onceAt), so scrolling back never
     hides or replays anything. Elements that are already above the start line on load
     (reload mid-page) play at once. */
  var DUR = 0.75, STAGGER = 0.06;
  // play-once = toggleActions 'play none none none': the timeline plays on the first enter and is never
  // reversed or restarted (a finished timeline stays finished). No once: true – ScrollTrigger 3.13 throws
  // ("reading 'end'") when such a trigger kills itself during the first refresh after a reload mid-page.
  function onceAt(trigger, tl, start) {
    ScrollTrigger.create({trigger: trigger, start: start || 'top 78%', toggleActions: 'play none none none', animation: tl});
  }
  function revealCopy(el, start) {
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
    onceAt(el, tl, start);
  }
  // one reveal per section after the story: its blocks rise in together (start state in desktop.css)
  function revealSection(sec, blocks, fromY) {
    if (!sec || !blocks.length) return;
    var tl = gsap.timeline({paused: true});
    tl.fromTo(blocks, {opacity: 0, y: fromY}, {opacity: 1, y: 0, duration: 0.8, stagger: STAGGER, ease: 'power3.out', immediateRender: false}, 0);
    onceAt(sec, tl);
  }
  // v17: on the wide layout the story copy no longer trickles in word by word; each chapter's text block cuts in
  // with the stage (textIn / textOut below). The narrow single-column layout keeps the v16 per-element reveals.
  var BLOCK = !RM && !NARROW;
  if (!RM) {
    // v16: 'top 70%' (v13: 78 %), so the copy is in by the time the one-viewport chapter is centred
    if (!BLOCK) d.querySelectorAll('.chapter [data-beat]').forEach(function (el) { revealCopy(el, 'top 70%'); });
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
  // v17: "sucked in, flown in" (v16: 0.12 s out + 0.18 s in). Out: 1 -> 0.62, 38 % towards the text, power3.in;
  // in: from 0.62 / 38 % on the other side, back.out(1.25). Never both visible: the new scene starts after the old is gone.
  var CUT_OUT = 0.28, CUT_IN = 0.38, CUT_SCALE = 0.62, CUT_X = 38;
  var TEXT_OUT = 0.2, TEXT_IN = 0.4, TEXT_STAGGER = 0.04;
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

  /* v17: the text block on the left cuts with the stage. Lines = the chapter's [data-beat] elements in document
     order (a ul[data-beat] counts as its items): headline, paragraphs, facts, note. */
  chapters.forEach(function (c) {
    c.block = c.el && c.el.querySelector('.copy');
    c.lines = [];
    if (c.block) c.block.querySelectorAll('[data-beat]').forEach(function (el) {
      if (el.matches('ul')) c.lines.push.apply(c.lines, el.children);
      else c.lines.push(el);
    });
  });
  function textSet(i, on) {
    var c = chapters[i];
    if (!BLOCK || !c.block) return;
    gsap.killTweensOf([c.block].concat(c.lines));
    gsap.set(c.block, {opacity: on ? 1 : 0, x: 0, y: 0});
    if (c.lines.length) gsap.set(c.lines, {opacity: on ? 1 : 0, x: 0});
  }
  function textOut(i) {
    var c = chapters[i];
    if (!BLOCK || !c.block) return;
    gsap.killTweensOf([c.block].concat(c.lines));
    gsap.to(c.block, {opacity: 0, y: -16, duration: TEXT_OUT, ease: 'power2.in'});
  }
  function textIn(i, delay) {
    var c = chapters[i];
    if (!BLOCK || !c.block) return;
    gsap.killTweensOf([c.block].concat(c.lines));
    gsap.fromTo(c.block, {opacity: 0, x: -24, y: 0}, {opacity: 1, x: 0, duration: TEXT_IN, ease: 'power3.out', delay: delay});
    if (c.lines.length) gsap.fromTo(c.lines, {opacity: 0}, {opacity: 1, x: 0, duration: TEXT_IN, ease: 'power3.out', stagger: TEXT_STAGGER, delay: delay});
  }

  // shows chapter i's scene (and its text block) at once (reload mid-page, reduced motion, first pick)
  function showInstant(i) {
    var id = chapters[i].id;
    if (RM) { S.show(scenes, id); return; }
    Object.keys(scenes).forEach(function (k) {
      var sc = scenes[k];
      gsap.killTweensOf([sc, sceneIn(sc)]);
      if (k === id) {
        gsap.set(sc, {yPercent: 0, xPercent: 0, scale: 1, opacity: 1});
        gsap.set(sceneIn(sc), {y: 0, yPercent: 0, scale: 1, opacity: 1});
      } else {
        gsap.set(sc, {opacity: 0});
      }
    });
    // the hook copy is never hidden on load (LCP); story blocks: only the active one shows
    chapters.forEach(function (c, k) { if (k) textSet(k, k === i); });
    playBeats(id, 0.15);
  }
  // reduced motion: a plain 0.2 s fade, no movement, no sweep
  function fadeTo(i) {
    var next = scenes[chapters[i].id];
    S.show(scenes, chapters[i].id);
    gsap.fromTo(next, {opacity: 0}, {opacity: 1, duration: 0.2, ease: 'none', overwrite: true});
  }
  // the light sweep: a CSS animation on #stage::after (desktop.css), restarted by alternating two keyframe names
  var sweepRun = 0;
  function sweep(back) {
    stage.setAttribute('data-sweep', (sweepRun++ % 2) ? 'b' : 'a');
    stage.classList.toggle('is-back', back);
  }
  // v17: "sucked in, flown in". The old scene shrinks to 0.62 and is pulled 38 % of the stage width towards the
  // text while fading (0.28 s, power3.in); only then the new one flies in from 0.62 / 38 % on the other side
  // (0.38 s, back.out(1.25)), so no frame ever shows both. Scrolling up mirrors it. A light streak crosses the stage
  // meanwhile. The new scene arrives as a finished picture: a scene seen before at its end state; a first visit
  // with beat 1 (the build-up) complete, then the remaining beats play once after it has settled (v16 rule).
  function switchTo(i) {
    var id = chapters[i].id;
    var from = current;
    var prev = scenes[chapters[from].id];
    var next = scenes[id];
    var dir = i > from ? 1 : -1; // down: out to the left, in from the right
    Object.keys(scenes).forEach(function (k) {
      var sc = scenes[k];
      gsap.killTweensOf([sc, sceneIn(sc)]);
      // a third scene still leaving after a very fast double switch is cut off at once
      if (sc !== prev && sc !== next) gsap.set(sc, {opacity: 0});
    });
    var tl = chapters[i].tl;
    if (tl && !tl._played && BEATS[id]) tl.seek(BEATS[id][1], false);
    else if (tl && tl.progress() < 1) tl.progress(1);
    gsap.set(next, {yPercent: 0, xPercent: CUT_X * dir, scale: CUT_SCALE, opacity: 0, transformOrigin: '50% 50%'});
    gsap.set(sceneIn(next), {y: 0, yPercent: 0, opacity: 1, scale: 1});
    gsap.to(prev, {opacity: 0, scale: CUT_SCALE, xPercent: -CUT_X * dir, duration: CUT_OUT, ease: 'power3.in', transformOrigin: '50% 50%'});
    gsap.to(next, {opacity: 1, scale: 1, xPercent: 0, duration: CUT_IN, ease: 'back.out(1.25)', delay: CUT_OUT,
      // back.out overshoots past 1; opacity is clamped, only scale and position settle
      modifiers: {opacity: function (o) { return Math.min(1, Math.max(0, o)); }}});
    sweep(dir < 0);
    textOut(from);
    textIn(i, CUT_OUT);
    playBeats(id, CUT_OUT + CUT_IN);
  }
  // hand-over at the end of the story: the stage steps back when "So läuft's" reaches 70 %
  // v19: the "Beispielprojekt" label on the stage frame steps back with the stage
  var stageFade = [stage].concat(Array.prototype.slice.call(d.querySelectorAll('[data-stage-badge]')));
  var handed = false;
  function handover(on, instant) {
    if (handed === on) return;
    handed = on;
    if (RM || instant) gsap.set(stageFade, {opacity: on ? 0 : 1, scale: on ? 0.96 : 1});
    else gsap.to(stageFade, {opacity: on ? 0 : 1, scale: on ? 0.96 : 1, duration: 0.6, ease: S.ease.soft, overwrite: true});
  }
  var ablauf = d.getElementById('ablauf');
  var handMark = ablauf && ScrollTrigger.create({trigger: ablauf, start: 'top 70%'});

  // the chapter whose top has passed 50 % of the viewport last (v13: 55 %); switches only when it changes
  function sync() {
    if (!chapterMarks) return; // a callback during the creation of the marks below
    var y = window.scrollY || 0;
    if (handMark) handover(y >= handMark.start - 1, !loaded);
    var i = 0;
    chapterMarks.forEach(function (st, k) { if (st.start <= y + 1) i = k; });
    if (i === current) return;
    // before load + a moment, a change means the browser restored a scroll position: no fly-in, jump straight there
    if (current === null || !loaded) showInstant(i);
    else if (RM) fadeTo(i);
    else switchTo(i);
    current = i;
  }
  var chapterMarks = chapters.map(function (c, i) {
    return ScrollTrigger.create({trigger: c.el, start: 'top 50%', end: 'bottom 50%', onEnter: sync, onEnterBack: sync, onLeaveBack: sync});
  });
  // safety net for very fast jumps (Home/End, rail): the same check on every scroll update, cheap when unchanged
  ScrollTrigger.create({start: 0, end: 'max', onUpdate: sync, onRefresh: sync});
  sync();
  function markLoaded() { setTimeout(function () { loaded = true; ScrollTrigger.refresh(); sync(); }, 250); }
  if (d.readyState === 'complete') markLoaded();
  else addEventListener('load', markLoaded, {once: true});

  /* ------------------------------------------------------------ v16: soft settle on the story chapters
     CSS scroll-snap does not work here: the scroll container is the root, and Lenis drives it (snap and Lenis
     fight). So a JS settle: once the scroll has been at rest for 160 ms and no wheel/touch/key/drag input came
     in for 220 ms, a story chapter start within 25 % of the viewport is eased to (0.45 s, power2.out). Proximity
     only, only the three story chapters, off with reduced motion and in the narrow layout. A new wheel or touch
     interrupts the settle (Lenis gives the scroll back to the user). */
  var SETTLE = !RM && !NARROW && lenis;
  if (SETTLE) {
    var lastInput = 0, holding = false, settleTimer = 0, settling = false;
    var touch = function () { lastInput = performance.now(); settling = false; };
    ['wheel', 'touchstart', 'touchmove', 'keydown'].forEach(function (t) { addEventListener(t, touch, {passive: true}); });
    addEventListener('pointerdown', function () { holding = true; touch(); }, {passive: true});
    addEventListener('pointerup', function () { holding = false; touch(); }, {passive: true});
    var chapterTop = function (c) {
      var y = c.el.getBoundingClientRect().top + (window.scrollY || 0);
      return y <= 120 ? 0 : Math.round(y); // the hook (right below the header) settles to the page top
    };
    var settle = function () {
      settleTimer = 0;
      if (settling || holding || handed) return;
      var quiet = performance.now() - lastInput;
      if (quiet < 220) { settleTimer = setTimeout(settle, 220 - quiet + 10); return; }
      var y = window.scrollY || 0, vh = innerHeight, best = null;
      chapters.forEach(function (c) {
        var t = chapterTop(c);
        if (Math.abs(t - y) <= vh * 0.25 && (best === null || Math.abs(t - y) < Math.abs(best - y))) best = t;
      });
      if (best === null || Math.abs(best - y) < 2) return;
      settling = true;
      lenis.scrollTo(best, {duration: 0.45, easing: function (p) { return 1 - (1 - p) * (1 - p); }, onComplete: function () { settling = false; }});
    };
    lenis.on('scroll', function () {
      if (settling) return;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 160);
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
      // v19: the header nav goes through Lenis like the rail (ScrollTrigger stays in sync) and adds a history entry,
      // so the back button returns to the previous section
      if (a.hasAttribute('data-nav') && location.hash !== '#' + id) history.pushState(null, '', '#' + id);
      scrollToEl(el);
      if (a.hasAttribute('data-rail')) a.focus({preventScroll: true});
      else if (!a.hasAttribute('data-nav')) history.replaceState(null, '', '#' + id);
    });
  });
  // v19: back / forward between jump targets (or to the top when the entry has no hash)
  addEventListener('popstate', function () {
    var el = location.hash && d.getElementById(location.hash.slice(1));
    if (el) scrollToEl(el);
    else if (lenis) lenis.scrollTo(0, {duration: 1.2});
    else window.scrollTo({top: 0, behavior: RM ? 'auto' : 'smooth'});
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
  //    the ship additionally drifts right -> left in a 90 s CSS loop (base.css). The layers come up from below and
  //    reach their drawn position (0) exactly when #kontakt is fully in view, i.e. at the end of the page, so
  //    the skyline never ends shifted against the water line
  if (!RM) {
    d.querySelectorAll('.sky-layer').forEach(function (layer) {
      var depth = parseFloat(layer.getAttribute('data-depth') || '0.3');
      gsap.fromTo(layer, {yPercent: 40 * depth}, {
        yPercent: 0, ease: 'none',
        scrollTrigger: {trigger: '#kontakt', start: 'top bottom', end: 'bottom bottom', scrub: 0.6},
      });
    });
  }

  addEventListener('resize', function () { ScrollTrigger.refresh(); });
  // test hooks for the QA scripts: chapters (with their paused beat timelines) and the scene now on the stage
  window.__bdChapters = chapters;
  window.__bdStage = function () { return {current: current === null ? null : chapters[current].id, handed: handed}; };
})();
