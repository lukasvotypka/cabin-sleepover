"use strict";

// App part: day and night (the light itself is in the 3D world, isoLight in app-iso.js), the time rail in the top HUD, the time-lapse and the figure swap at 06:00 (T-111, T-115).
// Pure parts (light curves, labels, durations) are in logic-daynight.js.
// Plain script: top-level names are shared with the other files, so everything here starts with `dn`.

var DN_RAIL_GAP = 6;      // gap between the rail segments in CSS px, the same as between the night stamps (index.html)
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
  sl: null,          // the rail elements: {el, knob, icon, time, segs, w, key, label}
  iconNight: null
};
var DN_SWAP_MS = 500;

function dnNoon(night) {
  return noonOf(night, app.state ? app.state.event.nights : []);
}

// Prepares the scene's day and night state and the rail; called by ensureScene. The world is lit in 3D (isoLight); the signs
// stay unlit so they remain readable.
function dnBuild(svg, layout) {
  var fx = { vis: {}, svg: svg };
  fx.bird = svg.querySelector(".bird");      // the bird is drawn before dnBuild runs
  dn.fx = fx;
  var nights = app.state.event.nights;
  if (dn.hour === null || nightAt(dn.hour, nights) !== app.night) dn.hour = dnNoon(app.night);
  dnBuildRail();
  dnPaint(dn.hour);
}

function dnPaint(h) {
  var fx = dn.fx;
  if (!fx || h === null) return;
  dnSliderPaint(h);
  var l = lightAt(h);
  isoLight(l);      // sky, ground, sun, lamps, campfire and fireflies of the 3D world
  if (fx.vis.sleep !== l.sleep) {      // the „z-z-z“ over the people in the beds (drawZzz)
    fx.vis.sleep = l.sleep;
    fx.svg.classList.toggle("night", l.sleep);
    setCrickets(l.sleep);
  }
  if (fx.bird) fx.bird.setAttribute("opacity", l.bird.toFixed(3));
}

// The shown night always belongs to the time: a night chosen by any other means (login, create, bed sheet, SSE)
// puts the time on its noon, unless the time is already inside that night. Called by render().
function dnSync() {
  if (!dn.fx || !app.state) return;
  dnBuildRail();      // only when the nights changed
  var h = dnNoon(app.night);
  if (dn.sl) dn.sl.w = 0;      // the width is measured again (the bar may have been hidden or resized)
  if (h === null || (dn.hour !== null && nightAt(dn.hour, app.state.event.nights) === app.night)) { if (dn.hour !== null) dnSliderPaint(dn.hour); return; }
  dnCancelAnim();
  dn.hour = h;
  dnPaint(h);
}

// --- rail (HTML in the top HUD, #rail; built once per set of nights, so a redraw of the stamps never replaces the
// knob under a finger or the keyboard focus) ---

var DN_KNOB_GRAB = 22;      // a press this close (CSS px) to the knob grabs it; elsewhere on the rail it starts the time-lapse

function dnBuildRail() {
  var el = $("rail"), nights = app.state.event.nights, key = nights.join(",");
  if (dn.sl && dn.sl.key === key) return;
  dn.drag = null;
  clearNode(el);
  el.classList.remove("dragging");
  var rail = htmlEl("div", { "class": "rail", "aria-hidden": "true" });
  rail.style.gridTemplateColumns = "repeat(" + nights.length + ", 1fr)";
  sliderSegments([0, 0, 100, 1], nights, 0).forEach(function (seg) {
    var node = htmlEl("span", { "class": "seg" });
    node.style.background = railGradient(seg.h0, seg.h1);
    rail.appendChild(node);
  });
  el.appendChild(rail);
  var knob = htmlEl("div", { "class": "knob", "aria-hidden": "true" });
  var icon = svgEl(knob, "svg", { viewBox: "0 0 12 12" });
  var time = htmlEl("span", { "class": "knob-time" });
  knob.appendChild(time);
  el.appendChild(knob);
  var range = sliderRange(nights);
  el.setAttribute("aria-valuemin", String(range.min));
  el.setAttribute("aria-valuemax", String(range.max));
  dn.sl = { el: el, knob: knob, icon: icon, time: time, segs: null, w: 0, key: key, label: null };
  dn.iconNight = null;
  dnRailEvents();
  if (dn.hour !== null) dnSliderPaint(dn.hour);
}

// Moves the knob and sets the texts and the sun or moon on it.
function dnSliderPaint(h) {
  var s = dn.sl;
  if (!s || !app.state) return;
  var nights = app.state.event.nights;
  if (!s.w) {
    s.w = s.el.clientWidth;
    if (!s.w) return;      // hidden (before the scene): painted again when it shows
    s.segs = sliderSegments([0, 0, s.w, 1], nights, DN_RAIL_GAP);
  }
  s.knob.style.left = hourToSceneX(h, s.segs).toFixed(1) + "px";
  var label = clockLabel(h, nights);
  if (label !== s.label) {
    s.label = label;
    s.time.textContent = label;
    s.el.setAttribute("aria-valuenow", String(Math.round(h * 4) / 4));
    s.el.setAttribute("aria-valuetext", sliderValueText(h, nights));
  }
  var night = darkness(h) > 0.5;
  if (dn.iconNight === night) return;
  dn.iconNight = night;
  clearNode(s.icon);
  (night ? DN_MOON : DN_SUN).forEach(function (row, y) {
    for (var x = 0; x < row.length; x++) {
      var c = DN_ICON_COLORS[row.charAt(x)];
      if (c) svgEl(s.icon, "rect", { x: x, y: y, width: 1, height: 1, fill: c });
    }
  });
}

// Drag the knob = move the time; tap on the rail = time-lapse to that hour; keys on the rail.
function dnRailEvents() {
  var s = dn.sl, el = s.el;
  if (el.dataset.bound) return;      // the element lives on; its handlers read `dn.sl`
  el.dataset.bound = "1";
  function over() { return !app.state || !dn.sl || !dn.sl.segs; }
  function localX(e) { return e.clientX - el.getBoundingClientRect().left; }
  el.addEventListener("pointerdown", function (e) {
    if (e.button > 0 || dn.drag) return;
    dnSliderPaint(dn.hour);      // measures the width if needed
    if (over()) return;
    var x = localX(e), kx = hourToSceneX(dn.hour, dn.sl.segs), onKnob = Math.abs(x - kx) <= DN_KNOB_GRAB, off = 0;
    if (onKnob) {
      dnCancelAnim();
      off = kx - x;
      e.preventDefault();
      el.classList.add("dragging");
    }
    dn.drag = { id: e.pointerId, knob: onKnob, off: off };
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* not capturable: the element still gets the events */ }
  });
  el.addEventListener("pointermove", function (e) {
    var d = dn.drag;
    if (!d || d.id !== e.pointerId || !d.knob || over()) return;
    dnSetHour(sceneXToHour(localX(e) + d.off, dn.sl.segs));
  });
  function end(e) {
    var d = dn.drag;
    if (!d || d.id !== e.pointerId) return;
    dn.drag = null;
    el.classList.remove("dragging");
    if (e.type === "pointerup" && !d.knob && !over()) dnGoTo(sceneXToHour(localX(e), dn.sl.segs));
  }
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("keydown", function (e) {
    if (over() || e.altKey || e.ctrlKey || e.metaKey) return;
    var h = sliderKey(e.key, dn.hour, app.state.event.nights);
    if (h === null) return;
    e.preventDefault();
    dnCancelAnim();
    dnSetHour(h);
  });
}

window.addEventListener("resize", function () {
  if (dn.sl) { dn.sl.w = 0; if (dn.hour !== null) dnSliderPaint(dn.hour); }
});

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
