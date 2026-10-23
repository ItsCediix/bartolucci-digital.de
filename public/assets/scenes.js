/* The three scenes (v11): hook, website, betreuung. Ported in v10 from the Remotion demo to GSAP; in v11
   the phone frame is gone and every scene has its own canvas (data-w × data-h), scaled to fit the stage.
   Shared by both bodies: desktop scrubs one timeline per chapter (desktop.js), mobile plays each once
   (mobile.js). Every beat builder takes the start times of its three beats, so desktop can place them at
   fixed shares of the chapter's scroll and the left column reveals its copy at exactly those times.
   The CSS (scenes.css) holds each scene's END state; the builders animate from the start states.
   Easing mapping (Remotion -> GSAP), see REPORT.md:
     brand  cubic-bezier(0.2, 0.8, 0.2, 1)  pops, fades, cards  (≈ power3.out, used exactly)
     soft   cubic-bezier(0.45, 0, 0.2, 1)   moves from rest: rises, scrolls, drifts (≈ power2.inOut, used exactly)
     spring stiffness 60, damping 11.6       chat bubbles, zeta 0.75, 2.9 % overshoot (≈ back.out(0.9), used exactly)
     sine   0.5 - 0.5 cos(pi u)              hook -> laptop swipe (= sine.inOut) */
(function () {
  'use strict';

  function bezier(x1, y1, x2, y2) {
    var B = function (a1, a2, t) { return 3 * a1 * t * (1 - t) * (1 - t) + 3 * a2 * t * t * (1 - t) + t * t * t; };
    var D = function (a1, a2, t) { return 3 * a1 * (1 - t) * (1 - t) + 6 * (a2 - a1) * t * (1 - t) + 3 * (1 - a2) * t * t; };
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 8; i++) {
        var dv = D(x1, x2, t);
        if (Math.abs(dv) < 1e-6) break;
        t -= (B(x1, x2, t) - x) / dv;
      }
      if (!(t >= 0 && t <= 1) || Math.abs(B(x1, x2, t) - x) > 1e-5) {
        var lo = 0, hi = 1;
        for (var k = 0; k < 40; k++) { t = (lo + hi) / 2; if (B(x1, x2, t) < x) lo = t; else hi = t; }
      }
      return B(y1, y2, t);
    };
  }
  // damped spring as an ease over SPRING_D seconds (Remotion spring {stiffness 60, damping 11.6, mass 1})
  var SPRING_D = 1.1;
  function spring(p) {
    if (p >= 1) return 1;
    var w = Math.sqrt(60), z = 11.6 / (2 * Math.sqrt(60)), wd = w * Math.sqrt(1 - z * z), t = p * SPRING_D;
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
  }
  var ease = {brand: bezier(0.2, 0.8, 0.2, 1), soft: bezier(0.45, 0, 0.2, 1), spring: spring, swipe: 'sine.inOut', pop: 'back.out(1.2)'};

  var q = function (el, sel) { return el.querySelector(sel); };
  var qa = function (el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); };

  /* ------------------------------------------------------------ fitting: each scene canvas -> stage, centred */
  function fit(stage) {
    var scenes = qa(stage, '.scene');
    var apply = function () {
      var w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      scenes.forEach(function (sc) {
        var W = +sc.getAttribute('data-w'), H = +sc.getAttribute('data-h');
        var k = Math.min(w / W, h / H);
        var box = q(sc, '.scene-fit');
        box.style.width = W + 'px';
        box.style.height = H + 'px';
        box.style.transform = 'translate(' + ((w - W * k) / 2) + 'px,' + ((h - H * k) / 2) + 'px) scale(' + k + ')';
      });
    };
    apply();
    if (window.ResizeObserver) new ResizeObserver(apply).observe(stage);
    else addEventListener('resize', apply);
  }

  /* ------------------------------------------------------------ dynamic content (today) */
  var DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  function prepare(sc) {
    var id = sc.getAttribute('data-scene');
    var idx = (new Date().getDay() + 6) % 7;
    if (id === 'website') {
      var rows = qa(sc, '.d-hours li');
      var badge = q(sc, '.d-today');
      if (rows[idx] && badge) {
        badge.textContent = 'HEUTE · ' + DAYS[idx].slice(0, 2).toUpperCase();
        badge.setAttribute('data-day', rows[idx].lastElementChild.textContent);
        badge.style.top = rows[idx].offsetTop + 'px';
        sc._todayShift = rows[idx].offsetTop - rows[0].offsetTop;
      }
      var open = q(sc, '[data-open-today]');
      if (open) open.textContent = idx === 6 ? 'Heute geschlossen' : 'Heute geöffnet bis ' + (idx === 5 ? '14' : '18') + ' Uhr';
    }
    if (id === 'betreuung') {
      // the Monday row carries "HEUTE" only on a Monday; on every other day the rows stay plain
      var mon = q(sc, '.bt-mon');
      if (mon) mon.classList.toggle('is-today', idx === 0);
    }
  }

  function collect(stage) {
    var map = {};
    qa(stage, '.scene').forEach(function (sc) {
      map[sc.getAttribute('data-scene')] = sc;
      prepare(sc);
    });
    return map;
  }
  function show(scenes, id) {
    Object.keys(scenes).forEach(function (k) { scenes[k].classList.toggle('is-hidden', k !== id); });
  }

  /* ------------------------------------------------------------ hook: four bubbles, chat push, camera lean */
  var GAP = 18;
  function introInto(tl, sc, at) {
    var b = qa(sc, '.hk-b');
    var cam = q(sc, '.hk-cam');
    var STEP = 0.55;
    var hgt = b.map(function (el) { return el.offsetHeight || 100; });
    // every bubble starts at the stack bottom and is pushed up by each later one (chat push)
    var off = b.map(function (_, i) {
      var s = 0;
      for (var k = i + 1; k < b.length; k++) s += hgt[k] + GAP;
      return s;
    });
    b.forEach(function (el, i) { gsap.set(el, {y: off[i]}); });
    b.forEach(function (el, i) {
      var t = at + i * STEP;
      var left = el.classList.contains('hk-l');
      tl.fromTo(el, {x: left ? -240 : 240, rotation: left ? -6 : 6, scale: 0.86, opacity: 0},
        {x: 0, rotation: 0, scale: 1, opacity: 1, duration: SPRING_D, ease: spring, immediateRender: true}, t);
      for (var j = 0; j < i; j++) {
        off[j] -= hgt[i] + GAP;
        tl.to(b[j], {y: off[j], duration: SPRING_D, ease: spring}, t);
      }
      tl.to(cam, {x: left ? 10 : -10, duration: 0.6, ease: ease.soft}, t);
    });
    tl.to(cam, {x: 0, duration: 0.6, ease: ease.soft}, at + (b.length - 1) * STEP + 0.6);
    return [at, at + STEP, at + 2 * STEP, at + 3 * STEP];
  }
  function intro(sc) {
    var tl = gsap.timeline({delay: 0.2});
    introInto(tl, sc, 0);
    return tl;
  }

  /* ------------------------------------------------------------ chapter change without a frame
     The outgoing scene drifts up 6 % and fades out, the incoming one rises from +6 % and fades in.
     Outgoing animates the outer .scene, incoming its .scene-in, so two chapter timelines never fight over
     one element. Exception: hook -> website keeps the v10 idea, the bubbles move up into the laptop. */
  var SWAP = 1.4;
  function swap(tl, prev, next, at) {
    var nextIn = q(next, '.scene-in');
    if (prev.getAttribute('data-scene') === 'hook') {
      tl.to(q(prev, '.scene-in'), {y: -330, scale: 0.42, opacity: 0, duration: SWAP * 0.75, ease: ease.swipe}, at);
      tl.fromTo(nextIn, {opacity: 0}, {opacity: 1, duration: SWAP * 0.6, ease: ease.brand, immediateRender: true}, at + SWAP * 0.25);
      return;
    }
    tl.to(prev, {yPercent: -6, opacity: 0, duration: SWAP * 0.7, ease: ease.soft}, at);
    tl.fromTo(nextIn, {yPercent: 6, opacity: 0}, {yPercent: 0, opacity: 1, duration: SWAP * 0.75, ease: ease.soft, immediateRender: true}, at + SWAP * 0.25);
  }

  /* ------------------------------------------------------------ beats per chapter (T = start times of beat 1..3) */
  var beats = {};

  beats.website = function (tl, sc, T) {
    var b1 = T[0], b2 = T[1], b3 = T[2];
    tl.from(q(sc, '.ws-laptop'), {y: 480, duration: 1.1, ease: ease.soft}, b1)
      .from(q(sc, '.ws-phone'), {y: 520, x: 30, rotation: 5, duration: 1.1, ease: ease.soft}, b1 + 0.18)
      .from(q(sc, '.ws-tag'), {opacity: 0, y: -10, duration: 0.4}, b1 + 0.3)
      .from(qa(sc, '.demo-desk .d-blk'), {opacity: 0, y: 12, duration: 0.4, stagger: 0.08}, b1 + 0.75)
      .from(qa(sc, '.demo-mob .d-blk'), {opacity: 0, y: 12, duration: 0.4, stagger: 0.08}, b1 + 0.9);
    // the phone scrolls to the opening hours, "HEUTE" travels to today's row, the laptop's status line flips
    tl.from(q(sc, '.d-scroll'), {y: 0, duration: 0.9, ease: ease.soft}, b2)
      .from(q(sc, '.d-today'), {y: -(sc._todayShift || 0), duration: 0.7, ease: ease.soft}, b2 + 0.75)
      .fromTo(q(sc, '.d-flip-a'), {rotationX: 0, opacity: 1}, {rotationX: 90, opacity: 0, duration: 0.35, ease: 'power1.in', immediateRender: true}, b2 + 0.8)
      .from(q(sc, '.d-flip-b'), {rotationX: -90, opacity: 0, duration: 0.4, ease: ease.brand}, b2 + 1.1);
    // an inquiry lands, the check mark draws itself
    tl.from(q(sc, '.ws-inquiry'), {y: -140, scale: 0.9, opacity: 0, duration: 0.8, ease: ease.pop}, b3)
      .from(q(sc, '.wi-check path'), {strokeDashoffset: 34, duration: 0.45, ease: ease.brand}, b3 + 0.5);
    return [b1, b2, b3];
  };

  beats.betreuung = function (tl, sc, T) {
    var b1 = T[0], b2 = T[1], b3 = T[2];
    // 1: the customer asks for a small change
    tl.fromTo(q(sc, '.bt-ask'), {x: -160, rotation: -5, scale: 0.86, opacity: 0},
      {x: 0, rotation: 0, scale: 1, opacity: 1, duration: SPRING_D, ease: spring, immediateRender: true}, b1);
    // 2: 18 Uhr fades out, 19 Uhr drops in, the short reply appears
    tl.fromTo(q(sc, '.bt-old'), {opacity: 1, y: 0}, {opacity: 0, y: 8, duration: 0.35, ease: 'power1.in', immediateRender: true}, b2)
      .from(q(sc, '.bt-new'), {opacity: 0, y: -16, duration: 0.6, ease: ease.pop}, b2 + 0.3)
      .fromTo(q(sc, '.bt-done'), {x: 120, scale: 0.86, opacity: 0},
        {x: 0, scale: 1, opacity: 1, duration: SPRING_D, ease: spring, immediateRender: true}, b2 + 0.55);
    // 3: the status strip slides up, the three dots fill one after another
    tl.from(q(sc, '.bt-status'), {y: 70, opacity: 0, duration: 0.7, ease: ease.soft}, b3)
      .from(qa(sc, '.bt-dot b'), {scale: 0, duration: 0.3, stagger: 0.15, ease: ease.pop}, b3 + 0.55);
    return [b1, b2, b3];
  };

  window.BDScenes = {ease: ease, SWAP: SWAP, fit: fit, collect: collect, show: show, intro: intro, introInto: introInto, swap: swap, beats: beats};
})();
