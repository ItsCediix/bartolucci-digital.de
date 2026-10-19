/* Desktop scroll engine: frame scrubbing on a canvas (Stufe 2), chapter playback fallback (Stufe 1),
   live DOM hero + end hand-over (Stufe 3), rail, sound, reveals, mouse effects.
   Runs only when <html data-mode="desktop">. Depends on gsap + ScrollTrigger + Lenis (local files). */
(function () {
  'use strict';
  var d = document;
  var html = d.documentElement;
  if (html.getAttribute('data-mode') !== 'desktop') return;
  var BD = window.BD;
  if (!BD || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COARSE = matchMedia('(pointer: coarse)').matches;
  var SAVE = !!(navigator.connection && navigator.connection.saveData);
  var NARROW = innerWidth < 1100;

  var panel = d.getElementById('panel');
  var canvas = d.getElementById('frame-canvas');
  var video = d.getElementById('film');
  var hero = d.getElementById('panel-hero');
  var soundBtn = d.querySelector('[data-sound]');
  var soundLabel = d.querySelector('[data-sound-label]');
  var timeEl = d.querySelector('[data-time]');
  var stage = d.getElementById('stage');
  var railLinks = Array.prototype.slice.call(d.querySelectorAll('[data-rail]'));
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var fmtTime = function (t) { var s = Math.floor(t); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); };

  /* ------------------------------------------------------------ chapters + frame index */
  var chapters = BD.chapters.map(function (c) { return Object.assign({}, c, {el: d.getElementById('k-' + c.id)}); });
  var last = chapters[chapters.length - 1];
  var DURATION = BD.video.duration;
  var FR = BD.frames;
  var frames = [];
  if (FR) {
    chapters.forEach(function (c) {
      var m = FR.chapters[c.id];
      c.base = frames.length;
      c.count = m.count;
      c.firstTime = m.firstTime;
      for (var i = 0; i < m.count; i++) frames.push({url: '/frames/' + c.id + '/' + ('000' + (i + 1)).slice(-4) + '.webp', img: null, ok: false, loading: false});
    });
  }
  function chapterAt(t) {
    for (var i = 0; i < chapters.length; i++) if (t < chapters[i].end) return chapters[i];
    return last;
  }
  function frameAt(t) {
    var c = chapterAt(t);
    var idx = clamp(Math.round((t - c.firstTime) * FR.fps), 0, c.count - 1);
    return c.base + idx;
  }

  /* section heights: ≥ 100 vh, about 14 vh per film second so a wheel notch moves ~0.8 s */
  chapters.forEach(function (c) {
    var dur = c.end - c.scrubStart;
    var vh = Math.max(100, Math.round(dur * 14));
    if (c === last) vh += 30; /* room for the hand-over */
    if (c.id === 'hook') vh = 130;
    c.el.style.minHeight = vh + 'vh';
  });

  /* ------------------------------------------------------------ mode decision */
  // 'scrub'    = canvas frames follow the scroll position (Stufe 2)
  // 'playback' = the <video> plays each chapter when it becomes active (Stufe 1)
  // 'static'   = reduced motion: poster + normal controls, no scrub, no autoplay
  var mode = RM ? 'static' : (!FR || COARSE || SAVE || NARROW) ? 'playback' : 'scrub';
  var videoTime = chapters[0].scrubStart;
  var activeChapter = null;
  var sound = false;
  var lastScrollAt = 0;

  function setState(s) {
    mode = s;
    panel.setAttribute('data-state', s);
    if (s !== 'scrub') {
      video.preload = 'auto';
      // the film itself shows the bubble choreography in these modes, so the live overlay goes away
      hero.classList.add('is-static');
      gsap.set(hero, {display: 'none'});
      if (s === 'static') {
        video.controls = true;
        video.muted = false;
      }
      if (s === 'playback') video.load();
      if (s === 'playback' && activeChapter) playChapter(activeChapter, true);
    }
  }

  /* ------------------------------------------------------------ canvas drawing + preloading */
  var ctx = canvas.getContext('2d', {alpha: false});
  var drawn = -1;
  var target = 0;
  var current = 0;
  var MAX_INFLIGHT = 60;
  var inflight = 0;
  var cw = 540;
  var ch = 960;

  function sizeCanvas() {
    var r = panel.getBoundingClientRect();
    var dpr = Math.min(devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(r.width * dpr));
    var h = Math.max(1, Math.round(r.height * dpr));
    if (w !== cw || h !== ch) {
      cw = w;
      ch = h;
      canvas.width = w;
      canvas.height = h;
      drawn = -1;
    }
    panel.style.setProperty('--panel-w', r.width + 'px');
  }

  function load(i) {
    var f = frames[i];
    if (!f || f.ok || f.loading || inflight >= MAX_INFLIGHT) return false;
    f.loading = true;
    inflight++;
    var img = new Image();
    img.decoding = 'async';
    img.onload = function () {
      f.ok = true;
      f.loading = false;
      f.img = img;
      inflight--;
      if (i === Math.round(current)) drawn = -1;
      pump();
    };
    img.onerror = function () {
      f.loading = false;
      inflight--;
      pump();
    };
    img.src = f.url;
    return true;
  }

  // Loads outward from the target frame: current chapter + next chapter first, a short tail behind.
  function pump() {
    if (mode !== 'scrub' || !FR) return;
    var c = chapterAt(videoTime);
    var next = chapters[chapters.indexOf(c) + 1];
    var lo = Math.max(0, c.base - 24);
    var hi = next ? next.base + next.count - 1 : c.base + c.count - 1;
    var t = Math.round(target);
    for (var r = 0; r <= hi - lo; r++) {
      if (inflight >= MAX_INFLIGHT) return;
      var a = t + r;
      var b = t - r;
      if (a <= hi) load(a);
      if (r && b >= lo) load(b);
    }
  }

  function draw(i) {
    var f = frames[i];
    if (!f) return;
    if (!f.ok) {
      load(i);
      // show the nearest loaded frame behind so the panel is never blank
      for (var k = 1; k < 12; k++) {
        var p = frames[i - k];
        var n = frames[i + k];
        if (p && p.ok) { f = p; break; }
        if (n && n.ok) { f = n; break; }
      }
      if (!f.ok) return;
    }
    ctx.drawImage(f.img, 0, 0, cw, ch);
    drawn = i;
  }

  function tick() {
    if (mode !== 'scrub') return;
    var diff = target - current;
    if (Math.abs(diff) < 0.5) current = target;
    else current += diff * 0.12;
    var i = Math.round(current);
    if (i !== drawn) draw(i);
  }

  /* ------------------------------------------------------------ video: playback fallback + sound */
  var playing = false;
  var stopAt = null;
  function playChapter(c, force) {
    if (mode !== 'playback') return;
    if (!force && activeChapter === c) return;
    stopAt = c.end;
    var seek = function () {
      try { video.currentTime = c.start; } catch (e) { /* not ready yet */ }
      var p = video.play();
      if (p && p.catch) p.catch(function () { /* autoplay blocked: user can press play via sound button */ });
    };
    if (video.readyState >= 1) seek();
    else video.addEventListener('loadedmetadata', seek, {once: true});
  }
  video.addEventListener('timeupdate', function () {
    if (mode === 'playback' && stopAt !== null && video.currentTime >= stopAt - 0.05) {
      video.pause();
      try { video.currentTime = Math.min(stopAt, DURATION) - 0.04; } catch (e) { /* ignore */ }
    }
    if (timeEl && mode !== 'scrub') timeEl.textContent = fmtTime(video.currentTime);
  });
  video.addEventListener('play', function () { playing = true; });
  video.addEventListener('pause', function () { playing = false; });

  function syncSound() {
    if (!sound || mode !== 'scrub') return;
    if (Math.abs(video.currentTime - videoTime) > 0.25) {
      try { video.currentTime = videoTime; } catch (e) { /* ignore */ }
    }
    lastScrollAt = performance.now();
    if (!playing && video.readyState >= 2) {
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    }
  }
  setInterval(function () {
    if (sound && mode === 'scrub' && playing && performance.now() - lastScrollAt > 260) video.pause();
  }, 120);

  if (soundBtn) {
    soundBtn.addEventListener('click', function () {
      sound = !sound;
      soundBtn.setAttribute('aria-pressed', sound ? 'true' : 'false');
      soundLabel.textContent = sound ? 'Ton aus' : 'Ton an';
      video.muted = !sound;
      if (sound) {
        video.preload = 'auto';
        if (video.readyState === 0) video.load();
        if (mode === 'scrub') syncSound();
        else if (mode === 'playback' && activeChapter) playChapter(activeChapter, true);
      } else if (mode === 'scrub') {
        video.pause();
      }
    });
  }

  /* ------------------------------------------------------------ scroll → time */
  var lenis = null;
  if (!RM && window.Lenis) {
    lenis = new Lenis({lerp: 0.11, smoothWheel: true});
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  gsap.ticker.add(tick);

  function timeFor(c, p) {
    if (c.id === 'hook') {
      var hold = 0.3; /* first third of the hero: film holds on the four bubbles while the live DOM fades */
      if (p < hold) return c.scrubStart;
      return c.scrubStart + ((p - hold) / (1 - hold)) * (c.end - c.scrubStart);
    }
    return c.start + p * (c.end - c.start);
  }

  var heroFade = {v: 0};
  function setTime(c, p) {
    videoTime = clamp(timeFor(c, p), 0, DURATION);
    if (FR) target = frameAt(videoTime);
    if (timeEl && mode === 'scrub') timeEl.textContent = fmtTime(videoTime);
    // live hero → film hand-over
    if (c.id === 'hook') {
      var f = clamp(p / 0.3, 0, 1);
      if (f !== heroFade.v) {
        heroFade.v = f;
        gsap.set(hero, {opacity: 1 - f, y: -f * 12 + '%'});
      }
    }
    // end hand-over: after the URL is typed the panel fades and the contact section takes over
    if (c === last) {
      var e = clamp((videoTime - 96.2) / 1.5, 0, 1);
      gsap.set(panel, {opacity: 1 - e * 0.85, scale: 1 - e * 0.04});
    }
    syncSound();
    pump();
  }

  function setActive(c) {
    if (activeChapter === c) return;
    activeChapter = c;
    railLinks.forEach(function (a) {
      var on = a.getAttribute('data-rail') === c.id;
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    if (mode === 'playback') playChapter(c, false);
  }

  chapters.forEach(function (c) {
    ScrollTrigger.create({
      trigger: c.el,
      start: 'top top',
      end: c === last ? 'bottom bottom' : 'bottom top',
      onUpdate: function (st) { setTime(c, st.progress); },
      onToggle: function (st) { if (st.isActive) setActive(c); },
    });
  });
  // page top (before any trigger fires) shows the bubbles
  setActive(chapters[0]);
  if (mode === 'scrub') setTime(chapters[0], 0);

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
      if (a.hasAttribute('data-rail')) a.focus();
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
      railLinks[n].focus();
      scrollToEl(d.getElementById('k-' + railLinks[n].getAttribute('data-rail')));
    });
  }

  /* ------------------------------------------------------------ text reveals */
  function splitWords(el) {
    var text = el.textContent;
    el.textContent = '';
    el.setAttribute('aria-label', text);
    var frag = d.createDocumentFragment();
    text.split(/\s+/).forEach(function (w, i) {
      if (!w) return;
      if (i) frag.appendChild(d.createTextNode(' '));
      var s = d.createElement('span');
      s.className = 'w';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = w;
      frag.appendChild(s);
    });
    el.appendChild(frag);
    return el.querySelectorAll('.w');
  }
  function wrapLines(el) {
    var wrap = d.createElement('div');
    wrap.className = 'clip';
    var line = d.createElement('div');
    line.className = 'line';
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(line);
    line.appendChild(el);
    return line;
  }
  if (!RM) {
    chapters.forEach(function (c) {
      var art = c.el.querySelector('.copy');
      var h = art.querySelector('h1, h2');
      var words = splitWords(h);
      var lines = Array.prototype.map.call(art.querySelectorAll('.body p, .key, .demo-note, .lead'), wrapLines);
      var facts = art.querySelectorAll('.facts li');
      var extras = art.querySelectorAll('.cta-row, .offer, .eyebrow');
      var tl = gsap.timeline({paused: true});
      tl.from(art.querySelector('.eyebrow'), {opacity: 0, y: 8, duration: 0.4}, 0)
        .from(words, {opacity: 0, y: 18, rotateX: -30, duration: 0.6, stagger: 0.04, ease: 'power3.out'}, 0.05)
        .from(lines, {yPercent: 110, duration: 0.7, stagger: 0.08, ease: 'power3.out'}, 0.25)
        .from(facts, {opacity: 0, x: -14, duration: 0.5, stagger: 0.08, ease: 'power2.out'}, 0.5)
        .from(Array.prototype.filter.call(extras, function (e) { return !e.classList.contains('eyebrow'); }), {opacity: 0, y: 14, duration: 0.5, stagger: 0.06}, 0.6);
      if (c.id === 'hook') {
        tl.play();
      } else {
        ScrollTrigger.create({
          trigger: c.el,
          start: 'top 70%',
          end: 'bottom 30%',
          onEnter: function () { tl.play(); },
          onLeaveBack: function () { tl.reverse(); },
          onEnterBack: function () { tl.play(); },
        });
      }
    });

    // hero bubbles: spring in alternating left/right with a ~3 % overshoot, like in the film
    var bubbles = hero.querySelectorAll('.bubble');
    gsap.set(bubbles, {opacity: 0});
    gsap.timeline({delay: 0.25}).to(bubbles, {
      opacity: 1, duration: 0.01, stagger: 0.42,
    }, 0).from(bubbles, {
      x: function (i) { return i % 2 ? '22%' : '-22%'; },
      scale: 0.96, duration: 0.7, stagger: 0.42, ease: 'back.out(0.9)',
    }, 0);

    // contact section rises out of the film
    var contact = d.getElementById('kontakt');
    if (contact) {
      gsap.from(contact.querySelector('.wrap'), {
        y: 70, opacity: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: {trigger: contact, start: 'top 85%', toggleActions: 'play none none reverse'},
      });
    }
  } else {
    hero.classList.add('is-static');
  }

  /* ------------------------------------------------------------ mouse effects (fine pointer only, max two per viewport) */
  if (!RM && !COARSE && !NARROW) {
    // 1) panel tilt + specular highlight
    var tiltX = gsap.quickTo(panel, 'rotateY', {duration: 0.6, ease: 'power3.out'});
    var tiltY = gsap.quickTo(panel, 'rotateX', {duration: 0.6, ease: 'power3.out'});
    var sticky = panel.parentNode;
    sticky.addEventListener('mousemove', function (ev) {
      var r = panel.getBoundingClientRect();
      var dx = (ev.clientX - (r.left + r.width / 2)) / (r.width / 2);
      var dy = (ev.clientY - (r.top + r.height / 2)) / (r.height / 2);
      tiltX(clamp(dx, -1, 1) * 5);
      tiltY(clamp(-dy, -1, 1) * 5);
      panel.style.setProperty('--gx', ((ev.clientX - r.left) / r.width * 100) + '%');
      panel.style.setProperty('--gy', ((ev.clientY - r.top) / r.height * 100) + '%');
      panel.classList.add('has-gloss');
    });
    sticky.addEventListener('mouseleave', function () {
      tiltX(0);
      tiltY(0);
      panel.classList.remove('has-gloss');
    });

    // 2) hero spotlight revealing a faint grid
    var hook = chapters[0].el;
    hook.addEventListener('mousemove', function (ev) {
      var r = hook.getBoundingClientRect();
      hook.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
      hook.style.setProperty('--my', (ev.clientY - r.top) + 'px');
      hook.classList.add('has-spot');
    });
    hook.addEventListener('mouseleave', function () { hook.classList.remove('has-spot'); });

    // 3) magnetic CTA buttons in the contact section
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

    // 4) three-layer skyline parallax in the final film section
    d.querySelectorAll('.sky-layer').forEach(function (layer) {
      var depth = parseFloat(layer.getAttribute('data-depth') || '0.3');
      gsap.fromTo(layer, {yPercent: 30 * depth + 10}, {
        yPercent: -14 * depth, ease: 'none',
        scrollTrigger: {trigger: '#kontakt', start: 'top bottom', end: 'bottom top', scrub: 0.6},
      });
    });
  }

  /* ------------------------------------------------------------ boot: canvas size, preloading, 4-second gate */
  sizeCanvas();
  addEventListener('resize', function () { sizeCanvas(); ScrollTrigger.refresh(); });
  if (mode === 'scrub') {
    panel.setAttribute('data-state', 'scrub');
    pump();
    var hookDone = function () {
      var c = chapters[0];
      for (var i = 0; i < c.count; i++) if (!frames[c.base + i].ok) return false;
      return true;
    };
    var t0 = performance.now();
    var gate = setInterval(function () {
      if (hookDone()) { clearInterval(gate); return; }
      if (performance.now() - t0 > 4000) {
        clearInterval(gate);
        setState('playback');
        if (activeChapter) playChapter(activeChapter, true);
      }
    }, 200);
  } else {
    setState(mode);
  }
  // when the tab is hidden, stop the sound sync
  d.addEventListener('visibilitychange', function () { if (d.hidden) video.pause(); });
})();
