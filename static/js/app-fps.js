"use strict";

// App part: the fps meter, a developer aid that is off for everyone by default. `?fps=1` in the page address turns it
// on for this device, `?fps=0` off (pure parts in logic-iso.js). The 3D frame loop in app-iso.js reports each render
// to isoFpsSample; this file owns the only timer, which refreshes the line twice a second while the meter is on.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

var ISO_FPS_WINDOW_MS = 2000;
var isoFps = { on: false, node: null, samples: [], timer: 0 };

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

function isoFpsSample(started) {
  var end = performance.now();
  isoFps.samples.push({ at: started, ms: end - started });
  while (isoFps.samples.length && end - isoFps.samples[0].at > ISO_FPS_WINDOW_MS) isoFps.samples.shift();
}

function isoFpsShow() {
  if (!isoFps.node) return;
  var ratio = iso3 ? iso3.renderer.getPixelRatio() : 0;
  isoFps.node.textContent = iso3 && !iso3.lost ? fpsText(fpsStats(isoFps.samples, performance.now(), ISO_FPS_WINDOW_MS), Math.round(ratio * 100) / 100) : "3D off";
}

isoFpsInit();

