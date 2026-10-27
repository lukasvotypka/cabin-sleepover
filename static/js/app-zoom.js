"use strict";

// App part 4: zoom and pan of the map (only the svg viewBox changes).
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// --- zoom and pan: only the svg viewBox changes, the scene stays crisp ---

var BED_TAGS_ZOOM = 1.8;   // from this zoom on, the short bed names show under the beds

function applyView() {
  app.svg.setAttribute("viewBox", viewBoxText(app.view));
  app.svg.classList.toggle("zoomed", viewZoom(app.view, app.bounds) >= BED_TAGS_ZOOM);
  isoSync();      // the 3D world under the svg shows the same part of the scene
  housesZoomRule();      // 1.6x the rest zoom opens all houses, 1.15x closes them (app-houses.js)
  syncTurnBar();
  app.zoomReset.hidden = introActive() || !resetShown(app.view, app.bounds) || atPhoneRest();
}

// The scene x the intro zoom centres on: the title board in the board block.
function introFocusX() {
  var t = app.state && app.state.layout.map.scene.title;
  return t && app.iso ? isoBlockPoint(app.iso, t[0] + t[2] / 2, t[1])[0] : undefined;
}

function setView(view) {
  app.view = view;
  applyView();
}

function resetView() {
  setView(phoneRest() || wholeView(app.bounds));
}

// The rest view of a phone held upright (the content of the scene fitted by width), or null on other screens.
function phoneRest() {
  var px = app.viewportPx || [0, 0];
  return phoneRestView(app.bounds, px[0], px[1], app.sceneContent);
}

function atPhoneRest() {
  var rest = phoneRest();
  return !!rest && sameView(app.view, rest);
}

// The view of the map at rest (whole, or the upright scale on a phone held sideways, see restView).
function appRestView(bounds, px) {
  px = px || app.viewportPx || [0, 0];
  return restView(bounds, app.sceneSize[0], app.sceneSize[1], px[0], px[1], app.sceneContent);
}

// --- the one-time intro zoom: the map starts zoomed on the top of the scene and eases out to the fitted view ---

function introActive() {
  return app.introZoom === "held" || app.introZoom === "running";
}

// At the start of the splash's fall: put the map on the start view under the splash, so there is no jump later.
// Reduced motion or the move mode: no intro.
function holdIntroZoom() {
  if (app.introZoom !== "idle") return;
  if (prefersReducedMotion() || !app.bounds || !app.sceneSize || app.move) {
    app.introZoom = "done";
    return;
  }
  app.introZoom = "held";
  setView(introStartView(app.bounds, app.sceneSize[0], app.sceneSize[1], introFocusX()));
}

// The splash is gone: ease out to the fitted view.
function startIntroZoom() {
  if (app.introZoom !== "held") return;
  app.introZoom = "running";
  app.introZoomAt = performance.now();
  app.introRaf = requestAnimationFrame(introFrame);
}

// Both ends are read each frame, so a re-render or a change of the bounds (the HUD grew) cannot make it jump back.
function introFrame() {
  app.introRaf = 0;
  if (app.introZoom !== "running") return;
  var t = (performance.now() - app.introZoomAt) / INTRO_ZOOM_MS;
  var to = appRestView(app.bounds);
  if (t >= 1) {
    app.introZoom = "done";
    setView(to);
    renderBriefingOffer();
    return;
  }
  var from = introStartView(app.bounds, app.sceneSize[0], app.sceneSize[1], introFocusX());
  setView(introViewAt(from, to, t));
  app.introRaf = requestAnimationFrame(introFrame);
}

// A touch, wheel or key on the map, a resize or the move mode ends the intro where it is (no snap), so the touch
// that stopped it acts on what is under the finger. Still under the splash, it goes back to the fitted view.
// A panel does not stop it: „Kto si?“ opens right after the splash and the map eases out behind its backdrop.
function stopIntroZoom() {
  var was = app.introZoom;
  if (was !== "held" && was !== "running") return;
  if (app.introRaf) cancelAnimationFrame(app.introRaf);
  app.introRaf = 0;
  app.introZoom = "done";
  if (was === "held") setView(appRestView(app.bounds));
  else applyView();
  renderBriefingOffer();
}

["pointerdown", "touchstart", "wheel", "keydown"].forEach(function (type) {
  $("scene").addEventListener(type, stopIntroZoom, { capture: true, passive: true });
});
window.addEventListener("resize", stopIntroZoom);

// The safe-area insets (notch, home bar) in CSS px, read from a probe whose padding is the env() values.
function readInsets() {
  if (!app.insetProbe) {
    app.insetProbe = htmlEl("div", { "class": "inset-probe", "aria-hidden": "true" });
    document.body.appendChild(app.insetProbe);
  }
  var cs = getComputedStyle(app.insetProbe);
  // While the move bar shows, the scene must sit below it: the bar's height (it includes the safe-area top padding)
  // is the top inset when that is larger.
  // Otherwise the scene sits below the quest log of the HUD (its bottom edge includes the safe-area top).
  var bar = $("moveBar"), top = parseFloat(cs.paddingTop);
  if (!bar.hidden) top = Math.max(top, bar.offsetHeight);
  else top = Math.max(top, questBottom());
  // The crest already includes the home-bar inset in its height; the scene must sit above it.
  var bottom = Math.max(parseFloat(cs.paddingBottom), hudHeight());
  return { top: top, right: parseFloat(cs.paddingRight), bottom: bottom, left: parseFloat(cs.paddingLeft) };
}

function setupZoom(host, svg, W, H) {
  var pointers = {};          // id -> {x, y} of the fingers or the mouse button held down on the map
  var drag = null;            // {sx, sy, lx, ly, moved} of the current gesture
  var pinch = null;           // the last {x, y, dist} while two fingers are down
  var blockTimer = null;
  var gestureScale = 1;

  var sizeChanged = !app.sceneSize || app.sceneSize[0] !== W || app.sceneSize[1] !== H;
  app.sceneSize = [W, H];
  if (sizeChanged) app.bounds = app.view = null;
  app.svg = svg;
  app.zoomReset = htmlEl("button", { "class": "zoom-reset", type: "button", "aria-label": "Celá mapa – zobraziť celú mapu" }, "Celá mapa");
  host.appendChild(app.zoomReset);
  svg.setAttribute("tabindex", "-1");     // focus target after „Celá mapa“ hides itself
  refit(true);      // a redraw of the layout keeps the zoom

  // The map fills the viewport: the bounds follow its size (resize, rotation, the Safari toolbar). The zoom stays
  // valid: a zoomed view keeps its factor and center, a whole view stays whole.
  function refit(force) {
    var r = host.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0) && app.bounds) return;      // hidden (the code screen): keep what we have
    var nb = fitBounds(r.width, r.height, W, H, readInsets());
    var old = app.bounds, oldPx = app.viewportPx, px = [r.width, r.height];
    if (!force && old && old.x === nb.x && old.y === nb.y && old.w === nb.w && old.h === nb.h) return;
    // A map at rest stays at rest (a rotation picks the rest view of the new shape); a zoomed one keeps its zoom.
    var resting = !app.view || !old || sameView(app.view, appRestView(old, oldPx));
    app.viewportPx = px;
    app.view = resting ? appRestView(nb, px) : refitView(app.view, old, nb);
    app.bounds = nb;
    drawGround(app.layers.ground, nb);
    applyView();
  }

  function box() {
    var r = svg.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width || 1, height: r.height || 1 };
  }
  function ids() { return Object.keys(pointers); }
  function measure() {
    var a = pointers[ids()[0]], b = pointers[ids()[1]];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2)) };
  }
  function capture(id) {
    try { svg.setPointerCapture(id); } catch (e) { /* the pointer is gone */ }
  }
  function endPress() {      // a pinch or a drag is no long press: pending timers give up
    app.gestureId++;
    app.gestureAt = Date.now();
  }
  // The point may be missing (iOS gesture events have no coordinates): zoom around the center of the map then.
  function zoomAround(factor, cx, cy) {
    var r = box();
    if (!isFinite(cx)) cx = r.left + r.width / 2;
    if (!isFinite(cy)) cy = r.top + r.height / 2;
    var p = scenePoint(app.view, r, cx, cy);
    setView(zoomView(app.view, app.bounds, factor, p.x, p.y));
  }
  // After a key zoom the focused bed or sign must still be in view.
  // The box of a node in scene units. Boards and icons sit in a transformed group, so getBBox is in their own units.
  function sceneBox(node) {
    var b = node.getBBox(), m = node.getScreenCTM(), root = svg.getScreenCTM();
    if (!m || !root) return [b.x, b.y, b.width, b.height];
    var t = root.inverse().multiply(m), pts = [[b.x, b.y], [b.x + b.width, b.y + b.height]].map(function (c) {
      var p = svg.createSVGPoint();
      p.x = c[0];
      p.y = c[1];
      p = p.matrixTransform(t);
      return [p.x, p.y];
    });
    return [pts[0][0], pts[0][1], pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]];
  }
  function revealFocused() {
    var node = document.activeElement;
    if (!node || !svg.contains(node) || !node.getBBox || node === svg || !resetShown(app.view, app.bounds)) return;
    try {
      setView(revealRect(app.view, app.bounds, sceneBox(node), 8));
    } catch (err) { /* not measurable: leave the view */ }
  }

  svg.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.isPrimary) {      // the first finger: forget fingers whose release was lost (e.g. a redrawn bed)
      pointers = {};
      pinch = null;
    }
    app.blockClick = false;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (ids().length === 1) {
      drag = { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
    } else if (ids().length === 2) {
      app.pinching = true;
      endPress();
      if (drag) drag.moved = true;      // two fingers are never a tap
      pinch = measure();
      ids().forEach(function (id) { capture(Number(id)); });
    }
  });

  svg.addEventListener("pointermove", function (e) {
    var p = pointers[e.pointerId];
    if (!p || !drag) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (ids().length >= 2) {
      if (!pinch) return;
      var now = measure();
      app.gestureAt = Date.now();
      setView(pinchView(app.view, app.bounds, box(), pinch, now));
      pinch = now;
      return;
    }
    if (!drag.moved && movedBeyond(drag.sx, drag.sy, e.clientX, e.clientY, LONG_PRESS_SLOP)) {
      drag.moved = true;      // beyond the tap tolerance: no tap, no long press from here on
      endPress();
      capture(e.pointerId);   // the move goes on even if a redraw replaces the bed under the finger
    }
    if (drag.moved) {
      setView(dragView(app.view, app.bounds, box(), e.clientX - drag.lx, e.clientY - drag.ly));
      drag.lx = e.clientX;
      drag.ly = e.clientY;
    }
  });

  function release(e) {
    if (!pointers[e.pointerId]) return;
    delete pointers[e.pointerId];
    var left = ids();
    pinch = null;
    if (left.length === 1 && drag) {      // one finger stays: it goes on panning from where it is
      drag.lx = pointers[left[0]].x;
      drag.ly = pointers[left[0]].y;
    }
    if (left.length < 2 && app.pinching) {
      app.pinching = false;
      app.gestureAt = Date.now();
    }
    if (left.length === 0 && drag) {
      if (drag.moved && e.type === "pointerup") {      // the click that follows a drag is not a tap
        app.blockClick = true;
        clearTimeout(blockTimer);
        blockTimer = setTimeout(function () { app.blockClick = false; }, 100);
      }
      drag = null;
    }
  }
  if (app.zoomCleanup) app.zoomCleanup();      // the layout was redrawn: drop the old svg's window listeners
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  function onResize() { refit(false); }
  window.addEventListener("resize", onResize);
  var observer = typeof ResizeObserver === "function" ? new ResizeObserver(onResize) : null;
  var moveBar = $("moveBar");
  if (observer) { observer.observe(host); observer.observe(moveBar); }      // the bar shows, hides and wraps
  app.refit = function () { refit(false); };
  app.zoomCleanup = function () {
    window.removeEventListener("pointerup", release);
    window.removeEventListener("pointercancel", release);
    window.removeEventListener("resize", onResize);
    if (observer) observer.disconnect();
  };

  svg.addEventListener("click", function (e) {
    if (!app.blockClick) return;
    app.blockClick = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);

  svg.addEventListener("wheel", function (e) {
    e.preventDefault();       // the page neither scrolls nor zooms over the map
    zoomAround(wheelFactor(e.deltaY, e.deltaMode, e.ctrlKey), e.clientX, e.clientY);
  }, { passive: false });

  // Safari on a Mac sends a trackpad pinch as gesture events, not as wheel events.
  svg.addEventListener("gesturestart", function (e) {
    e.preventDefault();
    gestureScale = 1;
    endPress();
  });
  svg.addEventListener("gesturechange", function (e) {
    e.preventDefault();
    endPress();
    if (ids().length || !(e.scale > 0)) return;     // fingers handled by the pointer events are not zoomed twice
    zoomAround(e.scale / gestureScale, e.clientX, e.clientY);
    gestureScale = e.scale;
  });
  svg.addEventListener("gestureend", function (e) {
    e.preventDefault();
    endPress();
  });

  // With two or more fingers the page must neither scroll nor zoom: the browser would otherwise claim an uneven
  // pinch (one finger still) as a scroll and cancel the pointers.
  function holdTwoFingers(e) {
    if (e.touches.length >= 2 && e.cancelable) e.preventDefault();
  }
  svg.addEventListener("touchstart", holdTwoFingers, { passive: false });
  svg.addEventListener("touchmove", holdTwoFingers, { passive: false });

  svg.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var c = { x: app.view.x + app.view.w / 2, y: app.view.y + app.view.h / 2 };
    if (e.key === "+" || e.key === "=") setView(zoomView(app.view, app.bounds, ZOOM_KEY_STEP, c.x, c.y));
    else if (e.key === "-" || e.key === "_") setView(zoomView(app.view, app.bounds, 1 / ZOOM_KEY_STEP, c.x, c.y));
    else if (e.key === "0") resetView();
    else return;
    revealFocused();
    e.preventDefault();
  });

  // A bed reached with Tab must be in view. A tap or click, or focus returning after a panel closes, must not
  // shift the map under the finger.
  svg.addEventListener("focusin", function (e) {
    var node = e.target;
    if (!resetShown(app.view, app.bounds) || !node.getBBox || Date.now() - app.navKeyAt > 500) return;
    try {
      if (!node.matches(":focus-visible")) return;
      setView(revealRect(app.view, app.bounds, sceneBox(node), 8));
    } catch (err) { /* not measurable: leave the view */ }
  });

  app.zoomReset.addEventListener("click", function () {
    resetView();
    svg.focus({ preventScroll: true });
  });
}

// The grass around the scene, as far as the view shows it even zoomed out to ZOOM_MIN: a patterned rectangle.
// The scene's own grass is drawn over it, so the two meet without a seam.
