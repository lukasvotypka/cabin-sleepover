"use strict";

// App part: day and night light layer, clock board and the time-lapse when a night is tapped (T-111).
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
  anim: null,        // {raf, start, from, to, dur, night, swapAt, dir} while the clock runs
  hideTimer: 0,
  iconNight: null
};

// The night whose figures are drawn: the old one until the swap hour during a time-lapse.
function drawnNight() {
  return app.shownNight || app.night;
}

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
  dn.hour = dn.anim ? dn.hour : dnNoon(app.night);
  dnPaint(dn.hour);
}

function dnPaint(h) {
  var fx = dn.fx;
  if (!fx || h === null) return;
  var l = lightAt(h);
  dnVis(fx, "dark", fx.dark, l.dark);
  dnVis(fx, "dusk", fx.dusk, l.dusk);
  dnVis(fx, "lamp", fx.lamp, l.lamp);
  dnVis(fx, "fireflies", fx.fireflies, l.fireflies);
  dnVis(fx, "boardShade", fx.boardShade, l.dark * 0.25);
  dnWrap(fx.layer, fx.vis.dark || fx.vis.dusk || fx.vis.lamp || fx.vis.fireflies, fx, "layer");
  dnWrap(fx.shadeLayer, fx.vis.boardShade, fx, "shadeLayer");
  if (fx.bird) fx.bird.setAttribute("opacity", l.bird.toFixed(3));
  if (dn.anim) dnPaintClock(h);
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

// At rest the light follows the night chosen by any means (login, create, SSE): called by render().
function dnSync() {
  if (dn.anim || !dn.fx) return;
  var h = dnNoon(app.night);
  if (h === null || h === dn.hour) return;
  dn.hour = h;
  dnPaint(h);
}

// --- clock board ---

function dnPaintClock(h) {
  var nights = app.state.event.nights;
  $("clockText").textContent = clockLabel(h, nights);
  var night = darkness(h) > 0.5;
  if (dn.iconNight !== night) {
    dn.iconNight = night;
    var ic = $("clockIcon"), rows = night ? DN_MOON : DN_SUN;
    clearNode(ic);
    rows.forEach(function (row, y) {
      for (var x = 0; x < 12; x++) {
        if (row.charAt(x) !== ".") svgEl(ic, "rect", { x: x, y: y, width: 1, height: 1, fill: DN_ICON_COLORS[row.charAt(x)] });
      }
    });
  }
  var strip = $("clockStrip"), cells = nights.length * 8 + 1;      // 3-hour cells from first noon to last noon + 1 day
  if (strip.childNodes.length !== cells) {
    clearNode(strip);
    for (var i = 0; i < cells; i++) strip.appendChild(document.createElement("i"));
  }
  Array.prototype.forEach.call(strip.childNodes, function (c, i) {
    var from = 12 + i * 3;
    c.className = (darkness(from + 1.5) > 0.5 ? "night" : "") + (h >= from && h < from + 3 ? " now" : "");
  });
}

// --- time-lapse ---

function dnShow(night) {
  app.shownNight = night === app.night ? null : night;
}

// An instant switch (no tap on a signpost) ends a running time-lapse and shows the new night at once.
function dnStop() {
  if (dn.anim) {
    cancelAnimationFrame(dn.anim.raf);
    dn.anim = null;
    clearTimeout(dn.hideTimer);
    $("clock").classList.remove("on");
    dn.hour = null;
  }
  app.shownNight = null;
  dnSync();
}

// Called by selectNight after app.night changed. Returns true when a time-lapse is (still) running.
function dnStart(prevNight, night) {
  if (prefersReducedMotion() || !dn.fx) return false;
  var to = dnNoon(night);
  if (to === null) return false;
  if (dn.anim) {
    if (dn.anim.to === to) return true;                         // already on its way there
    cancelAnimationFrame(dn.anim.raf);
  } else if (dn.hour === to || dnNoon(prevNight) === null) {
    return false;
  }
  var from = dn.hour, shown = dn.anim ? (app.shownNight || dn.anim.night) : prevNight;
  var dir = to > from ? 1 : -1, swapAt = swapHour(from, to);
  app.shownNight = shown === night ? null : shown;
  if (swapAt === from) dnShow(night);
  clearTimeout(dn.hideTimer);
  $("clock").classList.add("on");
  var a = { raf: 0, start: performance.now(), from: from, to: to, dur: durationMs(from, to), night: night, swapAt: swapAt, dir: dir };
  dn.anim = a;
  dnPaintClock(from);
  a.raf = requestAnimationFrame(dnStep);
  return true;
}

function dnStep(now) {
  var a = dn.anim;
  if (!a) return;
  var p = Math.max(0, Math.min(1, (now - a.start) / a.dur));
  dn.hour = a.from + (a.to - a.from) * ease(p);
  if (app.shownNight && (a.dir > 0 ? dn.hour >= a.swapAt : dn.hour <= a.swapAt)) {
    dnShow(a.night);
    renderBeds();
  }
  dnPaint(dn.hour);
  if (p < 1) { a.raf = requestAnimationFrame(dnStep); return; }
  dn.anim = null;
  dn.hour = a.to;
  if (app.shownNight) { dnShow(a.night); renderBeds(); }
  dnPaint(dn.hour);
  dn.hideTimer = setTimeout(function () { $("clock").classList.remove("on"); }, 900);
}
