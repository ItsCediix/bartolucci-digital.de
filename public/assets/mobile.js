/* Mobile body: chapter playback of the 720p video while the chapter cards scroll over it (Lenis),
   dots, sound, sticky CTA. Runs only when <html data-mode="mobile">. */
(function () {
  'use strict';
  var d = document;
  var html = d.documentElement;
  if (html.getAttribute('data-mode') !== 'mobile') return;
  var BD = window.BD;
  if (!BD || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var video = d.getElementById('m-video');
  var film = d.getElementById('m-film');
  var header = d.querySelector('[data-header]');
  var soundBtn = d.querySelector('[data-sound]');
  var soundLabel = d.querySelector('[data-sound-label]');
  var cta = d.querySelector('.m-cta');
  var dots = Array.prototype.slice.call(d.querySelectorAll('[data-rail]'));
  var DURATION = BD.video.duration;
  var chapters = BD.chapters.map(function (c) { return Object.assign({}, c, {el: d.getElementById('k-' + c.id)}); });

  var lenis = null;
  if (!RM && window.Lenis) {
    lenis = new Lenis({lerp: 0.12, smoothWheel: true, syncTouch: false});
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- chapter playback ---------- */
  var active = null;
  var stopAt = null;
  var inFilm = true;
  function play(c) {
    if (RM) return;
    stopAt = c.end;
    var go = function () {
      try { video.currentTime = c.start; } catch (e) { /* not ready */ }
      var p = video.play();
      if (p && p.catch) p.catch(function () { /* blocked until a gesture */ });
    };
    if (video.readyState >= 1) go();
    else video.addEventListener('loadedmetadata', go, {once: true});
  }
  video.addEventListener('timeupdate', function () {
    if (stopAt !== null && video.currentTime >= stopAt - 0.05) {
      video.pause();
      try { video.currentTime = Math.min(stopAt, DURATION) - 0.04; } catch (e) { /* ignore */ }
    }
  });
  function setActive(c) {
    if (active === c) return;
    active = c;
    dots.forEach(function (a) {
      if (a.getAttribute('data-rail') === c.id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    if (inFilm) play(c);
  }
  chapters.forEach(function (c) {
    ScrollTrigger.create({
      trigger: c.el,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: function (st) { if (st.isActive) setActive(c); },
    });
  });
  ScrollTrigger.create({
    trigger: film,
    start: 'top top',
    end: 'bottom top',
    onToggle: function (st) {
      inFilm = st.isActive;
      if (!inFilm) video.pause();
      else if (active) play(active);
    },
  });
  if (RM) {
    video.controls = true;
    video.muted = false;
  } else {
    setActive(chapters[0]);
  }
  // a first tap anywhere also unlocks playback where autoplay was blocked
  d.addEventListener('touchend', function unlock() {
    if (!RM && video.paused && inFilm && active) play(active);
    d.removeEventListener('touchend', unlock);
  }, {passive: true});

  /* ---------- sound ---------- */
  if (soundBtn) {
    soundBtn.addEventListener('click', function () {
      var on = soundBtn.getAttribute('aria-pressed') !== 'true';
      soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      soundLabel.textContent = on ? 'Ton aus' : 'Ton an';
      video.muted = !on;
      if (on && video.paused && active) play(active);
    });
  }

  /* ---------- header + CTA state ---------- */
  var contact = d.getElementById('kontakt');
  ScrollTrigger.create({
    trigger: film,
    start: 'bottom 90px',
    onEnter: function () { header.classList.add('is-past'); },
    onLeaveBack: function () { header.classList.remove('is-past'); },
  });
  // inside the film the header tucks away as soon as the cards start moving (no text collisions)
  var onScroll = function () { header.classList.toggle('is-tucked', inFilm && (window.scrollY || 0) > 40); };
  addEventListener('scroll', onScroll, {passive: true});
  if (lenis) lenis.on('scroll', onScroll);
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

  d.addEventListener('visibilitychange', function () { if (d.hidden) video.pause(); });
})();
