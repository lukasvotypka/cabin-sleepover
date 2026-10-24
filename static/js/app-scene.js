"use strict";

// App part 3: choosing the party and night, „Návod“ window, scene frame helpers.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

function forgetMyParty() {
  app.myParty = null;
  storage.remove(KEYS.party);
  app.move = null;
}

function setMyParty(id) {
  if (app.myParty !== id) app.move = null;
  app.myParty = id;
  storage.set(KEYS.party, id);
}

function selectNight(night) {
  cancelWalks();
  app.night = night;
  render();
  if (app.panel && app.panel.refresh) app.panel.refresh();
}

// „Návod“: the four steps in a window in the centre of the screen, opened from the „?“ icon in the scene.
function openNotice() {
  openPanel("Návod", function (body) {
    NOTICE_LINES.forEach(function (line) { body.appendChild(htmlEl("p", null, line)); });
  }, { returnKey: "notice", center: true });
}

// --- scene ---

function rect(parent, x, y, w, h, fill, attrs) {
  var a = { x: x, y: y, width: w, height: h, fill: fill };
  if (attrs) Object.keys(attrs).forEach(function (k) { a[k] = attrs[k]; });
  return svgEl(parent, "rect", a);
}

// Sets the text of a scene label and squeezes it to `maxWidth` if the font makes it wider.
function setText(node, str, maxWidth) {
  node.removeAttribute("textLength");
  node.removeAttribute("lengthAdjust");
  node.textContent = str;
  if (!maxWidth || !node.getComputedTextLength) return;
  try {
    if (node.getComputedTextLength() > maxWidth) {
      node.setAttribute("textLength", String(maxWidth));
      node.setAttribute("lengthAdjust", "spacingAndGlyphs");
    }
  } catch (e) { /* not measurable (hidden): keep the natural width */ }
}

function addText(parent, x, y, str, size, fill, opts) {
  opts = opts || {};
  var node = svgEl(parent, "text", {
    x: x, y: y, "font-size": size, fill: fill,
    "text-anchor": opts.anchor || "start", "font-weight": opts.bold ? "700" : "400"
  });
  setText(node, str, opts.maxWidth);
  return node;
}

// A scene element that can be tapped: role, focus, label and Enter/Space like a click.
function makeButton(g, label, key, onActivate) {
  g.setAttribute("role", "button");
  g.setAttribute("tabindex", "0");
  g.setAttribute("aria-label", label);
  g.setAttribute("data-key", key);
  g.addEventListener("click", onActivate);
  g.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      onActivate(e);
    }
  });
  return g;
}

function hitRect(g, r) {
  return rect(g, r[0], r[1], r[2], r[3], "transparent", { "class": "hit" });
}

// Wooden board: dark edge, face, light top edge and two plank lines.
function board(parent, r, face, edge) {
  rect(parent, r[0], r[1], r[2], r[3], edge || COLORS.woodDark);
  rect(parent, r[0] + 3, r[1] + 3, r[2] - 6, r[3] - 6, face);
  rect(parent, r[0] + 3, r[1] + 3, r[2] - 6, 2, COLORS.woodLight, { opacity: ".55" });
}

function ensureScene() {
  var layout = app.state.layout;
  var key = JSON.stringify([layout.map, layout.rooms, layout.houses]);
  showScene(true);     // visible first: text is measured while drawing
  if (app.layoutKey === key) return;
  app.layoutKey = key;
  cancelWalks();      // the old walk layer goes away with the old svg
  var host = $("scene");
  clearNode(host);
  var vb = layout.map.viewbox;
  var svg = svgEl(host, "svg", {
    viewBox: "0 0 " + vb[0] + " " + vb[1], "shape-rendering": "crispEdges", role: "group",
    "aria-label": "Mapa chaty. Rovnaké údaje sú aj ako text hneď za mapou."
  });
  app.layers = {
    ground: svgEl(svg, "g", { "aria-hidden": "true" }),
    base: svgEl(svg, "g", { "aria-hidden": "true" }),
    beds: svgEl(svg, "g"),
    walk: svgEl(svg, "g", { "aria-hidden": "true", "pointer-events": "none" }),
    boards: svgEl(svg, "g"),
    tip: svgEl(svg, "g", { "aria-hidden": "true", "pointer-events": "none" }),
    sky: svgEl(svg, "g", { "aria-hidden": "true", "pointer-events": "none" })
  };
  drawBase(app.layers.base, layout);
  drawBird(app.layers.sky, layout);
  setupZoom(host, svg, vb[0], vb[1]);
}
