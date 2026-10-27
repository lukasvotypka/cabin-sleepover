"use strict";

// App part: turning the map to one of the four view angles (T-143). The angle is kept in `app.viewAngle` and in the browser
// storage (`cabin-view-angle`); every angle-dependent part (projection, walls, roofs, sun, hit regions, boards) is rebuilt
// by ensureScene() because the angle is part of its layout key. T-144 adds the buttons and the swing on top of this.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// Turns the map to `angle` (45, 135, 225 or 315; anything else is 45) and keeps the view: a map at rest lands on the
// new rest view, a zoomed one keeps the plan point under the middle of the screen and its zoom (isoTurnView). Open houses stay open.
function setViewAngle(angle) {
  angle = isoAngle(angle);
  if (angle === app.viewAngle) return;
  storage.set(KEYS.angle, String(angle));
  var from = app.iso, oldView = app.view, oldRest = app.bounds && app.sceneSize ? appRestView(app.bounds) : null;
  app.viewAngle = angle;
  if (!from || !oldView) return;      // nothing drawn yet: the first ensureScene uses the new angle
  stopHouseTween();
  housesZooming = true;      // the zoom rule must not look at the view while it is rebuilt
  render();
  if (app.iso !== from) {
    setView(isoTurnView(from, app.iso, oldView, oldRest, appRestView(app.bounds), app.bounds));
    housesLastW = app.view.w;
  }
  housesZooming = false;
}

// The next angle after `steps` quarter turns (+1 = the map turns clockwise on screen).
function turnViewAngle(steps) {
  setViewAngle(isoTurnAngle(app.viewAngle, steps));
}

// --- the turn buttons and the swing (T-144) ---

var TURN_SWING_MS = 500, TURN_FADE_MS = 120;
// A 16x16 pixel arrow, a circle arc with a head on its left end (the right button shows it mirrored).
var TURN_ARROW = [[5, 2, 6], [3, 3, 2], [11, 3, 2], [2, 4, 2], [12, 4, 2], [2, 5, 2], [13, 5, 1], [2, 6, 2], [13, 6, 1],
  [0, 7, 6], [13, 7, 1], [1, 8, 4], [13, 8, 1], [2, 9, 2]];

function turnButton(side, label, steps) {
  var btn = htmlEl("button", { "class": "turn-btn " + side, type: "button", "aria-label": label, title: label });
  var svg = svgEl(btn, "svg", { viewBox: "0 0 16 16", "aria-hidden": "true", "shape-rendering": "crispEdges" });
  var g = svgEl(svg, "g", side === "cw" ? { transform: "translate(16 0) scale(-1 1)" } : null);      // the right arrow is the left one mirrored
  TURN_ARROW.forEach(function (r) { svgEl(g, "rect", { x: r[0], y: r[1], width: r[2], height: 1, fill: "#2E1F14" }); });
  btn.addEventListener("click", function () { turnMap(steps); });
  return btn;
}

$("turnBar").appendChild(turnButton("ccw", "Otočiť mapu doľava", -1));
$("turnBar").appendChild(turnButton("cw", "Otočiť mapu doprava", 1));

// The buttons show with the map once the intro zoom is over (panels hide them by CSS).
function turnBarShown() {
  return !!app.iso && !!app.view && app.introDone && !$("scene").hidden && !introActive();
}

function syncTurnBar() {
  var on = turnBarShown();
  $("turnBar").hidden = !on;
  if (app.zoomReset) app.zoomReset.classList.toggle("above", on);
}

function announceAngle() {
  $("turnStatus").textContent = isoAngleText(app.viewAngle);
}

var swing = null;      // the running swing, also app.swing while the camera follows it

// Turns the map by `steps` quarter turns (+1 = clockwise on screen): swings the camera, or switches at once with reduced motion.
function turnMap(steps) {
  if (!turnBarShown() && !swing) return;
  if (swing) { swing.queued = Math.max(-1, Math.min(1, swing.queued + steps)); return; }      // the swing in progress finishes first, then at most one more turn follows
  if (prefersReducedMotion() || !iso3) {
    turnViewAngle(steps);
    announceAngle();
    return;
  }
  beginSwing(steps, false);
}

function beginSwing(steps, hidden) {
  var target = isoTurnAngle(app.viewAngle, steps);
  swing = app.swing = { from: app.iso, oldView: app.view, fromAngle: app.viewAngle, steps: steps, target: target, t0: performance.now(),
    swapped: false, queued: 0, scene: null, view: null, az: app.viewAngle, sunAz: null, endAt: 0 };
  $("scene").classList.add("swinging");
  $("scene").classList.toggle("swing-half", !hidden);
  if (!hidden) swing.fadeStart = swing.t0;
  requestAnimationFrame(swingFrame);
}

function swingFrame(now) {
  var sw = swing;
  if (!sw) return;
  var host = $("scene");
  if (!sw.endAt) {
    var p = Math.min(1, (now - sw.t0) / TURN_SWING_MS), e = isoEase(p);
    if (sw.fadeStart !== undefined) host.classList.toggle("swing-half", now - sw.fadeStart < TURN_FADE_MS / 2);      // 0.5, then 0
    if (!sw.swapped && p >= 0.5) {      // the walls and roofs swap when the motion hides it
      sw.swapped = true;
      setViewAngle(sw.target);
      sw.final = app.view;
    }
    sw.az = isoSwingAzimuth(sw.fromAngle, sw.steps, p);
    if (app.iso && app.state) {
      sw.scene = isoScene(app.state.layout, { azimuth: sw.az });
      var pv = isoSwingView(sw.from, sw.scene, sw.oldView, app.state.layout), u = sw.swapped ? Math.max(0, Math.min(1, (e - 0.5) * 2)) : 0;
      sw.view = !u ? pv : { x: pv.x + (sw.final.x - pv.x) * u, y: pv.y + (sw.final.y - pv.y) * u, w: pv.w + (sw.final.w - pv.w) * u, h: pv.h + (sw.final.h - pv.h) * u };
      if (iso3 && (sw.sunAz === null || Math.abs(sw.az - sw.sunAz) >= 6)) { sw.sunAz = sw.az; iso3.sunDrawn = null; }      // the shadows tick like a sundial
      isoSync();
    }
    if (p < 1) { requestAnimationFrame(swingFrame); return; }
    sw.scene = null;
    app.swing = null;
    if (iso3 && app.iso) isoPose(iso3.camera, app.iso.basis);      // the exact pose of the final angle, not the unwrapped swing azimuth
    isoSync();
    if (sw.queued) { swing = null; beginSwing(sw.queued, true); return; }      // the overlay stays hidden between the swings
    sw.endAt = now;
    if (iso3) iso3.sunDrawn = null;
    announceAngle();
    host.classList.add("swing-half");      // the overlay comes back: 0.5, then 1
  } else if (now - sw.endAt >= TURN_FADE_MS / 2) {
    host.classList.remove("swinging", "swing-half");
    swing = null;
    return;
  }
  requestAnimationFrame(swingFrame);
}

document.addEventListener("keydown", function (e) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  var t = e.target, tag = t && t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable) || app.panel) return;
  var k = e.key && e.key.toLowerCase();
  if (k === "q") turnMap(-1);
  else if (k === "e") turnMap(1);
});
