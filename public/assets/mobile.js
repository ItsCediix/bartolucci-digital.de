/* Mobile body (v11): every chapter card carries its own small frameless stage with the chapter's DOM scene.
   The scene plays its beats once (~2.5 s) when the card is half visible and then holds its end state; no
   scroll scrubbing, no video. Header state, sticky CTA, anchors. Runs only when <html data-mode="mobile">. */
(function () {
  'use strict';
  var d = document;
  var html = d.documentElement;
  if (html.getAttribute('data-mode') !== 'mobile') return;
  var S = window.BDScenes;
  // without the libraries nothing would ever reveal: drop html.js so the CSS start states no longer apply
  if (!S || !window.gsap || !window.ScrollTrigger) { html.classList.remove('js'); return; }
  gsap.registerPlugin(ScrollTrigger);

  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var header = d.querySelector('[data-header]');
  var cta = d.querySelector('.m-cta');

  var lenis = null;
  if (!RM && window.Lenis) {
    lenis = new Lenis({lerp: 0.12, smoothWheel: true, syncTouch: false});
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- scenes: one timeline per card, played once on entry ---------- */
  var PLAY_SECONDS = 2.5;
  var BEATS = {website: [0, 1.5, 3.1], betreuung: [0, 1.2, 2.6]};
  d.querySelectorAll('.m-card').forEach(function (card) {
    var id = card.getAttribute('data-chapter');
    var device = card.querySelector('.m-stage');
    if (!device) return;
    var stage = device.querySelector('.stage');
    // v19 (C2): the demo card's visual carries the "Beispielprojekt" label (scenes.css). Only the scene stays
    // aria-hidden, so the label is read like on desktop.
    if (id === 'website') {
      var badge = d.createElement('p');
      badge.className = 'stage-badge';
      badge.textContent = 'Beispielprojekt';
      device.removeAttribute('aria-hidden');
      stage.setAttribute('aria-hidden', 'true');
      device.appendChild(badge);
    }
    S.fit(stage);
    var scenes = S.collect(stage);
    var scene = scenes[id];
    if (RM) return; // the CSS already is the final state
    var tl = gsap.timeline({paused: true, defaults: {ease: S.ease.brand}});
    if (id === 'hook') S.introInto(tl, scene, 0);
    else {
      // the scene layer starts hidden in CSS (scenes.css, html.js) and fades in with the first beat
      tl.fromTo(scene.querySelector('.scene-in'), {opacity: 0}, {opacity: 1, duration: 0.4, ease: 'none', immediateRender: false}, 0);
      S.beats[id](tl, scene, BEATS[id]);
    }
    tl.timeScale(tl.duration() / PLAY_SECONDS);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio >= 0.45) {
          tl.play();
          io.disconnect();
        }
      });
    }, {threshold: [0, 0.45, 1]});
    io.observe(device);
  });

  /* ---------- "morgens" (v13): the small scene plays once when half visible, like the cards above ---------- */
  var morningStage = d.querySelector('[data-morning]');
  if (morningStage) {
    S.fit(morningStage);
    if (!RM && S.morning) {
      var msc = morningStage.querySelector('.scene');
      var mtl = gsap.timeline({paused: true, defaults: {ease: S.ease.brand}});
      mtl.fromTo(msc.querySelector('.scene-in'), {opacity: 0}, {opacity: 1, duration: 0.3, ease: 'none', immediateRender: false}, 0);
      S.morning(mtl, msc, 0.1);
      var mio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && e.intersectionRatio >= 0.45) { mtl.play(); mio.disconnect(); }
        });
      }, {threshold: [0, 0.45, 1]});
      mio.observe(morningStage);
    }
  }

  /* ---------- header + CTA state ---------- */
  var onScroll = function () { header.classList.toggle('is-past', (window.scrollY || 0) > 40); };
  addEventListener('scroll', onScroll, {passive: true});
  if (lenis) lenis.on('scroll', onScroll);
  onScroll();
  var contact = d.getElementById('kontakt');
  if (contact && cta) {
    ScrollTrigger.create({
      trigger: contact,
      start: 'top 70%',
      end: 'bottom 30%',
      onToggle: function (st) { cta.classList.toggle('is-hidden', st.isActive); },
    });
  }

  /* ---------- anchors ---------- */
  function scrollToEl(el) {
    if (lenis) lenis.scrollTo(el, {offset: 0, duration: 1});
    else el.scrollIntoView({behavior: RM ? 'auto' : 'smooth', block: 'start'});
  }
  d.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      var id = a.getAttribute('href').slice(1);
      var el = id && d.getElementById(id);
      if (!el) return;
      ev.preventDefault();
      // v19: the menu links add a history entry, so the back button returns to the previous section
      if (a.hasAttribute('data-nav') && location.hash !== '#' + id) history.pushState(null, '', '#' + id);
      scrollToEl(el);
    });
  });
  addEventListener('popstate', function () {
    var el = location.hash && d.getElementById(location.hash.slice(1));
    if (el) scrollToEl(el);
    else if (lenis) lenis.scrollTo(0, {duration: 1});
    else window.scrollTo({top: 0, behavior: RM ? 'auto' : 'smooth'});
  });
})();
