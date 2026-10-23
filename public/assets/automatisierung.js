/* Sub-page /automatisierung: each illustration plays its beats once when it is about half visible
   (IntersectionObserver), then holds its end state. No scroll binding. With reduced motion (or without
   GSAP) nothing runs and the CSS end state is the static picture. */
(function () {
  'use strict';
  var d = document;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !window.gsap) return;
  var q = function (el, sel) { return el.querySelector(sel); };
  var qa = function (el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); };
  var EASE = 'power3.out';

  var build = {
    // 1 heading, 2 the three cards slide in one after another, 3 the values settle
    briefing: function (tl, el) {
      tl.from(q(el, '.br-head'), {opacity: 0, y: 10, duration: 0.4, ease: EASE})
        .from(qa(el, '.br-card'), {opacity: 0, x: -40, duration: 0.6, stagger: 0.22, ease: EASE}, 0.25)
        .from(qa(el, '.br-card b'), {opacity: 0, duration: 0.4, stagger: 0.22}, 0.6);
    },
    // 1 three mails drop in, 2 the top one opens, 3 its blocks fill in
    inbox: function (tl, el) {
      tl.from(qa(el, '.ib-mail'), {opacity: 0, y: 24, duration: 0.45, stagger: 0.14, ease: EASE})
        .from(q(el, '.ib-open'), {clipPath: 'inset(0px 0px 86% 0px)', opacity: 0, duration: 0.8, ease: 'power2.inOut'}, 1.1)
        .from(qa(el, '.ib-sub, .ib-from'), {opacity: 0, y: 10, duration: 0.35, stagger: 0.1, ease: EASE}, 1.5)
        .from(qa(el, '.ib-blk'), {opacity: 0, y: 18, duration: 0.45, stagger: 0.22, ease: EASE}, 1.8);
    },
  };

  qa(d, '[data-play]').forEach(function (el) {
    var fn = build[el.getAttribute('data-play')];
    if (!fn) return;
    var tl = gsap.timeline({paused: true});
    fn(tl, el);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio >= 0.45) {
          tl.play();
          io.disconnect();
        }
      });
    }, {threshold: [0, 0.45, 1]});
    io.observe(el);
  });
})();
