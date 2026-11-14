/* ==========================================================================
   Vartmaan AI page behaviour.
   1. Hero slug: types out, then splits into date / city / subject / type / reporter.
   2. Pinned story: scrubbed progress line + footage sub-states (Waiting, Found, Pick folder).
   Without JS, or with reduced motion: the slug shows already split, the story stacks,
   the progress line shows complete, and the footage step shows Found.
   ========================================================================== */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. Hero slug ---------- */
  function initSlug() {
    var box = document.querySelector("[data-vt-slug]");
    if (!box) return;
    var line = box.querySelector(".vt-slug__line");
    var segs = Array.prototype.slice.call(box.querySelectorAll(".vt-seg"));
    var reads = Array.prototype.slice.call(box.querySelectorAll(".vt-slug__read li"));
    segs.forEach(function (s, i) { s.style.setProperty("--i", i); s.dataset.full = s.textContent; });

    // Put each label under its part when the split slug sits on one line (desktop).
    function align() {
      box.classList.remove("is-aligned");
      reads.forEach(function (li) { li.style.removeProperty("--x"); });
      if (!window.matchMedia("(min-width: 900px)").matches) return;
      var top = segs[0].offsetTop;
      var oneLine = segs.every(function (s) { return Math.abs(s.offsetTop - top) < 4; });
      if (!oneLine) return;
      var base = line.getBoundingClientRect().left;
      var lastRight = -Infinity, ok = true;
      reads.forEach(function (li, i) {
        var x = segs[i].getBoundingClientRect().left - base;
        if (x < lastRight + 12) ok = false;
        li.style.setProperty("--x", x + "px");
        lastRight = x + li.offsetWidth;
      });
      if (ok) box.classList.add("is-aligned");
      else reads.forEach(function (li) { li.style.removeProperty("--x"); });
    }

    // Measure the finished (split) layout first, so nothing shifts later.
    box.classList.add("is-measuring", "is-split");
    align();
    line.style.minHeight = line.offsetHeight + "px";
    void line.offsetWidth;
    box.classList.remove("is-measuring");

    function remeasure() {
      var typing = !box.classList.contains("is-split");
      box.classList.add("is-measuring");
      if (typing) { box.classList.add("is-split"); }
      line.style.minHeight = "";
      // measure with full text in place
      var saved = segs.map(function (s) { return s.innerHTML; });
      if (typing) segs.forEach(function (s) { s.textContent = s.dataset.full; });
      align();
      line.style.minHeight = line.offsetHeight + "px";
      if (typing) { segs.forEach(function (s, i) { s.innerHTML = saved[i]; }); box.classList.remove("is-split"); }
      void line.offsetWidth;
      box.classList.remove("is-measuring");
    }
    var t;
    window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(remeasure, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);

    if (reduced) return;

    // Typing state
    box.classList.add("is-typing");
    box.classList.remove("is-split");
    segs.forEach(function (s) { s.textContent = ""; });
    var unders = box.querySelectorAll(".vt-us");
    unders.forEach(function (u) { u.style.visibility = "hidden"; });

    var caret = document.createElement("span");
    caret.className = "vt-seg__caret";
    caret.setAttribute("aria-hidden", "true");

    var si = 0, ci = 0;
    var speed = 46;
    function tick() {
      var seg = segs[si];
      var full = seg.dataset.full;
      ci++;
      seg.textContent = full.slice(0, ci);
      seg.appendChild(caret);
      if (ci >= full.length) {
        if (unders[si]) unders[si].style.visibility = "";
        si++; ci = 0;
        if (si >= segs.length) return done();
      }
      setTimeout(tick, speed + (ci === 0 ? 70 : 0));
    }
    function done() {
      setTimeout(function () {
        if (caret.parentNode) caret.parentNode.removeChild(caret);
        box.classList.add("is-split");
        box.classList.remove("is-typing");
      }, 520);
    }
    setTimeout(tick, 650);
  }

  /* ---------- 2. Story: progress line + footage sub-states ---------- */
  function initStory() {
    var story = document.querySelector(".vt-story");
    if (!story) return;
    var track = story.querySelector("[data-vt-track]");
    var nodes = track ? Array.prototype.slice.call(track.querySelectorAll("li[data-at]")) : [];
    var footStep = story.querySelector(".vt-step-footage");
    var subs = footStep ? Array.prototype.slice.call(footStep.querySelectorAll(".vt-sub")) : [];
    var states = footStep ? Array.prototype.slice.call(footStep.querySelectorAll(".vt-states li")) : [];
    var footIndex = footStep ? Array.prototype.indexOf.call(story.querySelectorAll(".story__step"), footStep) : -1;
    var curSub = -1, curZoom = null;

    // Map story progress to the fill width so the line reaches each dot
    // exactly when its stage is reached. Dots sit at the start of 5 equal columns.
    var stops = [[0, 0]].concat(nodes.slice(1).map(function (li, i) {
      return [parseFloat(li.dataset.at), (i + 1) / nodes.length];
    })).concat([[1, 1]]);
    function fillAt(p) {
      for (var i = 1; i < stops.length; i++) {
        if (p <= stops[i][0]) {
          var a = stops[i - 1], b = stops[i];
          return a[1] + (b[1] - a[1]) * ((p - a[0]) / Math.max(1e-6, b[0] - a[0]));
        }
      }
      return 1;
    }

    function setSub(k, zoom) {
      if (k === curSub && zoom === curZoom) return;
      curSub = k; curZoom = zoom;
      subs.forEach(function (img, i) {
        img.classList.toggle("is-on", i === k);
        img.classList.toggle("is-zoomed", i === k && !!zoom);
      });
      states.forEach(function (li, i) { li.classList.toggle("is-on", i === k); });
    }
    function staticState() {
      setSub(1, false); // Found
      states.forEach(function (li) { li.classList.remove("is-on"); });
      curSub = -1;
    }
    staticState();

    story.addEventListener("story:progress", function (e) {
      var d = e.detail;
      if (track) {
        track.style.setProperty("--vt-p", fillAt(d.progress).toFixed(4));
        nodes.forEach(function (li) { li.classList.toggle("is-reached", d.progress >= parseFloat(li.dataset.at) - 0.0001); });
      }
      if (d.step === footIndex) {
        var local = Math.max(0, Math.min(0.999, d.local));
        var k = Math.floor(local * 3);
        var inSub = local * 3 - k;
        setSub(k, inSub > 0.3);
      } else if (d.step < footIndex) {
        setSub(0, false);
      } else {
        setSub(2, false);
      }
    });

    // When the story unpins (resize below 900px), return to the static layout.
    var mo = new MutationObserver(function () {
      if (!story.classList.contains("is-pinned")) {
        staticState();
        if (track) track.style.removeProperty("--vt-p");
      }
    });
    mo.observe(story, { attributes: true, attributeFilter: ["class"] });
  }

  function boot() {
    initSlug();
    initStory();
  }
  if (window.Site && typeof window.Site.ready === "function") window.Site.ready(boot);
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
