/* Vartmaan AI · edition script, shared by all five pages.
   Runs before the CDN scripts (it is the first deferred script), so the
   dateline, progress bar and ticker never wait on a CDN.
   The scroll-scrubbed films start on DOMContentLoaded, after GSAP/Lenis have
   had their turn, and only when GSAP + ScrollTrigger loaded, reduced motion is
   off and the viewport is tall enough. Otherwise the static still frames stay. */
(function () {
  "use strict";
  var doc = document;
  var root = doc.documentElement;
  var reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduce = reduceMQ.matches;

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function safe(name, fn) {
    try { return fn(); } catch (e) { if (window.console) console.warn("[edition] " + name + " did not start:", e); }
  }
  function pad(n) { return String(n).padStart(2, "0"); }

  /* ---------- dateline: today's date in IST ---------- */
  function dateline() {
    var el = $("[data-today]");
    if (!el || typeof Intl === "undefined") return;
    var now = new Date();
    var parts = {};
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata", weekday: "short", day: "2-digit", month: "short", year: "numeric"
    }).formatToParts(now).forEach(function (p) { parts[p.type] = p.value; });
    el.textContent = [parts.weekday, parts.day, parts.month, parts.year].join(" ").toUpperCase().replace(/\./g, "");
    el.setAttribute("datetime", new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now));
  }

  /* ---------- scroll-progress bar ---------- */
  function progressBar() {
    var bar = $(".progress__bar");
    if (!bar) return;
    var ticking = false;
    function paint() {
      ticking = false;
      var max = root.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    paint();
  }

  /* ---------- breaking ticker ---------- */
  function ticker() {
    var track = $("[data-ticker]");
    var btn = $("[data-ticker-toggle]");
    if (!track) return;
    var list = $(".ticker__list", track);
    if (!list) return;
    if (reduce) return; // stays still; the track is keyboard-scrollable (tabindex in the HTML)

    var roll = doc.createElement("div");
    roll.className = "ticker__roll";
    var clone = list.cloneNode(true);
    clone.className = "ticker__list ticker__clone";
    clone.setAttribute("aria-hidden", "true");
    track.insertBefore(roll, list);
    roll.appendChild(list);
    roll.appendChild(clone);
    track.classList.add("is-running");
    track.removeAttribute("tabindex");

    function setSpeed() { // about 70 px per second
      track.style.setProperty("--crawl", Math.max(30, Math.round(list.scrollWidth / 70)) + "s");
    }
    setSpeed();
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(setSpeed);

    var userPaused = false;
    function setPaused(p) { track.classList.toggle("is-paused", p); }
    track.addEventListener("mouseenter", function () { setPaused(true); });
    track.addEventListener("mouseleave", function () { setPaused(userPaused); });
    if (!btn) return;
    btn.hidden = false;
    btn.setAttribute("aria-label", "Pause the ticker");
    btn.addEventListener("click", function () {
      userPaused = !userPaused;
      setPaused(userPaused);
      btn.textContent = userPaused ? "Play" : "Pause";
      btn.setAttribute("aria-pressed", String(userPaused));
      btn.setAttribute("aria-label", userPaused ? "Play the ticker" : "Pause the ticker");
    });
  }

  safe("dateline", dateline);
  safe("progress bar", progressBar);
  safe("ticker", ticker);

  /* ---------- workflow proof switcher ---------- */
  function proofStates() {
    var rail = $("[data-proof-states]");
    var image = $("[data-proof-image]");
    var caption = $("[data-proof-caption]");
    var copy = $("[data-proof-copy]");
    if (!rail || !image) return;
    var states = {
      received: ["assets/screens/vartmaan-inbox-footage-clean.webp", "Received / intake", "The story arrives with its source, slug, and first review state."],
      matched: ["assets/screens/vartmaan-detail-status-chips.webp", "Matched / footage", "The matcher shows Found, Waiting, Not found, or Picked by hand."],
      reviewed: ["assets/screens/vartmaan-inbox-edit.webp", "Reviewed / editor", "The desk can edit, reject, move back to review, or approve."],
      fed: ["assets/screens/vartmaan-feed.webp", "Fed / Octopus", "Approved stories move into the newsroom feed with their state intact."]
    };
    $$("[data-proof-state]", rail).forEach(function (button) {
      button.addEventListener("click", function () {
        var next = states[button.getAttribute("data-proof-state")];
        if (!next) return;
        $$("[data-proof-state]", rail).forEach(function (b) { b.classList.toggle("is-active", b === button); });
        image.src = next[0]; image.alt = next[1] + " screen from the Vartmaan desk.";
        if (caption) caption.textContent = next[1];
        if (copy) copy.textContent = next[2];
      });
    });
  }
  safe("workflow proof", proofStates);

  /* ---------- scroll-scrubbed films ---------- */
  function startFilms() {
    var films = $$("[data-film]");
    var gsap = window.gsap;
    var ST = window.ScrollTrigger;
    if (!films.length || reduce || !gsap || !ST) return; // static stills stay
    gsap.registerPlugin(ST);

    var lenis = null;
    if (window.Lenis) {
      try {
        lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true });
        lenis.on("scroll", ST.update);
        gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
        gsap.ticker.lagSmoothing(0);
      } catch (e) { lenis = null; }
    }

    function navH() { var n = $(".sectionnav"); return n ? n.getBoundingClientRect().height : 0; }
    function scrollToY(y) {
      if (lenis) lenis.scrollTo(y, { duration: 1.1 });
      else window.scrollTo({ top: y, behavior: "smooth" });
    }

    // In-page links go through Lenis; focus moves to the target for keyboard users.
    if (lenis) {
      doc.addEventListener("click", function (ev) {
        var a = ev.target.closest && ev.target.closest('a[href^="#"]');
        if (!a) return;
        var id = a.getAttribute("href").slice(1);
        var target = id ? doc.getElementById(id) : null;
        if (!target) return;
        ev.preventDefault();
        var y = target.getBoundingClientRect().top + window.scrollY - (id === "top" ? 0 : navH());
        scrollToY(Math.max(0, y));
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
        history.replaceState(null, "", "#" + id);
      });
    }

    // Landscape phones and very short windows get the still frames instead.
    var tallMQ = window.matchMedia("(min-height: 501px)");
    var instances = [];
    films.forEach(function (section) {
      var f = safe("film", function () { return makeFilm(section, ST, scrollToY, navH, tallMQ.matches); });
      if (f) instances.push(f);
    });
    function applyMode() {
      instances.forEach(function (f) { f.setMode(tallMQ.matches); });
      ST.refresh();
    }
    if (tallMQ.addEventListener) tallMQ.addEventListener("change", applyMode);

    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { ST.refresh(); });
    window.addEventListener("load", function () { ST.refresh(); });
    if (reduceMQ.addEventListener) {
      reduceMQ.addEventListener("change", function (e) { if (e.matches) location.reload(); });
    }
  }

  function makeFilm(section, ST, scrollToY, navH, startOn) {
    var canvas = $("canvas", section);
    var screen = $(".screen", section);
    if (!canvas || !screen) return null;
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;
    var dir = section.getAttribute("data-frames");
    var count = parseInt(section.getAttribute("data-count"), 10);
    var fps = parseFloat(section.getAttribute("data-fps")) || 5.45;
    var duration = parseFloat(section.getAttribute("data-duration"));
    if (!dir || !count || !duration) return null;

    var tc = $("[data-tc]", section);
    var fill = $(".rail__fill", section);
    var items = $$(".wirelog__item", section);
    var steps = items.map(function (li) { return parseFloat(li.getAttribute("data-at")) || 0; });
    var jumps = $$("[data-jump]", section);
    var firstStill = $(".wirelog__still", section);

    // Scroll length: about 16vh of scroll per second of film.
    section.style.setProperty("--film-h", Math.round(duration * 16 + 100) + "vh");

    var failed = false;
    var want = 0, drawn = -1, activeStep = -1, rafId = 0;
    var cache = new Map();             // frame index -> { img, ok, p }
    var BACK = 8, AHEAD = 16, KEEP = 28; // decoded frames kept around the playhead

    function src(i) { return dir + "/f" + String(i + 1).padStart(3, "0") + ".webp"; }

    function load(i) {
      var rec = cache.get(i);
      if (rec) return rec.p;
      var img = new Image();
      img.decoding = "async";
      rec = { img: img, ok: false };
      rec.p = new Promise(function (res) {
        img.onload = function () {
          var done = function () { rec.ok = true; res(true); if (drawn !== want) schedule(); };
          if (img.decode) img.decode().then(done, done); else done();
        };
        img.onerror = function () { cache.delete(i); res(false); };
      });
      img.src = src(i);
      cache.set(i, rec);
      return rec.p;
    }

    // Keep a sliding window of decoded frames; drop the rest (they stay in the HTTP cache).
    function ensureWindow() {
      for (var d = 0; d <= AHEAD; d++) {
        if (want + d < count) load(want + d);
        if (d && d <= BACK && want - d >= 0) load(want - d);
      }
      cache.forEach(function (rec, i) {
        if (Math.abs(i - want) > KEEP) {
          rec.img.onload = rec.img.onerror = null;
          rec.img.removeAttribute("src");
          cache.delete(i);
        }
      });
    }

    // Warm the HTTP cache for the whole film, coarse to fine, without decoding.
    var warmed = false;
    function warmCache() {
      if (warmed || !window.fetch) return;
      warmed = true;
      var order = [];
      [8, 4, 2, 1].forEach(function (step) {
        for (var i = 0; i < count; i += step) if (order.indexOf(i) < 0) order.push(i);
      });
      var active = 0, LIMIT = 4;
      function next() {
        while (active < LIMIT && order.length) {
          var i = order.shift();
          active++;
          fetch(src(i), { cache: "force-cache" })
            .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
            .catch(function () { return null; })
            .then(function () { active--; next(); });
        }
      }
      next();
    }

    function nearestLoaded(i) {
      for (var d = 0; d < count; d++) {
        var a = cache.get(i - d), b = cache.get(i + d);
        if (a && a.ok) return i - d;
        if (b && b.ok) return i + d;
      }
      return -1;
    }

    function size() {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.min(Math.round(r.width * dpr), 1280);   // never above the frame size
      var h = Math.max(1, Math.round(w * r.height / r.width));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; drawn = -1; }
    }

    function draw() {
      rafId = 0;
      var i = nearestLoaded(want);
      if (i < 0 || i === drawn) return;
      var img = cache.get(i).img;
      var cw = canvas.width, ch = canvas.height;
      var iw = img.naturalWidth, ih = img.naturalHeight;
      if (!iw || !ih) return;
      var s = Math.max(cw / iw, ch / ih); // cover fit
      var dw = iw * s, dh = ih * s;
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      drawn = i;
    }
    function schedule() { if (!rafId) rafId = requestAnimationFrame(draw); }

    var durParts = duration.toFixed(1).split(".");
    var durTxt = pad(Math.floor(+durParts[0] / 60)) + ":" + pad(+durParts[0] % 60) + "." + durParts[1];
    function setProgress(p) {
      var t = Math.min(duration, Math.max(0, p * duration));
      var f = Math.min(count - 1, Math.floor(t * fps));
      if (f !== want) { want = f; if (started) ensureWindow(); schedule(); }
      if (tc) tc.textContent = pad(Math.floor(t / 60)) + ":" + pad(Math.floor(t % 60)) + "." + Math.floor((t * 10) % 10) + " / " + durTxt;
      var s = 0;
      for (var k = 0; k < steps.length; k++) if (t >= steps[k]) s = k;
      // rail ticks are evenly spaced, so fill by step plus progress inside the step
      if (fill && steps.length) {
        var segEnd = s + 1 < steps.length ? steps[s + 1] : duration;
        var inSeg = segEnd > steps[s] ? (t - steps[s]) / (segEnd - steps[s]) : 1;
        fill.style.transform = "scaleX(" + Math.min(1, (s + inSeg) / steps.length).toFixed(4) + ")";
      }
      if (s !== activeStep) {
        activeStep = s;
        items.forEach(function (li, k) { li.classList.toggle("is-active", k === s); });
        jumps.forEach(function (b, k) {
          b.classList.toggle("is-active", k === s);
          b.classList.toggle("is-done", k < s);
          if (k === s) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
        });
      }
    }

    function setMode(on) {
      section.classList.toggle("is-scrub", on && !failed);
      size();
      schedule();
    }
    setMode(startOn);

    var trigger = ST.create({
      trigger: section,
      start: function () { return "top top+=" + navH(); },
      end: "bottom bottom",
      onUpdate: function (self) { setProgress(self.progress); },
      onRefresh: function (self) { size(); setProgress(self.progress); schedule(); },
      invalidateOnRefresh: true
    });

    jumps.forEach(function (b) {
      b.addEventListener("click", function () {
        var at = parseFloat(b.getAttribute("data-jump")) || 0;
        scrollToY(trigger.start + (trigger.end - trigger.start) * Math.min(0.999, (at + 0.35) / duration));
      });
    });

    if ("ResizeObserver" in window) new ResizeObserver(function () { size(); schedule(); }).observe(canvas);
    setProgress(0);

    // Load nothing until the film nears the viewport. Then: poster still behind
    // the canvas, frame 1, the frames around the playhead, and the cache warm-up.
    var started = false;
    function start() {
      if (started) return;
      started = true;
      if (firstStill) screen.style.backgroundImage = "url(" + JSON.stringify(firstStill.getAttribute("src")) + ")";
      load(0).then(function (ok) {
        if (!ok) { // frames unavailable: this film goes back to its still frames
          failed = true;
          section.classList.remove("is-scrub");
          ST.refresh();
          return;
        }
        schedule();
        ensureWindow();
        warmCache();
      });
    }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); start(); }
      }, { rootMargin: "150% 0px" });
      io.observe(section);
    } else {
      start();
    }

    return { setMode: setMode };
  }

  if (doc.readyState === "complete") safe("films", startFilms);
  else doc.addEventListener("DOMContentLoaded", function () { safe("films", startFilms); });
})();
