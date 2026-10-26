"use strict";

// App part: day and night light layer, the top time slider, the time-lapse and the figure swap at 06:00 (T-111, T-115).
// Pure parts (light curves, labels, durations) are in logic-daynight.js. Each frame only sets `opacity` attributes.
// Plain script: top-level names are shared with the other files, so everything here starts with `dn`.

var DN_ROOM_INSET = 4;
var DN_FIREFLIES = [[60, 250], [104, 300], [250, 450], [330, 430], [40, 380], [200, 230], [350, 250]];   // on the 380 x 496 grass
var DN_SUN = ["....1..1....", ".1........1.", "....2222....", "...222222...", ".1222222221.", "..22222222..", "..22222222..", ".1222222221.", "...222222...", "....2222....", ".1........1.", "....1..1...."];
var DN_MOON = ["............", "....3333....", "...33333....", "..3333......", "..333.......", ".3333.......", ".3333.......", "..333.......", "..3333......", "...33333....", "....3333....", "............"];
var DN_ICON_COLORS = { 1: "#D69A2E", 2: "#FFD54A", 3: "#7A8FB8" };

var dn = {
  fx: null,          // the light layer elements of the current svg
  hour: null,        // hours since 00:00 of the first night's day; at rest the noon of app.night
  anim: null,        // {raf, start, from, to, dur} while the time-lapse runs
  drag: null,        // {id, knob, off} while a finger or the mouse is down on the slider
  swap: null,        // {old, night, leave, arrive, start} for DN_SWAP_MS after the shown night changed
  swapTimer: 0,
  barKey: null,
  iconNight: null
};
var DN_SWAP_MS = 500;

function dnNoon(night) {
  return noonOf(night, app.state ? app.state.event.nights : []);
}

// Builds the light layer (between `walk` and `boards`) and the weak tint over the boards; called by ensureScene.
function dnBuild(svg, layout, beforeNode, afterNode) {
  var vb = layout.map.viewbox, big = { x: -2000, y: -2000, width: 4380, height: 4496 };
  var g = svgEl(null, "g", { "aria-hidden": "true", "pointer-events": "none" });
  svg.insertBefore(g, beforeNode);
  var defs = svgEl(g, "defs");
  var mask = svgEl(defs, "mask", { id: "dnMask", maskUnits: "userSpaceOnUse", x: big.x, y: big.y, width: big.width, height: big.height });
  svgEl(mask, "rect", { x: big.x, y: big.y, width: big.width, height: big.height, fill: "#fff" });
  var rooms = layout.rooms.map(function (r) { return r.rect; });
  var inset = DN_ROOM_INSET;
  rooms.forEach(function (r) {
    svgEl(mask, "rect", { x: r[0] + inset, y: r[1] + inset, width: r[2] - 2 * inset, height: r[3] - 2 * inset, fill: "#5a5a5a" });
  });
  var fx = { rooms: rooms, layer: g, vis: {} };
  var blend = "mix-blend-mode:multiply";
  fx.dusk = svgEl(g, "rect", { x: big.x, y: big.y, width: big.width, height: big.height, fill: "#F08A3C", style: blend, opacity: 0 });
  fx.dark = svgEl(g, "rect", { x: big.x, y: big.y, width: big.width, height: big.height, fill: "#16224A", mask: "url(#dnMask)", style: blend, opacity: 0 });
  fx.lamp = svgEl(g, "g", { opacity: 0 });
  rooms.forEach(function (r) {
    svgEl(fx.lamp, "rect", { x: r[0] + inset, y: r[1] + inset, width: r[2] - 2 * inset, height: r[3] - 2 * inset, fill: "#FFC76A", opacity: ".16" });
  });
  (layout.map.windows || []).forEach(function (w) {
    svgEl(fx.lamp, "rect", { x: w[0] - 4, y: w[1] - 14, width: w[2] + 8, height: 14, fill: "#FFD27A", opacity: ".22" });
    svgEl(fx.lamp, "rect", { x: w[0] + 2, y: w[1] - 8, width: w[2] - 4, height: 8, fill: "#FFD27A", opacity: ".3" });
    svgEl(fx.lamp, "rect", { x: w[0], y: w[1], width: w[2], height: w[3], fill: "#FFE08A" });
  });
  (layout.map.doors || []).forEach(function (d) {
    var below = d[2] > d[3];
    svgEl(fx.lamp, "rect", { x: d[0] - 2, y: d[1] + (below ? d[3] : 0), width: d[2] + 4, height: below ? 10 : d[3], fill: "#FFD27A", opacity: ".25" });
  });
  fx.fireflies = svgEl(g, "g", { opacity: 0 });
  DN_FIREFLIES.forEach(function (p, i) {
    svgEl(fx.fireflies, "rect", {
      x: Math.round(p[0] / 380 * vb[0]), y: Math.round(p[1] / 496 * vb[1]), width: 2, height: 2, fill: "#F6F2A0",
      "class": "dn-ff", style: "animation-delay:-" + (i * 0.7) + "s"
    });
  });
  // A separate, weaker tint over the boards so they stay readable at night.
  var shade = svgEl(null, "g", { "aria-hidden": "true", "pointer-events": "none" });
  svg.insertBefore(shade, afterNode);
  fx.shadeLayer = shade;
  fx.boardShade = svgEl(shade, "g", { opacity: 0 });
  // Only boards that are always drawn: the table, the help sign and one rect per night signpost
  // (not the gaps between them, the locked sign or the key, which may be absent).
  var sc = layout.map.scene, rects = [];
  Object.keys(sc).forEach(function (k) {
    if (k === "meadow" || k === "locked" || k === "key" || k === "nights") return;
    rects.push(sc[k]);
  });
  if (sc.nights) rects = rects.concat(signpostLayout(sc.nights, app.state.event.nights.length, 4).boards);
  rects.forEach(function (r) {
    svgEl(fx.boardShade, "rect", { x: r[0], y: r[1], width: r[2], height: r[3], fill: "#16224A", style: blend });
  });
  // Nothing of the light layer is rendered at rest: hidden elements cost no blend, mask or animation (T-113).
  [g, shade, fx.dusk, fx.dark, fx.lamp, fx.fireflies, fx.boardShade].forEach(function (n) { n.setAttribute("display", "none"); });
  Array.prototype.forEach.call(fx.fireflies.children, function (c) { c.setAttribute("display", "none"); });
  fx.bird = svg.querySelector(".bird");      // the bird is drawn before dnBuild runs
  dn.fx = fx;
  var nights = app.state.event.nights;
  if (dn.hour === null || nightAt(dn.hour, nights) !== app.night) dn.hour = dnNoon(app.night);
  dnBuildBar();
  dnPaint(dn.hour);
}

function dnPaint(h) {
  var fx = dn.fx;
  if (!fx || h === null) return;
  dnBarPaint(h);
  var l = lightAt(h);
  dnVis(fx, "dark", fx.dark, l.dark);
  dnVis(fx, "dusk", fx.dusk, l.dusk);
  dnVis(fx, "lamp", fx.lamp, l.lamp);
  dnVis(fx, "fireflies", fx.fireflies, l.fireflies);
  dnVis(fx, "boardShade", fx.boardShade, l.dark * 0.25);
  dnWrap(fx.layer, fx.vis.dark || fx.vis.dusk || fx.vis.lamp || fx.vis.fireflies, fx, "layer");
  dnWrap(fx.shadeLayer, fx.vis.boardShade, fx, "shadeLayer");
  if (fx.bird) fx.bird.setAttribute("opacity", l.bird.toFixed(3));
}

// Sets the opacity and switches `display` only when the element crosses zero.
function dnVis(fx, key, node, opacity) {
  var on = opacity >= 0.002;
  node.setAttribute("opacity", opacity.toFixed(3));
  if (fx.vis[key] === on) return;
  fx.vis[key] = on;
  if (on) node.removeAttribute("display"); else node.setAttribute("display", "none");
  // Chrome keeps CSS animations running under a hidden ancestor, so hide each firefly itself too.
  if (key === "fireflies") Array.prototype.forEach.call(node.children, function (c) {
    if (on) c.removeAttribute("display"); else c.setAttribute("display", "none");
  });
}

function dnWrap(node, on, fx, key) {
  on = !!on;
  if (fx.vis[key] === on) return;
  fx.vis[key] = on;
  if (on) node.removeAttribute("display"); else node.setAttribute("display", "none");
}

// The shown night always belongs to the time: a night chosen by any other means (login, create, bed sheet, SSE)
// puts the time on its noon, unless the time is already inside that night. Called by render().
function dnSync() {
  if (!dn.fx || !app.state) return;
  var h = dnNoon(app.night);
  if (h === null || (dn.hour !== null && nightAt(dn.hour, app.state.event.nights) === app.night)) return;
  dnCancelAnim();
  dn.hour = h;
  dnPaint(h);
}
// --- slider bar (in the HUD, built once; the scale depends on the nights) ---

function dnPct(h, nights) {
  var r = sliderRange(nights);
  return ((clampHour(h, nights) - r.min) / (r.max - r.min) * 100).toFixed(3) + "%";
}

function dnBuildBar() {
  var nights = app.state.event.nights, key = nights.join(","), strip = $("tsStrip"), knob = $("tsKnob");
  if (dn.barKey === key) return;
  var first = dn.barKey === null;
  dn.barKey = key;
  Array.prototype.slice.call(strip.querySelectorAll(".ts-dark, .ts-day")).forEach(function (n) { strip.removeChild(n); });
  var r = sliderRange(nights);
  sliderDark(nights).forEach(function (d) {
    var from = Math.max(r.min, d.from), to = Math.min(r.max, d.to);
    var n = htmlEl("i", { "class": "ts-dark" });
    n.style.left = dnPct(from, nights);
    n.style.width = ((to - from) / (r.max - r.min) * 100).toFixed(3) + "%";
    strip.insertBefore(n, knob);
  });
  sliderDays(nights).forEach(function (d) {
    var n = htmlEl("span", { "class": "ts-day", "aria-hidden": "true" }, d.label);
    n.style.left = dnPct((d.from + d.to) / 2, nights);
    strip.insertBefore(n, knob);
  });
  knob.setAttribute("aria-valuemin", String(r.min));
  knob.setAttribute("aria-valuemax", String(r.max));
  if (first) dnBarEvents();
}

function dnBarPaint(h) {
  var nights = app.state.event.nights, knob = $("tsKnob");
  $("tsText").textContent = clockLabel(h, nights);
  knob.style.left = dnPct(h, nights);
  knob.setAttribute("aria-valuenow", String(Math.round(h * 4) / 4));
  knob.setAttribute("aria-valuetext", sliderValueText(h, nights));
  var night = darkness(h) > 0.5;
  if (dn.iconNight === night) return;
  dn.iconNight = night;
  var ic = $("tsIcon"), rows = night ? DN_MOON : DN_SUN;
  clearNode(ic);
  rows.forEach(function (row, y) {
    for (var x = 0; x < 12; x++) {
      if (row.charAt(x) !== ".") svgEl(ic, "rect", { x: x, y: y, width: 1, height: 1, fill: DN_ICON_COLORS[row.charAt(x)] });
    }
  });
}

// Drag the knob = move the time; tap on the strip = time-lapse to that hour; keys on the knob.
function dnBarEvents() {
  var track = $("tsTrack"), strip = $("tsStrip"), knob = $("tsKnob");
  function nights() { return app.state.event.nights; }
  function hourAt(clientX, off) {
    var r = strip.getBoundingClientRect();
    return xToHour(clientX - r.left + off, nights(), r.width || 1);
  }
  track.addEventListener("pointerdown", function (e) {
    if (e.button > 0 || !app.state || dn.drag) return;
    var onKnob = knob.contains(e.target), off = 0;
    if (onKnob) {
      dnCancelAnim();
      var r = strip.getBoundingClientRect();
      off = hourToX(dn.hour, nights(), r.width || 1) - (e.clientX - r.left);
    }
    dn.drag = { id: e.pointerId, knob: onKnob, off: off };
    try { track.setPointerCapture(e.pointerId); } catch (err) { /* not capturable: window events are enough */ }
    if (onKnob) e.preventDefault();
  });
  track.addEventListener("pointermove", function (e) {
    if (!dn.drag || dn.drag.id !== e.pointerId || !dn.drag.knob) return;
    dnSetHour(hourAt(e.clientX, dn.drag.off));
  });
  track.addEventListener("pointerup", function (e) {
    var d = dn.drag;
    if (!d || d.id !== e.pointerId) return;
    dn.drag = null;
    if (!d.knob) dnGoTo(hourAt(e.clientX, 0));
  });
  track.addEventListener("pointercancel", function () { dn.drag = null; });
  knob.addEventListener("keydown", function (e) {
    if (!app.state || e.altKey || e.ctrlKey || e.metaKey) return;
    var h = sliderKey(e.key, dn.hour, nights());
    if (h === null) return;
    e.preventDefault();
    dnCancelAnim();
    dnSetHour(h);
  });
}

// --- time ---

function dnCancelAnim() {
  if (!dn.anim) return;
  cancelAnimationFrame(dn.anim.raf);
  dn.anim = null;
}

// Sets the time at once; the shown night follows it (and the figures swap) when it crosses 06:00.
function dnSetHour(h) {
  var nights = app.state.event.nights;
  dn.hour = clampHour(h, nights);
  dnPaint(dn.hour);
  var night = nightAt(dn.hour, nights);
  if (night === app.night) return;
  var old = app.night;
  cancelWalks();
  app.night = night;
  dnStartSwap(old, night);
  render();
  if (app.panel && app.panel.refresh) app.panel.refresh();
}

// Runs the clock to `h` (a retarget starts from the current hour); with reduced motion the time jumps.
function dnGoTo(h) {
  dnCancelAnim();
  if (dn.hour === null) dn.hour = dnNoon(app.night);
  h = clampHour(h, app.state.event.nights);
  if (prefersReducedMotion() || Math.abs(h - dn.hour) < 0.01) { dnSetHour(h); return; }
  dn.anim = { raf: 0, start: performance.now(), from: dn.hour, to: h, dur: durationMs(dn.hour, h) };
  dn.anim.raf = requestAnimationFrame(dnStep);
}

function dnStep(now) {
  var a = dn.anim;
  if (!a) return;
  var p = Math.max(0, Math.min(1, (now - a.start) / a.dur));
  var h = p >= 1 ? a.to : a.from + (a.to - a.from) * ease(p);
  if (p >= 1) dn.anim = null; else a.raf = requestAnimationFrame(dnStep);
  dnSetHour(h);
}

// --- figure swap at 06:00 ---

// Leaving figures fade out of their beds and arriving ones fade in; staying ones are drawn as usual.
function dnStartSwap(old, night) {
  clearTimeout(dn.swapTimer);
  dn.swap = null;
  if (prefersReducedMotion()) return;
  var sl = viewState().state.sleeping || {}, sw = figureSwap(sl[old], sl[night]);
  if (!sw.leave.length && !sw.arrive.length) return;
  dn.swap = { old: old, night: night, leave: sw.leave, arrive: sw.arrive, start: performance.now() };
  dn.swapTimer = setTimeout(function () { dn.swap = null; renderBeds(); }, DN_SWAP_MS + 40);
}

// For drawBed: the old night to ghost out of this slot (or null), whether the new figure fades in, and the
// animation style that continues the effect from where it is when a redraw happens during it.
function dnSlotFx(night, slot) {
  var s = dn.swap;
  if (!s || s.night !== night) return null;
  var out = s.leave.indexOf(slot) !== -1, inn = s.arrive.indexOf(slot) !== -1;
  if (!out && !inn) return null;
  return { old: out ? s.old : null, inn: inn, style: "animation-delay:-" + Math.round(performance.now() - s.start) + "ms" };
}
