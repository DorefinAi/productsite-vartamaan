/* Socia AI page script: hero machine, story crops/overlays, rules table.
   Shared behaviour (nav, Lenis, GSAP story pin, counters, video slot, FAQ) lives in site.js. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* X weighted length. Prefer the shared helper; fallback follows the same twitter-text v3 ranges. */
  function xLength(text) {
    if (window.Site && typeof window.Site.xLength === 'function') return window.Site.xLength(text);
    var n = 0;
    for (var ch of text.normalize('NFC')) {
      var c = ch.codePointAt(0);
      n += (c <= 4351 || (c >= 8192 && c <= 8205) || (c >= 8208 && c <= 8223) || (c >= 8242 && c <= 8247)) ? 1 : 2;
    }
    return n;
  }

  function observe(el, cb, opts) {
    if (!('IntersectionObserver' in window)) { cb(true); return null; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { cb(e.isIntersecting); });
    }, opts || { threshold: 0.25 });
    io.observe(el);
    return io;
  }

  /* ---------- 1. hero machine: file in, X post out ---------- */
  function initMachine() {
    var m = document.querySelector('[data-machine]');
    if (!m) return;
    var countEl = m.querySelector('[data-count]');
    var ring = m.querySelector('[data-ring]');
    var toggle = m.querySelector('[data-machine-toggle]');
    function txt(sel) { var el = m.querySelector(sel); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }

    // the post exactly as it would be pasted into X
    var post = txt('.so-x__line1') + '\n\n' + txt('[data-m="point"]') + '\n\n' + txt('[data-m="foot"]');
    var total = xLength(post);

    function setCount(v) {
      countEl.textContent = v;
      ring.style.setProperty('--p', (v / 280).toFixed(3));
    }
    setCount(total);

    if (reduce.matches) { toggle.hidden = true; return; }

    // 0 empty, 1 file drops, 2 headline lifts, 3 #District #Town + body, 4 handles, 5 counter, 6 ready (hold)
    var DUR = [450, 1300, 1400, 1700, 1600, 1500, 4200];
    var s = 0, timer = null, raf = null, paused = false, visible = false, started = false;

    function tick(to, ms) {
      var t0 = performance.now();
      cancelAnimationFrame(raf);
      (function frame(now) {
        var p = Math.min(1, (now - t0) / ms);
        setCount(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(frame);
      })(t0);
    }

    function go(step) {
      clearTimeout(timer);
      s = step;
      m.dataset.s = String(s);
      if (s === 0) { cancelAnimationFrame(raf); setCount(0); }
      if (s === 5) tick(total, 1100);
      timer = setTimeout(function () {
        if (paused || !visible) return;
        go((s + 1) % DUR.length);
      }, DUR[s]);
    }

    function resume() {
      if (paused) return;
      if (!started) { started = true; m.classList.add('is-running'); go(0); return; }
      go(s);
    }

    toggle.addEventListener('click', function () {
      paused = !paused;
      toggle.setAttribute('aria-pressed', String(paused));
      toggle.textContent = paused ? 'Play' : 'Pause';
      clearTimeout(timer);
      if (paused) {
        // paused shows the finished post
        cancelAnimationFrame(raf);
        m.classList.remove('is-running');
        started = false;
        setCount(total);
      } else {
        resume();
      }
    });

    observe(m, function (inView) {
      visible = inView;
      if (inView) resume(); else clearTimeout(timer);
    }, { threshold: 0.2 });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearTimeout(timer);
      else if (visible) resume();
    });
  }

  /* ---------- 3. story: still crops when stacked, overlays timed when pinned ---------- */
  function initStory() {
    var story = document.querySelector('.so-story');
    if (!story) return;

    // stacked crops: centre the focal point, keep the frame covered; closer on phones so UI text stays readable
    var phone = window.matchMedia('(max-width: 599px)');
    function crops() {
      story.querySelectorAll('.frame__screen[data-crop]').forEach(function (scr) {
        var p = scr.dataset.crop.split(/\s+/).map(parseFloat);
        var fx = p[0], fy = p[1], z = p[2] || 1.6;
        if (phone.matches) z = Math.min(3.6, z * 1.5);
        var tx = Math.min(0, Math.max((1 - z) * 100, 50 - fx * z));
        var ty = Math.min(0, Math.max((1 - z) * 100, 50 - fy * z));
        scr.style.setProperty('--tx', tx.toFixed(2) + '%');
        scr.style.setProperty('--ty', ty.toFixed(2) + '%');
        scr.style.setProperty('--z', z);
      });
    }
    crops();
    if (phone.addEventListener) phone.addEventListener('change', crops);

    // pinned: overlays arrive once the step's zoom is under way
    var steps = Array.prototype.slice.call(story.querySelectorAll('.story__step'));
    story.addEventListener('story:progress', function (e) {
      var d = e.detail;
      steps.forEach(function (st, k) { st.classList.toggle('so-late', k === d.step && d.local > 0.42); });
    });
  }

  /* ---------- 4. rules table: reveal + filter ---------- */
  function initRules() {
    var sec = document.querySelector('[data-rules]');
    if (!sec) return;
    var rows = Array.prototype.slice.call(sec.querySelectorAll('tbody tr'));
    rows.forEach(function (tr, i) {
      tr.querySelectorAll('.so-verdict, mark').forEach(function (el) { el.style.setProperty('--i', i); });
    });

    var table = sec.querySelector('table');
    if (reduce.matches || !document.documentElement.classList.contains('motion')) sec.classList.add('is-seen');
    else {
      var io = observe(table, function (inView) {
        if (inView) { sec.classList.add('is-seen'); if (io) io.disconnect(); }
      }, { rootMargin: '0px 0px -20% 0px' });
    }

    var buttons = sec.querySelectorAll('[data-filter]');
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.dataset.filter;
        buttons.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        sec.classList.add('is-filtering', 'is-seen');
        rows.forEach(function (tr) { tr.hidden = f !== 'all' && tr.dataset.verdict !== f; });
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      });
    });
  }

  function init() {
    initMachine();
    initStory();
    initRules();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
