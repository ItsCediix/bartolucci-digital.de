/* The six phone scenes (v10), ported from the Remotion demo v9 (demo/v9/src/scenes/*.tsx) to GSAP.
   Shared by both bodies: desktop scrubs one timeline per chapter (desktop.js), mobile plays each once
   (mobile.js). Every builder adds its beats to a timeline from a start time and returns the start times
   of its beats, so the left column can reveal its copy exactly when a beat starts on the right.
   The CSS (scenes.css) holds each scene's END state; the builders animate from the start states.
   Easing mapping (Remotion -> GSAP), see REPORT.md:
     brand  cubic-bezier(0.2, 0.8, 0.2, 1)  pops, fades, cards  (≈ power3.out, used exactly)
     soft   cubic-bezier(0.45, 0, 0.2, 1)   moves from rest: rises, scrolls, zoom, swipes (≈ power2.inOut, used exactly)
     spring stiffness 60, damping 11.6       hook bubbles, zeta 0.75, 2.9 % overshoot (≈ back.out(0.9), used exactly)
     sine   0.5 - 0.5 cos(pi u)              hook swipe (= sine.inOut) */
(function () {
  'use strict';
  var d = document;

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
  var HOLD = 0.9; // pause between two beats: the reader catches up with the copy on the left

  /* ------------------------------------------------------------ stage fitting (540 × 960 -> screen) */
  function fit(container) {
    var screen = container.querySelector('.device-screen');
    var stage = container.querySelector('.stage');
    if (!screen || !stage) return;
    var apply = function () {
      var w = screen.clientWidth, h = screen.clientHeight;
      if (!w || !h) return;
      var k = Math.min(w / 540, h / 960);
      stage.style.transform = 'translate(' + ((w - 540 * k) / 2) + 'px,' + ((h - 960 * k) / 2) + 'px) scale(' + k + ')';
    };
    apply();
    if (window.ResizeObserver) new ResizeObserver(apply).observe(screen);
    else addEventListener('resize', apply);
  }

  /* ------------------------------------------------------------ dynamic content (today, waveform, URL) */
  var DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  function prepare(sc) {
    var id = sc.getAttribute('data-scene');
    if (id === 'website') {
      var idx = (new Date().getDay() + 6) % 7;
      var rows = qa(sc, '.d-hours li');
      var badge = q(sc, '.d-today');
      if (rows[idx] && badge) {
        badge.textContent = 'HEUTE · ' + DAYS[idx];
        badge.setAttribute('data-day', rows[idx].lastElementChild.textContent);
        badge.style.top = rows[idx].offsetTop + 'px';
        sc._todayShift = rows[idx].offsetTop - rows[0].offsetTop;
      }
      var open = q(sc, '[data-open-today]');
      if (open) open.textContent = idx === 6 ? 'Heute geschlossen' : 'Heute geöffnet bis ' + (idx === 5 ? '14' : '18') + ' Uhr';
    }
    if (id === 'assistent') {
      // a drawn waveform, no audio: 34 bars like the film's voice note
      var ns = 'http://www.w3.org/2000/svg';
      qa(sc, '.as-bars').forEach(function (g) {
        for (var i = 0; i < 34; i++) {
          var h = 6 + Math.round(26 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.45)));
          var r = d.createElementNS(ns, 'rect');
          r.setAttribute('x', String(i * 7));
          r.setAttribute('y', String(20 - h / 2));
          r.setAttribute('width', '4');
          r.setAttribute('height', String(h));
          r.setAttribute('rx', '2');
          g.appendChild(r);
        }
      });
    }
    if (id === 'hamburg') {
      var url = q(sc, '.hh-url');
      if (url && !url.textContent) url.textContent = 'bartolucci-digital.de';
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
  function finalAll() { /* the CSS already is the final state; nothing to animate */ }

  /* ------------------------------------------------------------ hook: four bubbles, chat push, camera lean */
  var BUBBLE_H = [108, 108, 108, 73];
  var GAP = 17;
  function introInto(tl, sc, at) {
    var b = qa(sc, '.hk-b');
    var cam = q(sc, '.hk-cam');
    var STEP = 0.55;
    // every bubble starts at the stack bottom and is pushed up by each later one (chat push)
    var off = b.map(function (_, i) {
      var s = 0;
      for (var k = i + 1; k < b.length; k++) s += BUBBLE_H[k] + GAP;
      return s;
    });
    b.forEach(function (el, i) { gsap.set(el, {y: off[i]}); });
    b.forEach(function (el, i) {
      var t = at + i * STEP;
      var left = el.classList.contains('hk-l');
      tl.fromTo(el, {x: left ? -560 : 560, rotation: left ? -7 : 7, scale: 0.86, opacity: 0},
        {x: 0, rotation: 0, scale: 1, opacity: 1, duration: SPRING_D, ease: spring, immediateRender: true}, t);
      for (var j = 0; j < i; j++) {
        off[j] -= BUBBLE_H[i] + GAP;
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

  /* ------------------------------------------------------------ chapter change: the swipes of the film */
  var SWAP = 1.0;
  function swap(tl, prev, next, at) {
    var nextIn = q(next, '.scene-in');
    if (prev.getAttribute('data-scene') === 'hook') {
      // the bubble stack swipes up and shrinks into the laptop screen of the next scene
      tl.to(q(prev, '.scene-in'), {y: -330, scale: 0.42, opacity: 0, duration: SWAP, ease: ease.swipe}, at);
      tl.from(nextIn, {opacity: 0, duration: SWAP * 0.6, ease: ease.brand}, at + SWAP * 0.25);
      return;
    }
    // page slides left, the next app comes in from the right (film: swipe up, slide, expand)
    tl.to(prev, {xPercent: -118, scale: 0.92, duration: SWAP, ease: ease.soft}, at);
    tl.from(nextIn, {xPercent: 118, scale: 0.92, duration: SWAP, ease: ease.soft}, at);
  }

  /* ------------------------------------------------------------ beats per chapter */
  var beats = {};

  beats.hook = function (tl, sc, at) { return introInto(tl, sc, at); };

  beats.website = function (tl, sc, at) {
    var b1 = at, b2, b3;
    tl.from(q(sc, '.ws-laptop'), {y: 560, duration: 1.1, ease: ease.soft}, b1)
      .from(q(sc, '.ws-phone'), {y: 620, x: 30, rotation: 5, duration: 1.1, ease: ease.soft}, b1 + 0.18)
      .from(q(sc, '.ws-tag'), {opacity: 0, y: -10, duration: 0.4}, b1 + 0.3)
      .from(qa(sc, '.demo-desk .d-blk'), {opacity: 0, y: 12, duration: 0.4, stagger: 0.08}, b1 + 0.75)
      .from(qa(sc, '.demo-mob .d-blk'), {opacity: 0, y: 12, duration: 0.4, stagger: 0.08}, b1 + 0.9);
    b2 = b1 + 1.4 + HOLD;
    // the phone scrolls to the opening hours, "HEUTE" travels to today's row, the laptop's status line flips
    tl.from(q(sc, '.d-scroll'), {y: 0, duration: 0.9, ease: ease.soft}, b2)
      .from(q(sc, '.d-today'), {y: -(sc._todayShift || 0), duration: 0.7, ease: ease.soft}, b2 + 0.75)
      .fromTo(q(sc, '.d-flip-a'), {rotationX: 0, opacity: 1}, {rotationX: 90, opacity: 0, duration: 0.35, ease: 'power1.in', immediateRender: true}, b2 + 0.8)
      .from(q(sc, '.d-flip-b'), {rotationX: -90, opacity: 0, duration: 0.4, ease: ease.brand}, b2 + 1.1);
    b3 = b2 + 1.5 + HOLD;
    // an inquiry lands, the check mark draws itself
    tl.from(q(sc, '.ws-inquiry'), {y: -140, scale: 0.9, opacity: 0, duration: 0.8, ease: ease.pop}, b3)
      .from(q(sc, '.wi-check circle'), {scale: 0.4, transformOrigin: '50% 50%', opacity: 0, duration: 0.4, ease: ease.pop}, b3 + 0.45)
      .from(q(sc, '.wi-check path'), {strokeDashoffset: 30, duration: 0.45, ease: ease.brand}, b3 + 0.6);
    return [b1, b2, b3];
  };

  beats.assistent = function (tl, sc, at) {
    var b1 = at, b2, b3;
    tl.from(q(sc, '.as-head'), {opacity: 0, y: 14, duration: 0.4}, b1 + 0.2)
      .from(qa(sc, '.as-card'), {x: -70, opacity: 0, duration: 0.6, stagger: 0.2}, b1 + 0.6);
    b2 = b1 + 1.4 + HOLD;
    tl.from(q(sc, '.as-voice'), {y: 30, opacity: 0, scale: 0.96, duration: 0.5, ease: ease.pop}, b2)
      .from(qa(sc, '.as-bars-on rect'), {scaleY: 0.25, transformOrigin: '50% 50%', duration: 0.3, stagger: 0.025, ease: ease.brand}, b2 + 0.4)
      .from(q(sc, '.as-bars-on'), {clipPath: 'inset(0px 100% 0px 0px)', duration: 0.95, ease: 'none'}, b2 + 0.4);
    b3 = b2 + 1.4 + HOLD;
    tl.from(q(sc, '.as-sheet'), {yPercent: 104, duration: 0.9, ease: ease.soft}, b3)
      .from(q(sc, '.sw-flip i'), {x: -20, duration: 0.35, ease: ease.brand}, b3 + 1.0)
      .from(q(sc, '.sw-flip .sw-on'), {opacity: 0, duration: 0.3}, b3 + 1.0);
    return [b1, b2, b3];
  };

  beats.automatisierung = function (tl, sc, at) {
    var b1 = at, b2, b3;
    var canvas = q(sc, '.au-canvas');
    var inBox = q(sc, '.au-in');
    var others = qa(sc, '.au-box:not(.au-in), .au-lines');
    tl.from(q(sc, '.au-title'), {opacity: 0, y: -12, duration: 0.4}, b1 + 0.1)
      .from(qa(sc, '.au-box'), {scale: 0.6, opacity: 0, duration: 0.5, stagger: 0.12, ease: ease.pop}, b1 + 0.3)
      .from(qa(sc, '.au-lines path'), {strokeDashoffset: 260, duration: 0.7, stagger: 0.12, ease: ease.soft}, b1 + 0.8);
    b2 = b1 + 1.6 + HOLD;
    // camera dives into "Geschäfts-Mail": the canvas layer scales up around the box, the box opens to its six steps
    tl.to(canvas, {scale: 2.4, x: 18, y: -449, duration: 1.1, ease: ease.soft}, b2)
      .to(inBox, {clipPath: 'inset(0px 0px 0px 0px round 16px)', duration: 1.1, ease: ease.soft}, b2)
      .to(others, {opacity: 0.12, duration: 0.6}, b2)
      .to(q(sc, '.au-title'), {opacity: 0, duration: 0.4}, b2)
      .from(qa(sc, '.au-steps li'), {opacity: 0.15, x: -6, duration: 0.3, stagger: 0.22, ease: ease.brand}, b2 + 0.9);
    b3 = b2 + 2.3 + HOLD;
    // back out, the switch comes up and flips, the result box pulses once
    tl.to(canvas, {scale: 1, x: 0, y: 0, duration: 0.9, ease: ease.soft}, b3)
      .to(inBox, {clipPath: 'inset(0px 0px 190px 0px round 16px)', duration: 0.9, ease: ease.soft}, b3)
      .to(others, {opacity: 1, duration: 0.5}, b3 + 0.3)
      .to(q(sc, '.au-title'), {opacity: 1, duration: 0.4}, b3 + 0.4)
      .from(q(sc, '.au-switch'), {y: 260, opacity: 0, duration: 0.7, ease: ease.soft}, b3 + 0.5)
      .from(q(sc, '.au-sw i'), {x: -26, duration: 0.35, ease: ease.brand}, b3 + 1.25)
      .from(q(sc, '.au-sw .sw-on'), {opacity: 0, duration: 0.3}, b3 + 1.25)
      .fromTo(q(sc, '.au-out'), {scale: 1}, {scale: 1.08, duration: 0.25, ease: 'power2.out', immediateRender: false}, b3 + 1.5)
      .to(q(sc, '.au-out'), {scale: 1, duration: 0.35, ease: 'power2.inOut'}, b3 + 1.75);
    return [b1, b2, b3];
  };

  beats.postfach = function (tl, sc, at) {
    var b1 = at, b2, b3;
    // the app chrome travels in with the swipe; the three mails drop in
    tl.from(qa(sc, '.pf-mail'), {y: 30, opacity: 0, duration: 0.45, stagger: 0.14}, b1);
    b2 = b1 + 1.1 + HOLD;
    // the top mail opens into the personal summary, its blocks fill in one after the other
    tl.from(q(sc, '.pf-open'), {opacity: 0, duration: 0.01}, b2)
      .from(q(sc, '.pf-open'), {clipPath: 'inset(0px 0px 86% 0px)', duration: 0.8, ease: ease.soft}, b2)
      .from(qa(sc, '.pf-o-sub, .pf-o-from'), {opacity: 0, y: 10, duration: 0.35, stagger: 0.1}, b2 + 0.4)
      .from(qa(sc, '.pf-blk'), {opacity: 0, y: 22, duration: 0.45, stagger: 0.22}, b2 + 0.7);
    b3 = b2 + 1.6 + HOLD;
    tl.from(q(sc, '.pf-note'), {opacity: 0, y: 12, duration: 0.4}, b3)
      .from(q(sc, '.pf-hl'), {scaleX: 0, duration: 0.6, ease: ease.soft}, b3 + 0.35)
      .fromTo(q(sc, '.pf-mark'), {scale: 1}, {scale: 1.06, duration: 0.2, ease: 'power2.out', immediateRender: false}, b3 + 0.85)
      .to(q(sc, '.pf-mark'), {scale: 1, duration: 0.3}, b3 + 1.05);
    return [b1, b2, b3];
  };

  beats.hamburg = function (tl, sc, at) {
    var b1 = at, b2, b3;
    var url = q(sc, '.hh-url');
    var w = url ? url.offsetWidth : 220;
    var n = url ? url.textContent.length : 21;
    tl.from(q(sc, '.hh-city'), {y: 240, duration: 1.2, ease: ease.soft}, b1)
      .from(q(sc, '.hh-water'), {y: 120, duration: 1.0, ease: ease.soft}, b1 + 0.1)
      .fromTo(q(sc, '.hh-ship'), {x: 440}, {x: -40, duration: 5.4, ease: 'none', immediateRender: true}, b1 + 0.4);
    b2 = b1 + 1.2 + HOLD;
    tl.from(q(sc, '.hh-mark'), {y: 140, opacity: 0, scale: 0.94, duration: 0.8, ease: ease.pop}, b2);
    b3 = b2 + 0.8 + HOLD;
    // the address bar drops in and the URL types itself, character by character (film: 3 frames per key)
    tl.from(q(sc, '.hh-bar'), {y: -90, opacity: 0, duration: 0.6, ease: ease.soft}, b3)
      .from(url, {clipPath: 'inset(0px 100% 0px 0px)', duration: n * 0.06, ease: 'steps(' + n + ')'}, b3 + 0.5)
      .from(q(sc, '.hh-caret'), {x: -w, duration: n * 0.06, ease: 'steps(' + n + ')'}, b3 + 0.5)
      .fromTo(q(sc, '.hh-load'), {scaleX: 0, opacity: 1}, {scaleX: 1, duration: 0.5, ease: ease.soft, immediateRender: false}, b3 + 0.6 + n * 0.06)
      .to(q(sc, '.hh-load'), {opacity: 0, duration: 0.25}, b3 + 1.1 + n * 0.06);
    return [b1, b2, b3];
  };

  window.BDScenes = {ease: ease, SWAP: SWAP, fit: fit, collect: collect, show: show, finalAll: finalAll, intro: intro, introInto: introInto, swap: swap, beats: beats};
})();
