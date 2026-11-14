/* ==========================================================================
   Dorefin AI product site: shared behaviour
   Needs (loaded with defer, before this file):
     https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js
     https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js
     https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js
   Everything degrades: no CDN / reduced motion => static, fully readable page.
   Page scripts: wait for Site.ready(fn) (or the "site:ready" event).
   ========================================================================== */
(function () {
  "use strict";

  var doc = document.documentElement;
  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  var reduced = mqReduce.matches;
  var motion = hasGsap && !reduced;

  if (!motion) doc.classList.remove("motion");

  var Site = (window.Site = window.Site || {});
  Site.reduced = reduced;
  Site.motion = motion;
  Site.lenis = null;
  Site.desktop = "(min-width: 900px)";
  var readyQueue = Site._q || [];
  var isReady = false;
  Site.ready = function (fn) { if (isReady) fn(Site); else readyQueue.push(fn); };

  /* ---------- Theme toggle ---------- */
  function store(key, val) { try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { return null; } }
  function syncToggle() {
    var light = doc.getAttribute("data-theme") === "light";
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(light));
      b.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-theme-toggle]");
    if (!b) return;
    var next = doc.getAttribute("data-theme") === "light" ? "dark" : "light";
    var apply = function () { doc.setAttribute("data-theme", next); store("dorefin-theme", next); syncToggle(); };
    if (document.startViewTransition && motion) document.startViewTransition(apply); else apply();
  });
  syncToggle();

  /* ---------- Weighted X length (twitter-text v3 rules, no URLs) ---------- */
  Site.xLength = function (text) {
    var n = 0;
    for (var ch of String(text).normalize("NFC")) {
      var c = ch.codePointAt(0);
      var light = (c <= 4351) || (c >= 8192 && c <= 8205) || (c >= 8208 && c <= 8223) || (c >= 8242 && c <= 8247);
      n += light ? 1 : 2;
    }
    return n;
  };

  /* ---------- Counters: [data-count] ---------- */
  function fmt(v, el) {
    var dec = parseInt(el.dataset.decimals || "0", 10);
    var s = v.toFixed(dec);
    if (el.dataset.format === "comma") s = Number(s).toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return (el.dataset.prefix || "") + s + (el.dataset.suffix || "");
  }
  function initCounters() {
    var els = document.querySelectorAll("[data-count]");
    els.forEach(function (el) {
      var end = parseFloat(el.dataset.count);
      var from = parseFloat(el.dataset.countFrom || "0");
      // final value is in the HTML already; the label for AT stays stable
      if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", el.textContent.trim());
      if (!motion || isNaN(end)) { el.textContent = fmt(end, el); return; }
      var o = { v: from };
      el.textContent = fmt(from, el);
      gsap.to(o, {
        v: end, duration: parseFloat(el.dataset.duration || "1.8"), ease: "expo.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
        onUpdate: function () { el.textContent = fmt(o.v, el); },
        onComplete: function () { el.textContent = fmt(end, el); }
      });
    });
  }

  /* Start fn once, when el is actually on screen. Inside a pinned .story the
     step must be the active one (story:step); otherwise a normal scroll trigger. */
  function armStart(el, fn, start) {
    var done = false;
    function go() { if (!done) { done = true; fn(); } }
    var step = el.closest(".story__step");
    var story = step && step.closest(".story");
    if (story) {
      story.addEventListener("story:step", function (e) {
        if (e.detail.step === step && story.classList.contains("is-pinned")) go();
      });
      ScrollTrigger.create({
        trigger: el, start: start || "top 85%",
        onEnter: function () { if (!story.classList.contains("is-pinned") || step.classList.contains("is-active")) go(); }
      });
    } else {
      ScrollTrigger.create({ trigger: el, start: start || "top 85%", once: true, onEnter: go });
    }
  }

  /* ---------- Typing: [data-type] (monospace slugs etc.) ---------- */
  Site.type = function (el, opts) {
    opts = opts || {};
    var full = el.dataset.typeText || el.textContent;
    el.dataset.typeText = full;
    var speed = parseFloat(el.dataset.typeSpeed || opts.speed || "38");
    if (!motion) { el.textContent = full; if (opts.onDone) opts.onDone(); return; }
    var i = 0;
    el.textContent = "";
    el.classList.add("caret");
    clearInterval(el._typeT);
    el._typeT = setInterval(function () {
      i++;
      el.textContent = full.slice(0, i);
      if (opts.onTick) opts.onTick(el.textContent);
      if (i >= full.length) {
        clearInterval(el._typeT);
        if (!el.hasAttribute("data-type-caret")) el.classList.remove("caret");
        if (opts.onDone) opts.onDone();
      }
    }, speed);
  };
  function initTyping() {
    document.querySelectorAll("[data-type]").forEach(function (el) {
      if (el.closest("[data-x280]")) return; // handled by x280
      if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", el.textContent.trim());
      if (!motion) return;
      var full = el.textContent;
      el.dataset.typeText = full;
      el.style.minHeight = el.offsetHeight + "px"; // no layout shift while typing
      el.textContent = "";
      armStart(el, function () { setTimeout(function () { Site.type(el); }, parseFloat(el.dataset.typeDelay || "0")); });
    });
  }

  /* ---------- X 280 counter: [data-x280] ---------- */
  function initX280() {
    document.querySelectorAll("[data-x280]").forEach(function (box) {
      var textEl = box.querySelector("[data-x280-text]");
      var countEl = box.querySelector("[data-x280-count]");
      var ring = box.querySelector("[data-x280-ring]");
      if (!textEl || !countEl) return;
      var extra = parseInt(box.dataset.x280Extra || "0", 10); // hashtags/handles not typed
      function render(t) {
        var n = Site.xLength(t) + extra;
        countEl.textContent = n + "/280";
        if (ring) ring.style.setProperty("--p", Math.min(n / 280, 1));
        box.classList.toggle("is-over", n > 280);
      }
      var full = textEl.textContent;
      render(full);
      if (!motion) return;
      textEl.style.minHeight = textEl.offsetHeight + "px";
      textEl.dataset.typeText = full;
      textEl.textContent = "";
      render("");
      armStart(box, function () {
        setTimeout(function () {
          Site.type(textEl, {
            speed: box.dataset.typeSpeed || 26, onTick: render,
            onDone: function () { render(full); box.classList.add("is-done"); box.dispatchEvent(new CustomEvent("x280:done", { bubbles: true })); }
          });
        }, parseFloat(box.dataset.typeDelay || "300"));
      }, "top 80%");
    });
  }

  /* ---------- Splitting helpers ---------- */
  Site.armStart = function (el, fn, start) { if (motion) armStart(el, fn, start); else fn(); };
  Site.splitWords = function (el) {
    if (el.dataset.splitDone) return el.querySelectorAll(".k-word");
    var words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", el.textContent.trim().replace(/\s+/g, " "));
    el.innerHTML = words.map(function (w) { return '<span class="k-word" aria-hidden="true">' + w.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</span>"; }).join(" ");
    el.dataset.splitDone = "1";
    return el.querySelectorAll(".k-word");
  };

  /* ---------- Motion setup ---------- */
  function initMotion() {
    gsap.registerPlugin(ScrollTrigger);

    // Lenis smooth scroll driven by the GSAP ticker
    if (typeof window.Lenis !== "undefined") {
      var lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      Site.lenis = lenis;
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      document.addEventListener("click", function (e) {
        var a = e.target.closest('a[href^="#"]');
        if (!a || a.getAttribute("href").length < 2) return;
        var target = document.querySelector(a.getAttribute("href"));
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -70 });
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      });
    }

    // Load sequence: [data-kinetic="load"] with .k-line > span children
    document.querySelectorAll('[data-kinetic="load"]').forEach(function (el) {
      var spans = el.querySelectorAll(".k-line > span");
      gsap.fromTo(spans, { yPercent: 110, y: 0 }, {
        yPercent: 0, y: 0, duration: 1.1, ease: "expo.out", stagger: 0.09, delay: parseFloat(el.dataset.delay || "0.1"),
        onStart: function () { spans.forEach(function (s) { s.style.animation = "none"; }); }
      });
    });

    // Reveal: [data-reveal] ("up" default | "clip" | "fade")
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      var kind = el.dataset.reveal || "up";
      var from = kind === "clip" ? { clipPath: "inset(0 0 100% 0)" } : kind === "fade" ? { opacity: 0 } : { y: 48, opacity: 0 };
      var to = kind === "clip" ? { clipPath: "inset(0 0 0% 0)" } : kind === "fade" ? { opacity: 1 } : { y: 0, opacity: 1 };
      to.duration = 1; to.ease = "expo.out";
      to.scrollTrigger = { trigger: el, start: "top 86%", once: true };
      gsap.fromTo(el, from, to);
    });

    // Scrubbed horizontal slide: [data-slide="-40"] (xPercent across the viewport pass)
    document.querySelectorAll("[data-slide]").forEach(function (el) {
      var amt = parseFloat(el.dataset.slide) || -30;
      gsap.fromTo(el, { xPercent: amt > 0 ? -amt * 0.15 : 0 }, {
        xPercent: amt, ease: "none",
        scrollTrigger: { trigger: el.dataset.slideTrigger ? el.closest(el.dataset.slideTrigger) : el, start: "top bottom", end: "bottom top", scrub: 0.6 }
      });
    });

    // Split and stack: [data-split] words scatter in, then lock into a stack (scrubbed)
    document.querySelectorAll("[data-split]").forEach(function (el) {
      var words = Site.splitWords(el);
      gsap.fromTo(words, {
        yPercent: function (i) { return i % 2 ? 140 : -140; },
        xPercent: function (i) { return (i % 3 - 1) * 30; },
        rotate: function (i) { return i % 2 ? 6 : -6; }, opacity: 0
      }, {
        yPercent: 0, xPercent: 0, rotate: 0, opacity: 1, ease: "power3.out", stagger: 0.06,
        scrollTrigger: { trigger: el, start: "top 92%", end: el.dataset.splitEnd || "top 45%", scrub: 0.8 }
      });
    });

    // Parallax: [data-parallax="0.15"] (fraction of element height)
    document.querySelectorAll("[data-parallax]").forEach(function (el) {
      var f = parseFloat(el.dataset.parallax) || 0.15;
      gsap.fromTo(el, { yPercent: f * 100 }, {
        yPercent: -f * 100, ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true }
      });
    });

    // Zoom to detail: [data-zoom="x y scale"] on an element; zooms its first img / .zoom-target
    document.querySelectorAll("[data-zoom]").forEach(function (el) {
      if (el.closest(".story")) return; // the story handles its own zooms
      var p = el.dataset.zoom.split(/\s+/);
      var t = el.querySelector(".zoom-target") || el.querySelector("img") || el;
      gsap.set(t, { transformOrigin: (p[0] || 50) + "% " + (p[1] || 50) + "%" });
      gsap.fromTo(t, { scale: 1 }, {
        scale: parseFloat(p[2] || "1.6"), ease: "power2.inOut",
        scrollTrigger: { trigger: el, start: "top 60%", end: "bottom 30%", scrub: 0.8 }
      });
    });

    // Page scroll progress line in the nav
    var bar = document.querySelector(".scroll-progress");
    if (bar) {
      ScrollTrigger.create({
        start: 0, end: "max",
        onUpdate: function (s) { bar.style.setProperty("--progress", s.progress.toFixed(4)); }
      });
    }

    initStories();
  }

  /* ---------- Pinned scroll story: .story ---------- */
  function initStories() {
    var mm = gsap.matchMedia();
    Site.mm = mm;
    mm.add(Site.desktop, function () {
      var cleanups = [];
      document.querySelectorAll(".story").forEach(function (story) {
        var stage = story.querySelector(".story__stage");
        var steps = Array.prototype.slice.call(story.querySelectorAll(".story__step"));
        if (!stage || steps.length < 2) return;
        story.classList.add("is-pinned");

        var rail = story.querySelector(".story__rail");
        if (!rail) { rail = document.createElement("nav"); rail.className = "story__rail"; rail.setAttribute("aria-label", "Story steps"); stage.appendChild(rail); }
        rail.innerHTML = "";
        var buttons = steps.map(function (s, i) {
          var b = document.createElement("button");
          b.type = "button";
          var h = s.querySelector("h3");
          b.textContent = (i + 1) + "  " + (s.dataset.label || (h ? h.textContent : "Step " + (i + 1)));
          rail.appendChild(b);
          return b;
        });

        var current = -1;
        function activate(i) {
          if (i === current) return;
          var prev = steps[current];
          current = i;
          steps.forEach(function (s, k) { s.classList.toggle("is-active", k === i); s.setAttribute("aria-hidden", String(k !== i)); });
          buttons.forEach(function (b, k) { if (k === i) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
          var next = steps[i];
          gsap.fromTo(next.querySelector(".story__copy"), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .7, ease: "expo.out", overwrite: true });
          gsap.fromTo(next.querySelector(".story__shot"), { y: 60, opacity: 0, scale: .97 }, { y: 0, opacity: 1, scale: 1, duration: .9, ease: "expo.out", overwrite: true });
          if (prev) gsap.set(prev.querySelectorAll(".story__copy, .story__shot"), { clearProps: "opacity" });
          story.dispatchEvent(new CustomEvent("story:step", { detail: { index: i, step: next } }));
        }

        var per = parseFloat(story.dataset.stepLength || "100"); // vh per step
        var st = ScrollTrigger.create({
          trigger: stage, pin: true, start: "top top",
          end: "+=" + (steps.length * per) + "%",
          onUpdate: function (self) {
            var p = self.progress * steps.length;
            var i = Math.min(steps.length - 1, Math.floor(p));
            activate(i);
            // in-step zoom: [data-zoom="x y scale"] on the step, scrubbed in the 2nd half of the step
            var step = steps[i];
            var z = step.dataset.zoom;
            if (z) {
              var pr = gsap.utils.clamp(0, 1, (p - i - 0.35) / 0.5);
              var parts = z.split(/\s+/);
              var img = step.querySelector(".zoom-target") || step.querySelector(".frame__screen img");
              if (img) {
                img.style.transformOrigin = (parts[0] || 50) + "% " + (parts[1] || 50) + "%";
                img.style.transform = "scale(" + (1 + (parseFloat(parts[2] || "1.6") - 1) * gsap.parseEase("power2.inOut")(pr)) + ")";
              }
            }
            story.style.setProperty("--story-progress", self.progress.toFixed(4));
            story.dispatchEvent(new CustomEvent("story:progress", { detail: { progress: self.progress, step: i, local: p - i } }));
          }
        });
        activate(0);
        buttons.forEach(function (b, k) {
          b.addEventListener("click", function () {
            var y = st.start + (st.end - st.start) * ((k + 0.05) / steps.length);
            if (Site.lenis) Site.lenis.scrollTo(y); else window.scrollTo(0, y);
          });
        });
        cleanups.push(function () {
          story.classList.remove("is-pinned");
          steps.forEach(function (s) {
            s.classList.remove("is-active"); s.removeAttribute("aria-hidden");
            s.querySelectorAll(".story__copy, .story__shot, .frame__screen img, .zoom-target").forEach(function (n) { n.removeAttribute("style"); });
          });
          if (rail) rail.innerHTML = "";
        });
      });
      return function () { cleanups.forEach(function (f) { f(); }); };
    });
  }

  /* ---------- Video slot: [data-video] ---------- */
  function initVideo() {
    document.querySelectorAll("[data-video]").forEach(function (slot) {
      var v = slot.querySelector("video");
      if (!v) return;
      var btn = slot.querySelector(".video-slot__ctl");
      var poster = v.getAttribute("poster");
      if (poster) {
        var probe = new Image();
        probe.onload = function () { slot.classList.add("has-poster"); };
        probe.onerror = function () { v.removeAttribute("poster"); };
        probe.src = poster;
      }
      var failed = false;
      function fail() { failed = true; slot.classList.remove("is-ready"); v.style.display = "none"; }
      v.addEventListener("error", fail, true);
      var src = v.querySelector("source");
      if (src) src.addEventListener("error", fail);
      v.addEventListener("loadeddata", function () { if (!failed) slot.classList.add("is-ready"); });

      function setBtn(playing) {
        if (!btn) return;
        btn.textContent = playing ? "Pause film" : "Play film";
        btn.setAttribute("aria-pressed", String(playing));
      }
      if (btn) btn.addEventListener("click", function () {
        if (v.paused) { v.play().catch(function () {}); setBtn(true); slot.dataset.userPaused = ""; }
        else { v.pause(); setBtn(false); slot.dataset.userPaused = "1"; }
      });

      if (reduced) { v.preload = "metadata"; v.load(); setBtn(false); return; } // never autoplay
      if (!("IntersectionObserver" in window)) return;
      var started = false;
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (failed) return;
          if (en.isIntersecting) {
            if (!started) { started = true; v.preload = "auto"; v.load(); }
            if (!slot.dataset.userPaused) { var p = v.play(); if (p) p.then(function () { setBtn(true); }).catch(function () { setBtn(false); }); }
          } else if (!v.paused) { v.pause(); }
        });
      }, { threshold: 0.35 }).observe(slot);
    });
  }

  /* ---------- FAQ: one open at a time (optional via [data-faq-single]) ---------- */
  function initFaq() {
    document.querySelectorAll("[data-faq-single]").forEach(function (list) {
      list.addEventListener("toggle", function (e) {
        if (!e.target.open) return;
        list.querySelectorAll("details[open]").forEach(function (d) { if (d !== e.target) d.open = false; });
      }, true);
    });
    // keep ScrollTrigger positions right when FAQ height changes
    document.addEventListener("toggle", function () { if (motion) ScrollTrigger.refresh(); }, true);
  }

  /* ---------- Boot ---------- */
  function boot() {
    try { if (motion) initMotion(); } catch (err) { console.error("[site] motion disabled:", err); doc.classList.remove("motion"); Site.motion = motion = false; }
    initCounters();
    initTyping();
    initX280();
    initVideo();
    initFaq();
    isReady = true;
    readyQueue.forEach(function (fn) { try { fn(Site); } catch (err) { console.error(err); } });
    readyQueue = [];
    document.dispatchEvent(new CustomEvent("site:ready", { detail: Site }));
    if (motion) {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
      window.addEventListener("load", function () { ScrollTrigger.refresh(); });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
