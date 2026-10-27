"use strict";

// App part: day and night (the light itself is in the 3D world, isoLight in app-iso.js), the time slider in the scene, the time-lapse and the figure swap at 06:00 (T-111, T-115).
// Pure parts (light curves, labels, durations) are in logic-daynight.js.
// Plain script: top-level names are shared with the other files, so everything here starts with `dn`.

var DN_SIGN_GAP = 4;      // gap between night signposts, as drawNights uses it
var DN_SUN = ["....1..1....", ".1........1.", "....2222....", "...222222...", ".1222222221.", "..22222222..", "..22222222..", ".1222222221.", "...222222...", "....2222....", ".1........1.", "....1..1...."];
var DN_MOON = ["............", "....3333....", "...33333....", "..3333......", "..333.......", ".3333.......", ".3333.......", "..333.......", "..3333......", "...33333....", "....3333....", "............"];
var DN_ICON_COLORS = { 1: "#D69A2E", 2: "#FFD54A", 3: "#7A8FB8" };

var dn = {
  fx: null,          // the board shade elements of the current svg
  hour: null,        // hours since 00:00 of the first night's day; at rest the noon of app.night
  anim: null,        // {raf, start, from, to, dur} while the time-lapse runs
  drag: null,        // {id, knob, off} while a finger or the mouse is down on the slider
  swap: null,        // {old, night, leave, arrive, start} for DN_SWAP_MS after the shown night changed
  swapTimer: 0,
  sl: null,          // the slider elements of the current svg
  iconNight: null
};
var DN_SWAP_MS = 500;

function dnNoon(night) {
  return noonOf(night, app.state ? app.state.event.nights : []);
}

// Builds the weak tint over the boards (the world itself is lit in 3D) and the slider; called by ensureScene.
function dnBuild(svg, layout, beforeNode, afterNode) {
  var fx = { vis: {} };
  // A weak tint over the boards, so they stay readable at night.
  var shade = svgEl(null, "g", { "aria-hidden": "true", "pointer-events": "none" });
  svg.insertBefore(shade, afterNode);
  fx.shadeLayer = shade;
  shade.setAttribute("transform", isoBlockTransform(app.iso));
  fx.boardShade = svgEl(shade, "g", { opacity: 0 });
  // Only boards that are always drawn: the table, the help sign and one rect per night signpost
  // (not the gaps between them, the locked sign or the key, which may be absent).
  var sc = layout.map.scene, rects = [];
  Object.keys(sc).forEach(function (k) {
    if (k === "meadow" || k === "locked" || k === "key" || k === "nights" || k === "time") return;
    rects.push(app.iso.icons[k] || sc[k]);      // icons stand in the grid, not at their flat plan rects
  });
  if (sc.nights) rects = rects.concat(signpostLayout(sc.nights, app.state.event.nights.length, DN_SIGN_GAP).boards);
  rects.forEach(function (r) {
    var n = svgEl(fx.boardShade, "rect", { x: r[0], y: r[1], width: r[2], height: r[3], fill: "#0B1636" });
    if (r === sc.parties) fx.partyShade = n;
  });
  // Nothing is rendered at rest: hidden elements cost no painting (T-113).
  [shade, fx.boardShade].forEach(function (n) { n.setAttribute("display", "none"); });
  fx.bird = svg.querySelector(".bird");      // the bird is drawn before dnBuild runs
  dn.fx = fx;
  dnFitPartyShade();
  var nights = app.state.event.nights;
  if (dn.hour === null || nightAt(dn.hour, nights) !== app.night) dn.hour = dnNoon(app.night);
  dnBuildSlider(svg, layout, afterNode);
  dnPaint(dn.hour);
}

function dnPaint(h) {
  var fx = dn.fx;
  if (!fx || h === null) return;
  dnSliderPaint(h);
  var l = lightAt(h);
  isoLight(l);      // sky, ground, sun, lamps, campfire and fireflies of the 3D world
  dnVis(fx, "boardShade", fx.boardShade, l.dark * 0.25);
  if (fx.vis.sleep !== l.sleep) {      // the „z-z-z“ over the people in the beds (drawZzz)
    fx.vis.sleep = l.sleep;
    fx.shadeLayer.ownerSVGElement.classList.toggle("night", l.sleep);
    setCrickets(l.sleep);
  }
  dnWrap(fx.shadeLayer, fx.vis.boardShade, fx, "shadeLayer");
  if (fx.bird) fx.bird.setAttribute("opacity", l.bird.toFixed(3));
}

// The party table is only as tall as its rows, so its shade follows the height drawPartyTable reports.
function dnFitPartyShade(height) {
  if (height !== undefined) dn.partyH = height;
  var fx = dn.fx || null;
  var n = fx ? fx.partyShade : null;
  if (n && dn.partyH) n.setAttribute("height", dn.partyH);
}

// Sets the opacity and switches `display` only when the element crosses zero.
function dnVis(fx, key, node, opacity) {
  var on = opacity >= 0.002;
  node.setAttribute("opacity", opacity.toFixed(3));
  if (fx.vis[key] === on) return;
  fx.vis[key] = on;
  if (on) node.removeAttribute("display"); else node.setAttribute("display", "none");
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
  var sl = dn.sl;
  if (sl && sl.key !== app.state.event.nights.join(",")) {
    dnBuildSlider(sl.layer.ownerSVGElement, app.state.layout, sl.layer.nextSibling);
    sl = dn.sl;
  }
  if (sl) { if (app.move) sl.layer.setAttribute("display", "none"); else sl.layer.removeAttribute("display"); }      // not in the move mode
  var h = dnNoon(app.night);
  if (h === null || (dn.hour !== null && nightAt(dn.hour, app.state.event.nights) === app.night)) return;
  dnCancelAnim();
  dn.hour = h;
  dnPaint(h);
}
// --- slider (drawn in the scene at map.scene.time; its own persistent layer above the boards, so a redraw of the
// boards never replaces the knob under a finger or the keyboard focus) ---

var DN_KNOB_GRAB = 44;      // side of the square grab area around the knob, scene units
var DN_TAG_W = 38, DN_TAG_H = 11;

function dnBuildSlider(svg, layout, beforeNode) {
  if (dn.sl && dn.sl.layer.parentNode) dn.sl.layer.parentNode.removeChild(dn.sl.layer);
  dn.sl = null;
  dn.drag = null;
  var sc = layout.map.scene, nights = app.state.event.nights;
  if (!sc.time || !sc.nights) return;
  var r = sc.time, segs = sliderSegments(sc.nights, nights, DN_SIGN_GAP), cy = r[1] + r[3] / 2, range = sliderRange(nights);
  var layer = svgEl(null, "g", { "class": "dn-slider", "data-nights": nights.join(","), style: "touch-action:none" });
  layer.setAttribute("transform", isoBlockTransform(app.iso));
  svg.insertBefore(layer, beforeNode);
  var rail = svgEl(layer, "g", { "aria-hidden": "true" });
  rect(rail, r[0], cy - 4, r[2], 8, COLORS.woodDark);
  rect(rail, r[0] + 1, cy - 3, r[2] - 2, 6, COLORS.woodLight);
  sliderDark(nights).forEach(function (d) {
    var x0 = hourToSceneX(Math.max(range.min, d.from), segs), x1 = hourToSceneX(Math.min(range.max, d.to), segs);
    if (x1 > x0) rect(rail, x0, cy - 2, x1 - x0, 4, COLORS.nightInk);
  });
  var tapTop = r[1] - 2;
  var tap = rect(layer, r[0], tapTop, r[2], r[3] + 4, "transparent", { "class": "hit" });
  var sl = svgEl(layer, "g", { role: "slider", tabindex: "0", "aria-label": "Čas", "data-key": "time" });
  var knob = svgEl(sl, "g");
  rect(knob, -7, cy - 7, 14, 14, COLORS.woodDark);
  rect(knob, -6, cy - 6, 12, 12, COLORS.selected);
  rect(knob, -DN_KNOB_GRAB / 2, cy - DN_KNOB_GRAB / 2, DN_KNOB_GRAB, DN_KNOB_GRAB, "transparent", { "class": "hit" });
  var icon = svgEl(knob, "g", { "aria-hidden": "true" });
  var tag = svgEl(sl, "g", { "aria-hidden": "true", "pointer-events": "none" });
  rect(tag, 0, cy - DN_TAG_H / 2, DN_TAG_W, DN_TAG_H, COLORS.woodDark);
  rect(tag, 1, cy - DN_TAG_H / 2 + 1, DN_TAG_W - 2, DN_TAG_H - 2, COLORS.paper);
  var text = addText(tag, DN_TAG_W / 2, cy + 2.6, "", 7, COLORS.ink, { anchor: "middle", bold: true });
  sl.setAttribute("aria-valuemin", String(range.min));
  sl.setAttribute("aria-valuemax", String(range.max));
  dn.sl = { layer: layer, sl: sl, knob: knob, icon: icon, tag: tag, text: text, label: null, segs: segs, rect: r, tap: tap, key: nights.join(",") };
  dn.iconNight = null;
  dnSliderEvents();
  if (dn.hour !== null) dnSliderPaint(dn.hour);
}

// Moves the knob and the tag and sets the texts; the tag flips to the left of the knob near the right end.
function dnSliderPaint(h) {
  var s = dn.sl;
  if (!s || !app.state) return;
  var nights = app.state.event.nights, x = hourToSceneX(h, s.segs), r = s.rect;
  s.knob.setAttribute("transform", "translate(" + x.toFixed(2) + ",0)");
  var tx = x + 11 + DN_TAG_W > r[0] + r[2] ? x - 11 - DN_TAG_W : x + 11;
  s.tag.setAttribute("transform", "translate(" + tx.toFixed(2) + ",0)");
  var label = clockLabel(h, nights);
  if (label !== s.label) {
    s.label = label;
    s.text.textContent = label;
    s.sl.setAttribute("aria-valuenow", String(Math.round(h * 4) / 4));
    s.sl.setAttribute("aria-valuetext", sliderValueText(h, nights));
  }
  var night = darkness(h) > 0.5;
  if (dn.iconNight === night) return;
  dn.iconNight = night;
  clearNode(s.icon);
  var cy = r[1] + r[3] / 2;
  if (night) drawMoon(s.icon, -3, cy - 4); else drawSun(s.icon, -4, cy - 4);
}

// Scene x of a pointer event, right at any zoom.
function dnSceneX(e) {
  var m = dn.sl.layer.getScreenCTM(), svg = dn.sl.layer.ownerSVGElement;
  if (!m || !svg) return null;
  var p = svg.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  return p.matrixTransform(m.inverse()).x;
}

// Drag the knob = move the time; tap on the rail = time-lapse to that hour; keys on the knob.
function dnSliderEvents() {
  var s = dn.sl, layer = s.layer;
  function over() { return !app.state || app.move; }
  layer.addEventListener("pointerdown", function (e) {
    if (e.button > 0 || over() || dn.drag) return;
    var x = dnSceneX(e);
    if (x === null) return;
    e.stopPropagation();      // not a map pan, not a tap on what lies under the slider
    var onKnob = s.sl.contains(e.target), off = 0;
    if (onKnob) {
      dnCancelAnim();
      off = hourToSceneX(dn.hour, s.segs) - x;
      e.preventDefault();
    }
    dn.drag = { id: e.pointerId, knob: onKnob, off: off };
    try { layer.setPointerCapture(e.pointerId); } catch (err) { /* not capturable: the layer still gets the events */ }
  });
  layer.addEventListener("pointermove", function (e) {
    var d = dn.drag;
    if (!d || d.id !== e.pointerId || !d.knob) return;
    var x = dnSceneX(e);
    if (x !== null) dnSetHour(sceneXToHour(x + d.off, s.segs));
  });
  layer.addEventListener("pointerup", function (e) {
    var d = dn.drag;
    if (!d || d.id !== e.pointerId) return;
    dn.drag = null;
    var x = dnSceneX(e);
    if (!d.knob && x !== null && !over()) dnGoTo(sceneXToHour(x, s.segs));
  });
  layer.addEventListener("pointercancel", function () { dn.drag = null; });
  s.sl.addEventListener("keydown", function (e) {
    if (over() || e.altKey || e.ctrlKey || e.metaKey) return;
    var h = sliderKey(e.key, dn.hour, app.state.event.nights);
    if (h === null) return;
    e.preventDefault();
    e.stopPropagation();
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
