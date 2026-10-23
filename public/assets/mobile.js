/* Mobile body (v11): every chapter card carries its own small frameless stage with the chapter's DOM scene.
   The scene plays its beats once (~2.5 s) when the card is half visible and then holds its end state; no
   scroll scrubbing, no video. Header state, sticky CTA, anchors. Runs only when <html data-mode="mobile">. */
(function () {
  'use strict';
  var d = document;
  var html = d.documentElement;
  if (html.getAttribute('data-mode') !== 'mobile') return;
  var BD = window.BD;
  var S = window.BDScenes;
  if (!BD || !S || !window.gsap || !window.ScrollTrigger) return;
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
    S.fit(stage);
    var scenes = S.collect(stage);
    var scene = scenes[id];
    if (RM) return; // the CSS already is the final state
    var tl = gsap.timeline({paused: true, defaults: {ease: S.ease.brand}});
    if (id === 'hook') S.introInto(tl, scene, 0);
    else S.beats[id](tl, scene, BEATS[id]);
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
      scrollToEl(el);
    });
  });
})();
