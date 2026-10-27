// Pure page logic, part 3: map zoom and pan.
// No DOM, no browser globals: tests/js/logic.test.mjs loads all logic-*.js files into one Node vm context.
// Plain script, shares the global scope with the other logic-*.js and app-*.js files (see index.html for the order).

// --- map zoom (the visible area of the map: view = {x, y, w, h} in scene units) ---
// The scene (W x H) is drawn inside the "bounds" {x, y, w, h}: the whole viewport in scene units, which is the scene
// plus grass around it (see fitBounds). 1x is the whole bounds. A view always has the aspect ratio of the bounds.

// The bounds of a viewport of vw x vh CSS px that shows the W x H scene whole (contain) and centered in the
// part of the viewport that is free of `insets` ({top, right, bottom, left} px, e.g. a notch). The bounds
// cover the whole viewport, so the extra space around the scene is filled with the scene's grass.
// Bad numbers fall back to the scene itself.
function fitBounds(vw, vh, W, H, insets) {
  if (!(vw > 0) || !(vh > 0) || !isFinite(vw) || !isFinite(vh)) return { x: 0, y: 0, w: W, h: H };
  function inset(v) {
    return v > 0 && isFinite(v) ? v : 0;
  }
  var ins = insets || {};
  var t = inset(ins.top), r = inset(ins.right), b = inset(ins.bottom), l = inset(ins.left);
  if (l + r > vw - 1) l = r = 0;       // an inset that leaves no room is ignored
  if (t + b > vh - 1) t = b = 0;
  var aw = vw - l - r, ah = vh - t - b;
  var s = Math.min(aw / W, ah / H);    // px per scene unit
  return {
    x: -(l + (aw - W * s) / 2) / s,
    y: -(t + (ah - H * s) / 2) / s,
    w: vw / s,
    h: vh / s
  };
}

function wholeView(bounds) {
  return { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
}

// The view the map rests on when nobody zoomed it: the whole bounds, except
//  - on a phone held upright (a portrait viewport narrower than REST_PHONE_W px) when `content` ([x, y, w, h], the part
//    of the scene that matters: the board block and the rooms) is given: the view fits the content's width, so a phone
//    shows the board block and every room larger than the whole scene would be (only the forest edge is cropped),
//  - on a phone held sideways. There the whole scene would have to fit the short height and come out tiny, so the map
//    keeps the scale it has with the phone upright (the scene as wide as the short side of the screen), zoomed around
//    the scene centre. vw x vh is the viewport in CSS px; only below LANDSCAPE_MAX_H px of height (phones, not desktop windows).
var LANDSCAPE_MAX_H = 500;
var REST_PHONE_W = 600;
function restView(bounds, W, H, vw, vh, content, insets) {
  var whole = wholeView(bounds), phone = phoneRestView(bounds, vw, vh, content, insets);
  if (phone) return phone;
  if (!(vw > vh) || !(vh < LANDSCAPE_MAX_H) || !(bounds.w > 0)) return whole;
  var s = vw / bounds.w;                                  // px per scene unit at 1x
  var z = Math.min(ZOOM_MAX, vh / W / s);
  if (!(z > 1.05)) return whole;
  return zoomView(whole, bounds, z, W / 2, H / 2);      // the scene centre stays where it is (above the HUD)
}

// The rest view of a phone held upright (see restView): the content rect fitted by width and centred, or null when
// the rule does not apply (no content, a wide or a landscape viewport, or the content is no narrower than the scene).
function phoneRestView(bounds, vw, vh, content, insets) {
  if (!content || !(vw < REST_PHONE_W) || !(vh >= vw) || !(content[2] > 0) || !(bounds.w > 0)) return null;
  var w = content[2], h = w * bounds.h / bounds.w;
  if (!(bounds.w / w > 1.02)) return null;
  // With insets ({top, bottom} in px: the top HUD and quest tab, the bottom bar) the content is centred in the free band
  // between them, so the title board never sits under the HUD.
  var sc = vw / w, top = insets && insets.top > 0 ? insets.top : 0, bot = insets && insets.bottom > 0 ? insets.bottom : 0;
  var mid = (top + vh - bot) / 2 / sc;      // the band's centre in scene units from the view top
  return clampView({ x: content[0], y: content[1] + content[3] / 2 - mid, w: w, h: h }, bounds);
}

// Two views are the same up to half a scene unit.
function sameView(a, b) {
  return !!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;
}

function viewZoom(view, bounds) {
  return bounds.w / view.w;
}

function isZoomed(view, bounds) {
  return view.w < bounds.w - 0.001;
}

// The view is wider than the fitted view: the map is zoomed out (below 1x).
function isZoomedOut(view, bounds) {
  return view.w > bounds.w + 0.001;
}

// The only place the zoom range is computed: a view width limited to ZOOM_MAX in and ZOOM_MIN out.
function clampWidth(w, bounds) {
  return Math.min(bounds.w / ZOOM_MIN, Math.max(bounds.w / ZOOM_MAX, w));
}

// The allowed range of a view's x and y for a view of width w (height w * bounds.h / bounds.w):
// [xMin, xMax, yMin, yMax]. The band around the centered position is max(0, (bounds size - view size) / 2)
// plus PAN_MARGIN of the view size on each side. The only place the pan range is computed.
function panRange(w, bounds) {
  var h = w * bounds.h / bounds.w;
  var cx = bounds.x + bounds.w / 2, cy = bounds.y + bounds.h / 2;
  var sx = Math.max(0, (bounds.w - w) / 2) + PAN_MARGIN * w;
  var sy = Math.max(0, (bounds.h - h) / 2) + PAN_MARGIN * h;
  return [cx - w / 2 - sx, cx - w / 2 + sx, cy - h / 2 - sy, cy - h / 2 + sy];
}

// The view's center is more than 0.5 scene units away from the bounds' center on x or y.
function isOffCenter(view, bounds) {
  return Math.abs(view.x + view.w / 2 - (bounds.x + bounds.w / 2)) > 0.5 ||
    Math.abs(view.y + view.h / 2 - (bounds.y + bounds.h / 2)) > 0.5;
}

// "Celá mapa" has something to do: the view is zoomed in or panned off center.
function resetShown(view, bounds) {
  return isZoomed(view, bounds) || isOffCenter(view, bounds);
}

// Keeps the bounds' aspect ratio, the zoom between ZOOM_MIN and ZOOM_MAX, and the position inside panRange
// (the bounds plus a margin of grass; at 1x and below, the centered position plus the margin).
// A view with a missing or non-finite number (a bad event coordinate) falls back to the whole bounds.
function clampView(view, bounds) {
  if (!view || !isFinite(view.x) || !isFinite(view.y) || !isFinite(view.w) || !isFinite(view.h) || !(view.w > 0)) return wholeView(bounds);
  var w = clampWidth(view.w, bounds);
  var h = w * bounds.h / bounds.w;
  var r = panRange(w, bounds);
  return {
    x: Math.min(r[1], Math.max(r[0], view.x)),
    y: Math.min(r[3], Math.max(r[2], view.y)),
    w: w,
    h: h
  };
}

// The rectangle ([x, y, w, h]) the patterned ground has to cover: what the view shows at ZOOM_MIN, shifted by its
// full pan range, plus 2 units on each side, centered on the bounds.
function groundRect(bounds) {
  var w = bounds.w / ZOOM_MIN, h = bounds.h / ZOOM_MIN;
  var r = panRange(w, bounds);
  return [r[0] - 2, r[2] - 2, r[1] - r[0] + w + 4, r[3] - r[2] + h + 4];
}

// The view after the bounds changed (a resize or a rotation): whole stays whole, a zoomed view keeps its zoom
// factor and its center, as far as the new pan range allows, and so does a zoomed-out view.
function refitView(view, oldBounds, newBounds) {
  if (!view || !isFinite(view.x) || !isFinite(view.y) || !isFinite(view.w) || !(view.w > 0) ||
      !(isZoomed(view, oldBounds) || isZoomedOut(view, oldBounds))) {
    return wholeView(newBounds);
  }
  var w = newBounds.w * view.w / oldBounds.w;
  var h = w * newBounds.h / newBounds.w;
  var cx = view.x + view.w / 2, cy = view.y + view.h / 2;
  return clampView({ x: cx - w / 2, y: cy - h / 2, w: w, h: h }, newBounds);
}

// Zooms by `factor` (above 1 zooms in) and keeps the scene point (px, py) at the same place on screen.
// A bad factor changes nothing; a bad point means the center of the visible area.
function zoomView(view, bounds, factor, px, py) {
  if (!isFinite(factor) || !(factor > 0)) return clampView(view, bounds);
  if (!isFinite(px)) px = view.x + view.w / 2;
  if (!isFinite(py)) py = view.y + view.h / 2;
  var w = clampWidth(view.w / factor, bounds);
  var fx = (px - view.x) / view.w, fy = (py - view.y) / view.h;
  var h = w * bounds.h / bounds.w;
  return clampView({ x: px - fx * w, y: py - fy * h, w: w, h: h }, bounds);
}

// Moves the visible area by (dx, dy) scene units.
function panView(view, bounds, dx, dy) {
  if (!isFinite(dx) || !isFinite(dy)) return clampView(view, bounds);
  return clampView({ x: view.x + dx, y: view.y + dy, w: view.w, h: view.h }, bounds);
}

// The scene point under a screen point. `box` is the svg's on-screen rectangle {left, top, width, height}.
function scenePoint(view, box, cx, cy) {
  return {
    x: view.x + (cx - box.left) / box.width * view.w,
    y: view.y + (cy - box.top) / box.height * view.h
  };
}

// Dragging the map by (dx, dy) screen px moves the visible area the other way.
function dragView(view, bounds, box, dx, dy) {
  var k = view.w / box.width;
  return panView(view, bounds, -dx * k, -dy * k);
}

// A pinch from `from` to `to` ({x, y, dist}: midpoint and finger distance in screen px): the scene point that
// was under the old midpoint ends up under the new one, so the fingers zoom and pan at once.
function pinchView(view, bounds, box, from, to) {
  if (!(from.dist > 0) || !(to.dist > 0) || !isFinite(from.dist) || !isFinite(to.dist)) return view;
  if (!isFinite(from.x) || !isFinite(from.y) || !isFinite(to.x) || !isFinite(to.y)) return view;
  var anchor = scenePoint(view, box, from.x, from.y);
  var w = clampWidth(view.w * from.dist / to.dist, bounds);
  var h = w * bounds.h / bounds.w;
  return clampView({
    x: anchor.x - (to.x - box.left) / box.width * w,
    y: anchor.y - (to.y - box.top) / box.height * h,
    w: w,
    h: h
  }, bounds);
}

// The zoom factor of one wheel event. A trackpad pinch arrives as a wheel with ctrlKey and small deltas.
function wheelFactor(deltaY, deltaMode, ctrlKey) {
  var px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  px = Math.max(-100, Math.min(100, px));
  return Math.exp(-px * (ctrlKey ? 0.01 : 0.002));
}

// Pans the visible area the least that shows `r` ([x, y, w, h]) with `margin` around it (as far as the zoom allows).
function revealRect(view, bounds, r, margin) {
  if (!r.every(isFinite)) return clampView(view, bounds);
  var dx = 0, dy = 0;
  var left = r[0] - margin, right = r[0] + r[2] + margin, top = r[1] - margin, bottom = r[1] + r[3] + margin;
  if (right - left > view.w) dx = r[0] - view.x;        // too big to fit: show its top-left corner
  else if (left < view.x) dx = left - view.x;
  else if (right > view.x + view.w) dx = right - view.x - view.w;
  if (bottom - top > view.h) dy = r[1] - view.y;
  else if (top < view.y) dy = top - view.y;
  else if (bottom > view.y + view.h) dy = bottom - view.y - view.h;
  return panView(view, bounds, dx, dy);
}

// The first view of the one-time intro: zoomed INTRO_ZOOM_START times, centered on the scene horizontally, with the
// top edge at the top of the scene (the W x H scene sits at 0, 0 in the bounds' coordinates).
function introStartView(bounds, W, H, focusX) {
  var w = bounds.w / INTRO_ZOOM_START;
  var h = w * bounds.h / bounds.w;
  var cx = focusX === undefined ? W / 2 : focusX;      // the title board in the board block (or the scene middle)
  return clampView({ x: cx - w / 2, y: 0, w: w, h: h }, bounds);
}

// The view `t` (0 to 1, clamped) of the way from `from` to `to`, eased in and out. Exactly `from` at 0, `to` at 1.
function introViewAt(from, to, t) {
  if (!(t > 0)) return { x: from.x, y: from.y, w: from.w, h: from.h };
  if (t >= 1) return { x: to.x, y: to.y, w: to.w, h: to.h };
  var k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  return {
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k,
    w: from.w + (to.w - from.w) * k,
    h: from.h + (to.h - from.h) * k
  };
}

function viewBoxText(view) {
  return [view.x, view.y, view.w, view.h].map(function (n) { return String(Math.round(n * 1000) / 1000); }).join(" ");
}
