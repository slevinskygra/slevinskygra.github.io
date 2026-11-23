/*
  Fig. 1 on the home page: an interactive sketch (not a simulation) of an
  electrolyte confined between two walls that carry a mirror-symmetric pattern
  of surface charge and active cation fluxes. Cations are emitted at the
  positive patches and absorbed at the negative ones. The mean flow U follows
  the normal form of a supercritical pitchfork bifurcation,
        tau dU/dt = eps U - U^3 + noise,   eps ∝ (j - j_c),
  so above the critical flux the channel picks a flow direction at random.
  Based on Leyva, Shrestha & Olvera de la Cruz, Phys. Rev. Lett. 137, 148202 (2026).
*/
(function () {
  "use strict";

  var root = document.querySelector("[data-channel]");
  if (!root) return;

  var canvas = root.querySelector("canvas.channel");
  var traceCanvas = root.querySelector("canvas.trace");
  var slider = root.querySelector("input[type=range]");
  var restartBtn = root.querySelector("[data-restart]");
  var playBtn = root.querySelector("[data-play]");
  var readout = root.querySelector("[data-readout]");
  var ctx = canvas.getContext("2d");
  var tctx = traceCanvas ? traceCanvas.getContext("2d") : null;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var COL = {
    band: "#f3f5f8",
    wall: "#7a8491",
    wallDark: "#5f6874",
    cation: "#c42b3b",
    anion: "#1d5fa6",
    ink: "#1d2733",
    muted: "#5b6676",
    tracer: "rgba(29,39,51,0.34)"
  };

  // Geometry (CSS pixels)
  var W = 0, H = 0, dpr = 1;
  var WALL = 14;            // wall thickness
  var PERIOD = 300;         // pattern period
  var PATCH = 0.17;         // half-width of each patch, as a fraction of the period

  // State
  var ions = [];
  var tracers = [];
  var U = 0;                // order parameter: mean flow, in units of U_max
  var history = [];
  var HIST = 240;
  var running = false;
  var visible = true;
  var rafId = 0;
  var lastT = 0;

  function rand() { return Math.random(); }
  function gauss() {
    var u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Normalized flux: 0..1 with critical value at 0.5
  function flux() { return slider ? Number(slider.value) / 100 : 0.75; }
  var JC = 0.5;

  // Pattern: positive patch + emission centred at phase 0.5, negative patch +
  // absorption centred at phase 0 (= 1). Mirror symmetric about each centre.
  function phaseAt(x) {
    var p = ((x - W / 2) / PERIOD) + 0.5; // centre the positive patch on screen
    p = p - Math.floor(p);
    return p;
  }
  function patchSign(x) {
    var p = phaseAt(x);
    if (Math.abs(p - 0.5) < PATCH) return 1;
    if (p < PATCH || p > 1 - PATCH) return -1;
    return 0;
  }

  function innerTop() { return WALL; }
  function innerBot() { return H - WALL; }

  function nIons() { return Math.round(Math.max(90, Math.min(200, W * 0.16))); }

  function seed() {
    ions = [];
    tracers = [];
    var n = nIons();
    for (var i = 0; i < n; i++) {
      ions.push({
        x: rand() * W,
        y: innerTop() + 5 + rand() * (innerBot() - innerTop() - 10),
        s: i % 2 === 0 ? 1 : -1,
        on: true
      });
    }
    var m = Math.round(W * 0.09);
    for (var k = 0; k < m; k++) {
      tracers.push({ x: rand() * W, y: innerTop() + 4 + rand() * (innerBot() - innerTop() - 8) });
    }
    U = 0;
    history = [];
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    var oldW = W, oldH = H;
    W = Math.max(280, rect.width);
    H = Math.max(140, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    PERIOD = W < 600 ? 220 : 300;
    WALL = H < 180 ? 12 : 14;
    if (oldW && ions.length) {
      var sx = W / oldW, sy = (H - 2 * WALL) / Math.max(1, oldH - 2 * WALL);
      ions.forEach(function (p) { p.x *= sx; p.y = WALL + (p.y - WALL) * sy; });
      tracers.forEach(function (p) { p.x *= sx; p.y = WALL + (p.y - WALL) * sy; });
    } else {
      seed();
    }
    if (traceCanvas) {
      var r2 = traceCanvas.getBoundingClientRect();
      traceCanvas.width = Math.round(r2.width * dpr);
      traceCanvas.height = Math.round(r2.height * dpr);
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  // Flow profile across the channel (blunt, electro-osmotic-like plug)
  function profile(y) {
    var c = (innerTop() + innerBot()) / 2;
    var h = (innerBot() - innerTop()) / 2;
    var e = (y - c) / h;
    return Math.max(0, 1 - Math.pow(Math.abs(e), 4));
  }

  function step(dt) {
    var j = flux();
    // Order-parameter dynamics (pitchfork normal form with noise)
    var eps = 2.4 * (j - JC);
    var tau = 0.45;
    U += (dt / tau) * (eps * U - U * U * U) + 0.08 * Math.sqrt(dt) * gauss();
    if (U > 1.2) U = 1.2;
    if (U < -1.2) U = -1.2;

    var vmax = Math.min(150, W * 0.16); // px/s at |U| = 1
    var D = 380;                         // px^2/s, ion diffusivity
    var top = innerTop(), bot = innerBot();
    var range = 26;                      // range of wall interaction (px)
    var kWall = 260;                     // strength of wall–ion interaction

    // Active fluxes: emission rate grows with j (pool of absorbed cations)
    var pool = [];
    for (var i = 0; i < ions.length; i++) if (!ions[i].on) pool.push(ions[i]);
    var emitRate = 60 * j; // cations per second
    var nEmit = Math.floor(emitRate * dt + rand());
    while (nEmit-- > 0 && pool.length) {
      var p = pool.pop();
      // pick an emission site (positive patch) on either wall, near the screen
      var nPer = Math.ceil(W / PERIOD) + 1;
      var kx = Math.floor(rand() * nPer) - Math.floor(nPer / 2);
      var cx = W / 2 + kx * PERIOD + (rand() - 0.5) * 2 * PATCH * PERIOD * 0.9;
      p.x = ((cx % W) + W) % W;
      p.y = rand() < 0.5 ? top + 2 + rand() * 3 : bot - 2 - rand() * 3;
      p.on = true;
    }

    for (var n = 0; n < ions.length; n++) {
      var a = ions[n];
      if (!a.on) continue;
      var u = U * vmax * profile(a.y);
      var fx = 0, fy = 0;
      var q = patchSign(a.x);
      if (q !== 0) {
        var dTop = a.y - top, dBot = bot - a.y;
        // attraction (opposite sign) or repulsion (same sign) normal to the wall
        var sgn = -a.s * q; // +1 attract, -1 repel
        if (dTop < range) fy -= sgn * kWall * (1 - dTop / range);
        if (dBot < range) fy += sgn * kWall * (1 - dBot / range);
      }
      a.x += (u + fx) * dt + Math.sqrt(2 * D * dt) * gauss();
      a.y += fy * dt + Math.sqrt(2 * D * dt) * gauss();
      // walls: reflect
      if (a.y < top + 3) a.y = top + 3 + (top + 3 - a.y);
      if (a.y > bot - 3) a.y = bot - 3 - (a.y - (bot - 3));
      // periodic in x
      if (a.x < 0) a.x += W;
      if (a.x >= W) a.x -= W;
      // absorption of cations at the negative patches
      if (a.s > 0 && q < 0 && j > 0.02) {
        if (a.y < top + 6 || a.y > bot - 6) {
          if (rand() < 6 * j * dt) a.on = false;
        }
      }
    }

    for (var t = 0; t < tracers.length; t++) {
      var tr = tracers[t];
      tr.x += U * vmax * profile(tr.y) * dt + Math.sqrt(2 * 40 * dt) * gauss();
      tr.y += Math.sqrt(2 * 40 * dt) * gauss();
      if (tr.y < top + 3) tr.y = top + 3;
      if (tr.y > bot - 3) tr.y = bot - 3;
      if (tr.x < 0) tr.x += W;
      if (tr.x >= W) tr.x -= W;
    }

    history.push(U);
    if (history.length > HIST) history.shift();
  }

  function drawWall(y0, h, isTop) {
    ctx.fillStyle = COL.wall;
    ctx.fillRect(0, y0, W, h);
    var start = W / 2 - Math.ceil(W / 2 / PERIOD + 1) * PERIOD;
    for (var x0 = start; x0 < W + PERIOD; x0 += PERIOD) {
      // positive patch centred at x0 (with emission arrows)
      var pw = 2 * PATCH * PERIOD;
      ctx.fillStyle = COL.cation;
      ctx.fillRect(x0 - pw / 2, isTop ? y0 + h - 5 : y0, pw, 5);
      // negative patch centred at x0 + PERIOD/2 (with absorption arrows)
      ctx.fillStyle = COL.anion;
      ctx.fillRect(x0 + PERIOD / 2 - pw / 2, isTop ? y0 + h - 5 : y0, pw, 5);
      // arrows: emission points into the channel, absorption into the wall
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.2;
      for (var k = -1; k <= 1; k++) {
        arrow(x0 + k * pw * 0.3, y0, h, isTop, true);
        arrow(x0 + PERIOD / 2 + k * pw * 0.3, y0, h, isTop, false);
      }
    }
  }

  // small chevron inside the wall: out = emission (towards channel)
  function arrow(x, y0, h, isTop, out) {
    var mid = isTop ? y0 + (h - 5) / 2 : y0 + 5 + (h - 5) / 2;
    var pointsDown = isTop ? out : !out;
    var d = pointsDown ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x - 2.6, mid - 1.6 * d);
    ctx.lineTo(x, mid + 1.6 * d);
    ctx.lineTo(x + 2.6, mid - 1.6 * d);
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = COL.band;
    ctx.fillRect(0, 0, W, H);

    // tracers (solvent)
    ctx.fillStyle = COL.tracer;
    for (var t = 0; t < tracers.length; t++) {
      ctx.fillRect(tracers[t].x - 1.2, tracers[t].y - 1.2, 2.4, 2.4);
    }

    // ions
    var r = W < 500 ? 3 : 3.6;
    for (var pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass === 0 ? COL.anion : COL.cation;
      ctx.beginPath();
      for (var i = 0; i < ions.length; i++) {
        var a = ions[i];
        if (!a.on) continue;
        if ((pass === 0 && a.s > 0) || (pass === 1 && a.s < 0)) continue;
        ctx.moveTo(a.x + r, a.y);
        ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    drawWall(0, WALL, true);
    drawWall(H - WALL, WALL, false);

    // flow arrow, fades in with |U|
    var mag = Math.min(1, Math.abs(U));
    if (mag > 0.12) {
      var dir = U > 0 ? 1 : -1;
      var cx = W / 2, cy = H / 2, len = Math.min(150, W * 0.2);
      ctx.save();
      ctx.globalAlpha = Math.min(1, (mag - 0.12) * 1.6);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (var pass2 = 0; pass2 < 2; pass2++) {
        ctx.strokeStyle = pass2 === 0 ? "rgba(255,255,255,0.9)" : COL.ink;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = pass2 === 0 ? 7 : 3;
        ctx.beginPath();
        ctx.moveTo(cx - dir * len / 2, cy);
        ctx.lineTo(cx + dir * (len / 2 - 10), cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + dir * len / 2, cy);
        ctx.lineTo(cx + dir * (len / 2 - 14), cy - 8);
        ctx.lineTo(cx + dir * (len / 2 - 14), cy + 8);
        ctx.closePath();
        ctx.fill();
        if (pass2 === 0) ctx.stroke();
      }
      ctx.restore();
    }

    drawTrace();
    updateReadout();
  }

  function drawTrace() {
    if (!tctx) return;
    var w = traceCanvas.width / dpr, h = traceCanvas.height / dpr;
    tctx.clearRect(0, 0, w, h);
    tctx.strokeStyle = "#dce1e8";
    tctx.lineWidth = 1;
    tctx.beginPath();
    tctx.moveTo(0, h / 2); tctx.lineTo(w, h / 2);
    tctx.stroke();
    if (history.length < 2) return;
    tctx.strokeStyle = COL.ink;
    tctx.lineWidth = 1.4;
    tctx.beginPath();
    for (var i = 0; i < history.length; i++) {
      var x = (i / (HIST - 1)) * w;
      var y = h / 2 - (history[i] / 1.25) * (h / 2 - 3);
      if (i === 0) tctx.moveTo(x, y); else tctx.lineTo(x, y);
    }
    tctx.stroke();
  }

  var lastLabel = "";
  function updateReadout() {
    if (!readout) return;
    var label;
    if (Math.abs(U) < 0.15) label = flux() < JC ? "none (below critical flux)" : "none yet";
    else label = U > 0 ? "to the right" : "to the left";
    if (label !== lastLabel) {
      readout.textContent = label;
      lastLabel = label;
    }
  }

  function frame(t) {
    if (!running) return;
    var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
    lastT = t;
    // two half-steps for stability
    step(dt / 2);
    step(dt / 2);
    draw();
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || !visible) return;
    running = true;
    lastT = 0;
    rafId = requestAnimationFrame(frame);
    if (playBtn) playBtn.textContent = "Pause";
  }
  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    if (playBtn) playBtn.textContent = "Play";
  }

  function restart() {
    seed();
    if (!running) {
      // advance silently so the static frame shows the outcome
      for (var i = 0; i < 360; i++) step(1 / 60);
      draw();
    }
  }

  // Events
  if (restartBtn) restartBtn.addEventListener("click", restart);
  canvas.addEventListener("click", restart);
  if (slider) slider.addEventListener("input", function () { if (!running) { for (var i = 0; i < 240; i++) step(1 / 60); draw(); } });
  if (playBtn) {
    playBtn.addEventListener("click", function () {
      userPaused = running;
      if (running) stop(); else start();
    });
  }
  var userPaused = reduceMotion;

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else if (!userPaused) start();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (!visible) { if (running) { stop(); } }
      else if (!userPaused) start();
    }, { threshold: 0.05 }).observe(canvas);
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(function () { resize(); draw(); }).observe(canvas);
  } else {
    window.addEventListener("resize", function () { resize(); draw(); });
  }

  resize();
  if (reduceMotion) {
    for (var i = 0; i < 360; i++) step(1 / 60);
    draw();
    if (playBtn) playBtn.textContent = "Play";
  } else {
    draw();
    start();
  }
})();
