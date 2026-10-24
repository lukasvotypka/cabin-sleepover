"use strict";

// App part 2: the loading intro (splash canvas) and showing/hiding it.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// --- loading intro ---

function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

// First reveal of the map: wait until the splash has been up for its minimum time. Later states
// during the wait only update app.state; there is never more than one timer.
function revealWhenReady() {
  if (app.introDone || app.introTimer !== null || app.codeOpen) return;
  var wait = bootRemaining(app.introStart, performance.now(), bootMinMs(prefersReducedMotion()));
  app.introTimer = setTimeout(function () {
    app.introTimer = null;
    if (app.introDone || !app.state || app.codeOpen) return;
    app.introDone = true;
    render();
    if (app.panel && app.panel.refresh) app.panel.refresh();
    startFall();
  }, wait);
}

// --- the splash picture: a canvas of square blocks that falls apart downwards ---

// splash.pic / splash.delays are filled by drawSplash(); the rest is the fall in progress.
function resetSplash() {
  splash.falling = false;
  splash.raf = 0;
  splash.endTimer = null;
  splash.resizeFrame = 0;
  splash.lastStep = -1;
  splash.start = 0;
}

// Size the canvas from #boot, build the block grid and paint the still picture. Layout is read here
// (and at the start of the fall), never inside the fall loop.
function drawSplash() {
  var boot = $("boot"), canvas = $("bootCanvas");
  if (boot.hidden || splash.falling) return;
  var box = boot.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  var grid = splashGrid(box.width, box.height);
  var pic = splashPicture(grid.cols, grid.rows);
  canvas.width = Math.round(box.width * dpr);
  canvas.height = Math.round(box.height * dpr);
  splash.ctx = canvas.getContext("2d");
  splash.ctx.imageSmoothingEnabled = false;
  splash.dpr = dpr;
  splash.size = grid.size;
  splash.cols = grid.cols;
  splash.rows = grid.rows;
  splash.height = box.height;
  // Block edges in whole device pixels, shared by neighbours, so there are no seams at fractional ratios.
  splash.xs = [];
  splash.ys = [];
  var i;
  for (i = 0; i <= grid.cols; i++) splash.xs.push(Math.round(i * grid.size * dpr));
  for (i = 0; i <= grid.rows; i++) splash.ys.push(Math.round(i * grid.size * dpr));
  splash.colors = [];
  splash.delays = [];
  for (var r = 0; r < grid.rows; r++) {
    for (var c = 0; c < grid.cols; c++) {
      splash.colors.push(COLORS[pic[r][c]]);
      splash.delays.push(splashDelay(c, r, grid.cols, grid.rows));
    }
  }
  paintSplash(-1);
}

// Clear the canvas and draw every block at its place, moved by splashFall() elapsedMs into the fall.
// A negative elapsedMs draws the still picture.
function paintSplash(elapsedMs) {
  var ctx = splash.ctx;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  var fallPx = splash.height + splash.size;
  for (var r = 0; r < splash.rows; r++) {
    var y0 = splash.ys[r], h = splash.ys[r + 1] - y0;
    for (var c = 0; c < splash.cols; c++) {
      var i = r * splash.cols + c;
      var dx = 0, dy = 0;
      if (elapsedMs >= 0) {
        var off = splashFall(elapsedMs, splash.delays[i], fallPx, splash.size);
        if (off.dy >= fallPx) continue;     // already below the screen
        dx = Math.round(off.dx * splash.dpr);
        dy = Math.round(off.dy * splash.dpr);
      }
      ctx.fillStyle = splash.colors[i];
      ctx.fillRect(splash.xs[c] + dx, y0 + dy, splash.xs[c + 1] - splash.xs[c], h);
    }
  }
}

// Start the fall of the splash. The map is already drawn underneath. With reduced motion there is no fall.
function startFall() {
  holdIntroZoom();      // the map waits on the intro's start view under the splash
  if (bootFallMs(prefersReducedMotion()) === 0 || $("boot").hidden || !splash.ctx) {
    finishSplash();
    return;
  }
  splash.falling = true;
  splash.start = performance.now();
  splash.lastStep = -1;
  $("boot").classList.add("boot--falling");
  splash.endTimer = setTimeout(function () {      // not rAF: that stops in a background tab
    finishSplash();
  }, BOOT_FALL_MS);
  fallFrame();
}

// The splash is gone: ask „Kto si?“ if needed, then (once per page load) the intro zoom.
function finishSplash() {
  hideBoot();
  openWhoIfAsked();
  startIntroZoom();
}

// Time comes from the clock, not from a frame count. The canvas is redrawn only when the step changes.
function fallFrame() {
  splash.raf = 0;
  if (!splash.falling) return;
  var elapsed = performance.now() - splash.start;
  var step = Math.floor(elapsed / SPLASH_STEP_MS);
  if (step !== splash.lastStep) {
    splash.lastStep = step;
    paintSplash(elapsed);
  }
  splash.raf = requestAnimationFrame(fallFrame);
}

// Stop a fall in progress and free the canvas, then hide the splash.
function hideBoot() {
  var boot = $("boot"), canvas = $("bootCanvas");
  if (splash.raf) cancelAnimationFrame(splash.raf);
  if (splash.endTimer !== null) clearTimeout(splash.endTimer);
  if (splash.resizeFrame) cancelAnimationFrame(splash.resizeFrame);
  resetSplash();
  boot.classList.remove("boot--error", "boot--falling");
  boot.hidden = true;
  splash.ctx = null;
  canvas.width = canvas.height = 0;
}

// Show the splash again (after the code, before the first reveal) and draw it.
function showBoot() {
  $("bootText").textContent = "Načítavam…";
  $("boot").classList.remove("boot--error", "boot--falling");
  $("boot").hidden = false;
  drawSplash();
}

// A rotation or a resized window during the hold: redraw on the next frame. Resizes during the fall are ignored.
window.addEventListener("resize", function () {
  if ($("boot").hidden || splash.falling || splash.resizeFrame) return;
  splash.resizeFrame = requestAnimationFrame(function () {
    splash.resizeFrame = 0;
    drawSplash();
  });
});

// A move belongs to the party that started it, so a change of *moja partia* ends it.
