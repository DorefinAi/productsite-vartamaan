/* Vartmaan AI · front-page intro: tablet screen → paper → crumpled ball → today's edition.
   Runs only when <html> has .has-intro (set by the inline head check: motion allowed,
   viewport at least 501px tall, WebGL available). three.js is fetched lazily after
   first paint, pinned with SRI. On any failure the intro section is removed and the
   page starts at the masthead. Renders only while the intro is in view and the
   scroll progress is still changing. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var section = doc.querySelector("[data-intro]");
  if (!section || !root.classList.contains("has-intro")) return;

  var THREE_SRC = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  var THREE_SRI = "sha384-CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu";
  var SCREEN_SRC = "assets/screens/vartmaan-inbox-footage-clean.webp";

  var stage = section.querySelector(".intro__stage");
  var canvas = section.querySelector(".intro__canvas");
  var cap = section.querySelector("[data-intro-cap]");
  var capNote = section.querySelector("[data-intro-note]");
  var paperLayer = section.querySelector(".intro__paper");
  var failed = false, live = false;

  function fail(why) {
    if (failed) return;
    failed = true;
    if (window.console && why) console.info("[intro] fallback:", why);
    root.classList.remove("has-intro");
    section.hidden = true;
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  var mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
  var TEX_W = mobile ? 1024 : 2048, TEX_H = Math.round(TEX_W / 1.6);

  /* ---------- stage timings (scroll progress 0..1) ---------- */
  function ss(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  var CAPS = [
    [0, "00 · THE DESK APP", "The assignment desk's inbox, with a reporter's story and its footage."],
    [0.22, "01 · EVERY FILE", "WhatsApp, Outlook and the Reporter app, gathered into one place."],
    [0.5, "02 · ONE PAGE", "Each story keeps its slug, gets its district and finds its footage."],
    [0.7, "03 · TODAY'S EDITION", "The desk edits and approves. People make every call."]
  ];

  /* ---------- helpers ---------- */
  function loadScript(src, sri) {
    return new Promise(function (res, rej) {
      var s = doc.createElement("script");
      s.src = src; s.integrity = sri; s.crossOrigin = "anonymous"; s.async = true;
      s.onload = res; s.onerror = function () { rej(new Error("three.js did not load")); };
      doc.head.appendChild(s);
    });
  }
  function loadImage(src) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.decoding = "async";
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error("screen image did not load")); };
      img.src = src;
    });
  }
  function fontsReady() {
    if (!doc.fonts || !doc.fonts.load) return Promise.resolve();
    var wanted = ["700 80px Newsreader", "600 40px Newsreader", "400 20px Newsreader", "500 30px 'Anek Devanagari'", "500 16px 'JetBrains Mono'", "600 16px 'Instrument Sans'"];
    var all = Promise.all(wanted.map(function (f) { return doc.fonts.load(f, "Vartmaan वर्तमान").catch(function () {}); }));
    return Promise.race([all, new Promise(function (r) { setTimeout(r, 2500); })]);
  }

  function grain(ctx, w, h, amount) {
    var id = ctx.getImageData(0, 0, w, h), d = id.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (Math.random() - 0.5) * amount;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(id, 0, 0);
  }
  function wrap(ctx, text, x, y, maxW, lh, maxLines) {
    var words = text.split(" "), line = "", lines = 0;
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y); y += lh; line = words[i];
        if (++lines >= maxLines) return y;
      } else line = test;
    }
    if (line) { ctx.fillText(line, x, y); y += lh; }
    return y;
  }

  /* the screen: the real app screenshot, downscaled to the texture size */
  function screenCanvas(img) {
    var c = doc.createElement("canvas"); c.width = TEX_W; c.height = TEX_H;
    var ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, TEX_W, TEX_H);
    return c;
  }

  /* the newspaper front page, drawn from the page's own copy */
  function newsCanvas() {
    var W = TEX_W, H = TEX_H, k = W / 2048;
    var c = doc.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d");
    var INK = "#141310", MUTED = "#5C574D", RULE = "#CBC4B3";
    x.fillStyle = "#F4F0E6"; x.fillRect(0, 0, W, H);
    grain(x, W, H, 10);
    var m = 110 * k, cw = W - 2 * m;
    x.fillStyle = INK; x.textBaseline = "alphabetic";
    // dateline
    x.font = "500 " + 22 * k + "px 'JetBrains Mono', monospace";
    var date = (doc.querySelector("[data-today]") || {}).textContent || "";
    x.textAlign = "left"; x.fillText("[ JAIPUR ]", m, 92 * k);
    x.textAlign = "center"; x.fillText("[ " + date.trim() + " ]", W / 2, 92 * k);
    x.textAlign = "right"; x.fillText("[ EDITION 01 ]", W - m, 92 * k);
    x.fillRect(m, 114 * k, cw, 2 * k);
    // nameplate
    x.textAlign = "center";
    x.font = "700 " + 205 * k + "px Newsreader, Georgia, serif";
    x.fillText("Vartmaan AI", W / 2, 335 * k);
    x.font = "500 " + 44 * k + "px 'Anek Devanagari', 'Nirmala UI', sans-serif";
    x.fillText("वर्तमान", W / 2, 420 * k);
    // ears
    x.textAlign = "left"; x.font = "500 " + 22 * k + "px 'Instrument Sans', sans-serif";
    x.strokeStyle = INK; x.lineWidth = 2 * k;
    x.strokeRect(m, 210 * k, 220 * k, 110 * k);
    wrap(x, "Assignment-desk intake for the Hindi newsroom", m + 18 * k, 252 * k, 186 * k, 28 * k, 3);
    x.strokeRect(W - m - 220 * k, 210 * k, 220 * k, 110 * k);
    x.fillStyle = "#D7141A"; x.beginPath(); x.arc(W - m - 196 * k, 244 * k, 7 * k, 0, 7); x.fill();
    x.fillStyle = INK; wrap(x, "Live on the assignment desk", W - m - 178 * k, 252 * k, 160 * k, 28 * k, 3);
    // double rule
    x.fillRect(m, 462 * k, cw, 7 * k); x.fillRect(m, 476 * k, cw, 2 * k);
    // three columns of today's stories
    var top = 540 * k, gap = 56 * k, col = (cw - 2 * gap) / 3;
    var cols = [
      ["Every reporter's file reaches one desk, with its slug and its footage.",
       "Stories arrive on WhatsApp, in Outlook and through the Reporter app. Vartmaan AI gathers them into one inbox, keeps the reporter's slug as typed, tags the district, and finds the footage the reporter already put on the newsroom FTP."],
      ["From a reporter's phone to the Octopus feed",
       "Follow the Udaipur tourist-season story through filing, the inbox, its slug and folder, the footage match, the district tag, the editor, and Approve."],
      ["Read-only by design",
       "It never changes the reporter's footage; the only place it writes is its own folder. Nothing reaches Octopus until a person on the desk approves it."]
    ];
    cols.forEach(function (cc, i) {
      var cx = m + i * (col + gap);
      if (i) { x.fillStyle = RULE; x.fillRect(cx - gap / 2, top, 2 * k, H - top - 90 * k); }
      x.fillStyle = INK; x.textAlign = "left";
      x.font = (i === 2 ? "italic " : "") + "600 " + (i === 0 ? 58 : 46) * k + "px Newsreader, Georgia, serif";
      var y = wrap(x, cc[0], cx, top + 50 * k, col, (i === 0 ? 62 : 50) * k, 4);
      x.fillStyle = MUTED; x.font = "400 " + 27 * k + "px Newsreader, Georgia, serif";
      wrap(x, cc[1], cx, y + 26 * k, col, 40 * k, 12);
    });
    return c;
  }

  function shadowCanvas() {
    var c = doc.createElement("canvas"); c.width = c.height = 128;
    var x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return c;
  }

  /* ---------- shaders ---------- */
  var VERT = [
    "uniform float uCurl, uCrumple, uResidual, uW, uH, uR;",
    "varying vec2 vUv; varying vec3 vViewPos;",
    "float h3(vec3 p){ return fract(sin(dot(p, vec3(17.13, 113.31, 71.71))) * 43758.5453); }",
    // trilinear value noise, no smoothing: the kinks read as hard creases
    "float vn(vec3 p){ vec3 i = floor(p), f = fract(p);",
    "  return mix(mix(mix(h3(i), h3(i+vec3(1.,0.,0.)), f.x), mix(h3(i+vec3(0.,1.,0.)), h3(i+vec3(1.,1.,0.)), f.x), f.y),",
    "             mix(mix(h3(i+vec3(0.,0.,1.)), h3(i+vec3(1.,0.,1.)), f.x), mix(h3(i+vec3(0.,1.,1.)), h3(i+vec3(1.,1.,1.)), f.x), f.y), f.z); }",
    "void main(){",
    "  vUv = uv; vec3 p = position;",
    // 1. peel: the sheet rolls up from the bottom-right corner around a moving line
    "  vec2 corner = vec2(uW * .5, -uH * .5); vec2 D = normalize(vec2(-uW, uH));",
    "  float s = dot(p.xy - corner, D); float L = uCurl * length(vec2(uW, uH)) * .72;",
    "  float R = .07 + .07 * uCurl; vec3 curled = p;",
    "  if (s < L) { float u = L - s; float th = u / R; float s2; float z;",
    "    if (th < 3.14159) { s2 = L - R * sin(th); z = R * (1. - cos(th)); }",
    "    else { s2 = L + (u - 3.14159 * R); z = 2. * R; }",
    "    curled.xy += D * (s2 - s); curled.z += z; }",
    // crease field shared by the ball, the unfold and the smoothed-out sheet
    "  float c = vn(vec3(uv * vec2(7., 4.5), 1.3)) * .65 + vn(vec3(uv * vec2(17., 11.), 4.1)) * .35;",
    "  vec3 j = vec3(vn(vec3(uv * 6.5, 2.)), vn(vec3(uv * 6.5, 5.)), vn(vec3(uv * 6.5, 8.))) - .5;",
    // 2. ball: each vertex goes to a noisy point on a sphere
    "  float th = uv.x * 6.28318, ph = .12 + uv.y * 2.9;",
    "  vec3 dir = normalize(vec3(sin(ph) * cos(th), cos(ph), sin(ph) * sin(th)) + j * 1.1);",
    "  float cb = vn(vec3(uv * vec2(13., 8.), 7.7)) * .6 + vn(vec3(uv * vec2(29., 19.), 3.3)) * .4;",
    "  vec3 ball = dir * uR * (.58 + .5 * c + .45 * cb) + j * uR * .3;",
    // 3. unfold: back to flat, keeping a small crease displacement
    "  vec3 flatPos = p + vec3(j.xy * .01, (c - .5) * .04) * uResidual;",
    "  vec3 base = mix(curled, flatPos, uResidual);",
    "  float wr = sin(clamp(uCrumple, 0., 1.) * 3.14159);",
    "  vec3 wrinkle = vec3(j.xy * .35, (c - .5) * .9) * wr * .45;",
    "  vec3 pos = mix(base, ball, smoothstep(0., 1., uCrumple)) + wrinkle;",
    "  vec4 mv = modelViewMatrix * vec4(pos, 1.); vViewPos = mv.xyz;",
    "  gl_Position = projectionMatrix * mv; }"
  ].join("\n");

  var FRAG = [
    "uniform sampler2D uScreen, uNews; uniform float uTexMix, uPaperize, uSettle;",
    "varying vec2 vUv; varying vec3 vViewPos;",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "void main(){",
    // flat shading from screen-space derivatives: one normal per facet
    "  vec3 n = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));",
    "  if (dot(n, -vViewPos) < 0.) n = -n;",
    "  vec3 L = normalize(vec3(-.45, .75, .85));",
    "  float diff = max(dot(n, L), 0.); float rim = pow(1. - max(dot(n, normalize(-vViewPos)), 0.), 3.);",
    "  float shade = (.42 + .62 * diff + .08 * rim) / .93;",
    "  vec3 paper = vec3(.957, .941, .902);",
    "  float g = (hash(floor(vUv * vec2(1400., 875.))) - .5) * .05;",
    "  vec3 col;",
    "  if (gl_FrontFacing) {",
    "    vec3 s = texture2D(uScreen, vUv).rgb; float l = dot(s, vec3(.299, .587, .114));",
    "    vec3 printed = paper * mix(vec3(l), s, .5);",
    "    col = mix(mix(s, printed, uPaperize), texture2D(uNews, vUv).rgb, uTexMix);",
    "  } else { col = paper * .97; }",
    "  col += g * uPaperize;",
    "  float lit = mix(1., shade, uPaperize);",
    "  lit = mix(lit, 1. + (lit - 1.) * .35, uSettle);",
    "  gl_FragColor = vec4(col * lit, 1.); }"
  ].join("\n");

  /* ---------- scene ---------- */
  function build(THREE, screenC, newsC) {
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (e) { throw new Error("WebGL renderer failed: " + e.message); }
    renderer.setClearColor(0x000000, 0);
    var DPR_CAP = mobile ? 1.25 : 1.5;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    var CAM_DIR = new THREE.Vector3(0, 0.9, 3.4).normalize();
    var LOOK = new THREE.Vector3(0, -0.05, 0);
    var camDist = 3.5;

    scene.add(new THREE.AmbientLight(0xf4f0e6, 0.45));
    var key = new THREE.DirectionalLight(0xf4f0e6, 0.9); key.position.set(-2, 3, 3); scene.add(key);

    // tablet: rounded dark bezel with its front face at z = 0
    var TW = 1.78, TH = 1.18, TR = 0.09, TD = 0.05;
    var shape = new THREE.Shape();
    shape.moveTo(-TW / 2 + TR, -TH / 2); shape.lineTo(TW / 2 - TR, -TH / 2); shape.quadraticCurveTo(TW / 2, -TH / 2, TW / 2, -TH / 2 + TR);
    shape.lineTo(TW / 2, TH / 2 - TR); shape.quadraticCurveTo(TW / 2, TH / 2, TW / 2 - TR, TH / 2);
    shape.lineTo(-TW / 2 + TR, TH / 2); shape.quadraticCurveTo(-TW / 2, TH / 2, -TW / 2, TH / 2 - TR);
    shape.lineTo(-TW / 2, -TH / 2 + TR); shape.quadraticCurveTo(-TW / 2, -TH / 2, -TW / 2 + TR, -TH / 2);
    var tabGeo = new THREE.ExtrudeGeometry(shape, { depth: TD, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 6 });
    tabGeo.translate(0, 0, -TD - 0.012 - 0.006);
    var tabMat = new THREE.MeshStandardMaterial({ color: 0x1f1d19, roughness: 0.45, metalness: 0.3, transparent: true });
    var tablet = new THREE.Group();
    tablet.add(new THREE.Mesh(tabGeo, tabMat));
    var glassMat = new THREE.MeshBasicMaterial({ color: 0x0b0a08, transparent: true });
    var glass = new THREE.Mesh(new THREE.PlaneGeometry(1.64, 1.04), glassMat);
    glass.position.z = -0.004; tablet.add(glass);
    scene.add(tablet);

    // paper sheet
    var SEG = mobile ? [48, 30] : [80, 50];
    var tScreen = new THREE.CanvasTexture(screenC), tNews = new THREE.CanvasTexture(newsC);
    [tScreen, tNews].forEach(function (t) { t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); t.minFilter = THREE.LinearMipmapLinearFilter; });
    var uniforms = {
      uCurl: { value: 0 }, uCrumple: { value: 0 }, uResidual: { value: 0 },
      uW: { value: 1.6 }, uH: { value: 1.0 }, uR: { value: 0.42 },
      uScreen: { value: tScreen }, uNews: { value: tNews },
      uTexMix: { value: 0 }, uPaperize: { value: 0 }, uSettle: { value: 0 }
    };
    var mat = new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide });
    mat.extensions = { derivatives: true };
    var sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0, SEG[0], SEG[1]), mat);
    sheet.frustumCulled = false;
    var carrier = new THREE.Group(); carrier.add(sheet); scene.add(carrier);

    // soft contact shadow under the ball
    var shMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas()), transparent: true, depthWrite: false, opacity: 0 });
    var shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), shMat);
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, -0.62, 0.15); scene.add(shadow);

    var TABLET = { px: 0, py: -0.06, pz: 0, rx: -0.62, ry: 0, rz: 0.05, s: 1 };
    var BALL = { px: 0, py: 0.1, pz: 0.25, rx: -0.3, ry: 0, rz: 0.2, s: 1 };
    var FINAL = { px: LOOK.x, py: LOOK.y, pz: 0, rx: -Math.atan2(0.9, 3.4), ry: 0, rz: 0, s: 1 };
    tablet.rotation.set(TABLET.rx, TABLET.ry, TABLET.rz); tablet.position.set(TABLET.px, TABLET.py, TABLET.pz);
    var aspect = 1, ballScale = 1, narrow = false, sheetFrac = 0;

    function lerp(a, b, t) { return a + (b - a) * t; }
    function pose(a, b, t) { var o = {}; for (var k in a) o[k] = lerp(a[k], b[k], t); return o; }

    function resize() {
      var w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
      renderer.setSize(w, h, false);
      aspect = w / h; camera.aspect = aspect;
      var t2 = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      // fit the tablet: 82% of the width and 62% of the height at most
      camDist = Math.max(TW / 0.82 / (aspect * t2), TH / 0.62 / t2);
      camera.position.copy(CAM_DIR).multiplyScalar(camDist).add(LOOK);
      camera.lookAt(LOOK); camera.updateProjectionMatrix();
      ballScale = Math.max(1, 0.5 / aspect);
      var visH = camDist * t2, visW = visH * aspect;
      narrow = aspect < 0.8;
      // phones: the unfolded front page fills about 94% of the width before the hand-off
      FINAL.s = Math.min((narrow ? 0.96 : 0.98) * visW / 1.6, 0.90 * visH);
      sheetFrac = FINAL.s * 1.6 / visW;
      BALL.s = ballScale;
    }

    var STATE = {};
    function apply(p) {
      var paperize = ss(0.04, 0.14, p), curl = ss(0.07, 0.3, p), lift = ss(0.2, 0.42, p);
      var unfold = ss(0.62, 0.84, p), crumple = ss(0.28, 0.48, p) - unfold;
      var spin = ss(0.36, 0.72, p), settle = ss(0.84, 1, p), tabOut = ss(0.3, 0.44, p);
      uniforms.uPaperize.value = paperize; uniforms.uCurl.value = curl;
      uniforms.uCrumple.value = crumple; uniforms.uResidual.value = unfold;
      uniforms.uTexMix.value = p >= 0.55 ? 1 : 0;   // swapped while it is a ball
      uniforms.uSettle.value = settle;
      var a = pose(TABLET, BALL, lift);
      a.ry += spin * Math.PI * 1.15; a.rx += Math.sin(spin * Math.PI) * 0.5;
      a.py += Math.sin(spin * Math.PI) * 0.06;
      var f = pose(a, FINAL, unfold);
      f.s = lerp(f.s, FINAL.s * lerp(narrow ? 0.95 : 0.86, 1, settle), unfold);
      f.ry = lerp(a.ry, Math.round(a.ry / (2 * Math.PI)) * 2 * Math.PI, unfold);
      carrier.position.set(f.px, f.py, f.pz); carrier.rotation.set(f.rx, f.ry, f.rz); carrier.scale.setScalar(f.s);
      tablet.position.y = TABLET.py - tabOut * 0.25; tablet.position.z = -tabOut * 0.6;
      tabMat.opacity = glassMat.opacity = 1 - tabOut; tablet.visible = tabOut < 1;
      shMat.opacity = 0.55 * (ss(0.32, 0.46, p) - ss(0.62, 0.76, p));
      shadow.position.y = -0.62 * Math.max(1, ballScale * 0.9); shadow.scale.setScalar(ballScale);
      if (paperLayer) paperLayer.style.opacity = settle.toFixed(3);
      var ci = 0; for (var i = 0; i < CAPS.length; i++) if (p >= CAPS[i][0]) ci = i;
      if (STATE.cap !== ci) {
        STATE.cap = ci;
        cap.textContent = CAPS[ci][1]; capNote.textContent = CAPS[ci][2];
        section.setAttribute("data-stage", String(ci));
      }
      section.classList.toggle("is-settled", settle > 0.5);
    }

    /* render on demand: ease the shown progress toward the scroll target, then stop */
    var target = 0, shown = -1, raf = 0, inView = true;
    var stats = { frames: 0, ms: 0 };
    function frame() {
      raf = 0;
      if (!inView) return;
      var t0 = performance.now();
      var next = shown < 0 ? target : shown + (target - shown) * 0.2;
      if (Math.abs(target - next) < 0.0006) next = target;
      shown = next;
      apply(shown);
      renderer.render(scene, camera);
      stats.frames++; stats.ms += performance.now() - t0;
      if (shown !== target) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && inView) raf = requestAnimationFrame(frame); }

    resize();
    var ST = window.ScrollTrigger;
    var trig = ST.create({
      trigger: section, start: "top top", end: "bottom bottom",
      onUpdate: function (self) { target = self.progress; kick(); },
      onRefresh: function (self) { target = self.progress; resize(); shown = -1; kick(); }
    });
    target = trig.progress || 0;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { inView = e[0].isIntersecting; if (inView) { shown = -1; kick(); } }).observe(section);
    }
    if ("ResizeObserver" in window) new ResizeObserver(function () { resize(); shown = -1; kick(); }).observe(stage);
    renderer.domElement.addEventListener("webglcontextlost", function (e) { e.preventDefault(); fail("WebGL context lost"); });

    apply(target); renderer.render(scene, camera); shown = target;
    // a shader that does not compile leaves a blank canvas: fall back instead
    var bad = (renderer.info.programs || []).some(function (pr) { return pr.diagnostics && pr.diagnostics.runnable === false; });
    if (bad || renderer.getContext().isContextLost()) throw new Error("shader did not compile");
    window.__vartmaanIntro = { stats: stats, progress: function () { return shown; }, sheetWidth: function () { return sheetFrac; } };
    return true;
  }

  /* ---------- start after first paint ---------- */
  function start() {
    if (!window.gsap || !window.ScrollTrigger) { fail("GSAP not available"); return; }
    var timer = setTimeout(function () { if (!live) fail("timed out"); }, 12000);
    var three = window.THREE ? Promise.resolve() : loadScript(THREE_SRC, THREE_SRI);
    Promise.all([three, loadImage(SCREEN_SRC), fontsReady()]).then(function (r) {
      if (failed) return;
      var THREE = window.THREE;
      if (!THREE) throw new Error("three.js missing");
      build(THREE, screenCanvas(r[1]), newsCanvas());
      live = true; clearTimeout(timer);
      section.classList.add("is-live");
      window.ScrollTrigger.refresh();
    }).catch(function (e) { clearTimeout(timer); fail(e && e.message); });
  }

  function afterPaint() { requestAnimationFrame(function () { setTimeout(start, 0); }); }
  if (doc.readyState === "complete") afterPaint();
  else window.addEventListener("load", afterPaint);
})();
