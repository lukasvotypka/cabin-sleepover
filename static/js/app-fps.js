"use strict";

// App part: the fps meter, a developer aid that is off for everyone by default. `?fps=1` in the page address turns it
// on for this device, `?fps=0` off (pure parts in logic-iso.js). The 3D frame loop in app-iso.js reports each render
// to isoFpsSample; this file owns the only timer, which refreshes the line twice a second while the meter is on.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

var ISO_FPS_WINDOW_MS = 2000;
var isoFps = { on: false, node: null, samples: [], timer: 0, gl: null, timer2: undefined, open: null, pending: [], gpuMs: null, calls: 0, tris: 0 };

function isoFpsInit() {
  var m = /[?&]fps=([01])(?:&|$)/.exec(location.search);
  if (m) { if (m[1] === "1") storage.set(KEYS.fps, "1"); else storage.remove(KEYS.fps); }
  isoFps.on = fpsSetting(location.search, storage.get(KEYS.fps));
  if (!isoFps.on) return;
  isoFps.node = htmlEl("div", { "class": "fps-meter", "aria-hidden": "true" });
  document.body.appendChild(isoFps.node);
  isoFps.timer = setInterval(isoFpsShow, 500);
  isoFpsShow();
}

// GPU frame time: EXT_disjoint_timer_query_webgl2 when the browser offers it (often not, then the meter says „gpu ?“).
// A query is started before a render and read a few frames later, when its result is ready.
function isoFpsGpuBegin(gl) {
  if (isoFps.timer2 === undefined) isoFps.timer2 = gl.getExtension ? gl.getExtension("EXT_disjoint_timer_query_webgl2") : null;
  var ext = isoFps.timer2;
  if (!ext || !gl.createQuery || isoFps.pending.length > 6) return;
  isoFps.gl = gl;
  isoFps.open = gl.createQuery();
  gl.beginQuery(ext.TIME_ELAPSED_EXT, isoFps.open);
}

function isoFpsGpuEnd() {
  var gl = isoFps.gl, ext = isoFps.timer2;
  if (!gl || !ext) return;
  if (isoFps.open) {
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    isoFps.pending.push(isoFps.open);
    isoFps.open = null;
  }
  var disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
  while (isoFps.pending.length && gl.getQueryParameter(isoFps.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
    var q = isoFps.pending.shift();
    if (!disjoint) isoFps.gpuMs = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
    gl.deleteQuery(q);
  }
}

// `info` is renderer.info.render of the frame just drawn (draw calls and triangles).
function isoFpsSample(started, info) {
  var end = performance.now();
  isoFps.samples.push({ at: started, ms: end - started });
  while (isoFps.samples.length && end - isoFps.samples[0].at > ISO_FPS_WINDOW_MS) isoFps.samples.shift();
  if (info) { isoFps.calls = info.calls; isoFps.tris = info.triangles; }
  isoFpsGpuEnd();
}

function isoFpsShow() {
  if (!isoFps.node) return;
  var ratio = iso3 ? iso3.renderer.getPixelRatio() : 0;
  isoFps.node.textContent = iso3 && !iso3.lost ? fpsText(fpsStats(isoFps.samples, performance.now(), ISO_FPS_WINDOW_MS), Math.round(ratio * 100) / 100,
    { ms: isoFps.gpuMs, calls: isoFps.calls, tris: isoFps.tris }, { level: isoQuality.level, soft: ISO_QUALITY[isoQuality.level].soft }) : "3D off";
}

isoFpsInit();

