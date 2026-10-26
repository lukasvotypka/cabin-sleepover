"use strict";

// App part 14: „Pred cestou“, the adventure view: a full-screen pixel yard with my party's figure walking to five stations.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).
// The station slides are filled by openStation(step, slide) (app-slides.js); the quick list
// is openQuickList() (T-062). The art is data in logic-info-art.js, the hints and order in logic-info.js.

var ADV_W = 380, ADV_H = 600;
var ADV_START = [200, 560];
var ADV_SPEED = 150;   // world pixels per second
// The five stations in the order of BRIEFING_STEPS. `stand` is where the figure stops, `box` the tappable area and ring.
var ADV_STATIONS = [
  { step: "pack", label: "Auto", about: "čo si zbaliť", stand: [130, 470], icon: "batoh", anchor: [70, 436], box: [18, 436, 104, 56] },
  { step: "water", label: "Studňa", about: "pitná voda", stand: [250, 385], icon: "flasa", anchor: [306, 338], box: [272, 338, 88, 58] },
  { step: "food", label: "Ohnisko", about: "čo sa bude variť", stand: [110, 300], icon: "hrniec", anchor: [66, 236], box: [26, 236, 80, 94] },
  { step: "program", label: "Smerovník", about: "program", stand: [290, 225], icon: "smerovnik", anchor: [326, 176], box: [300, 176, 72, 78] },
  { step: "sleep", label: "Chata", about: "na čom sa spí", stand: [210, 165], icon: "spacak", anchor: [210, 126], box: [110, 30, 200, 128] }
];
// The route: each leg ends at the stand of its station and starts where the previous one ended.
var ADV_LEGS = [[[200, 470], [130, 470]], [[250, 470], [250, 385]], [[250, 300], [110, 300]], [[110, 225], [290, 225]], [[210, 225], [210, 165]]];
// ADV_CHAIN[0] is the gate, so advChainIndex(i) points at the stand of station i
var ADV_CHAIN = [ADV_START].concat.apply([ADV_START], ADV_LEGS);

var adv = {
  open: false, els: null, at: -1, pos: ADV_START.slice(), session: [], sessionParty: null, walking: false, frame: 0,
  slide: null,          // the step of the open slide, or null
  finishPending: false, // the last station was just completed: show the end panel when its slide closes
  opener: null
};

function advChainIndex(i) {
  if (i < 0) return 0;
  var n = 0;
  for (var k = 0; k <= i; k++) n += ADV_LEGS[k].length;
  return n;
}

function advVisited() {
  return visitedStations(app.state, app.myParty, adv.session, adv.sessionParty);
}

function advRect(parent, x, y, w, h, fill, cls) {
  var r = svgEl(parent, "rect", { x: x, y: y, width: w, height: h, fill: fill });
  if (cls) r.setAttribute("class", cls);
  return r;
}

function advSprite(parent, name, x, y, s, cls) {
  var g = svgEl(parent, "g", cls ? { "class": cls } : null);
  spriteRects(name, s).forEach(function (r) { advRect(g, x + r.x, y + r.y, r.w, r.h, r.fill); });
  return g;
}

function advIcon(name) {
  var size = INFO_SPRITES[name][0].length;
  var svg = svgEl(null, "svg", { viewBox: "0 0 " + size + " " + size, "shape-rendering": "crispEdges", "aria-hidden": "true" });
  advSprite(svg, name, 0, 0, 1);
  return svg;
}

// The same figure shapes as on the map, at scale s.
function advFigure(parent, x, y, color, s) {
  var g = svgEl(parent, "g");
  advRect(g, x, y + 5 * s, 10 * s, 7 * s, color);
  advRect(g, x + 2 * s, y, 6 * s, 5 * s, "#F2C9A0");
  advRect(g, x + 3 * s, y + 2 * s, s, s, "#3A2A1E");
  advRect(g, x + 6 * s, y + 2 * s, s, s, "#3A2A1E");
  return g;
}

function advDrawYard(svg) {
  var R = function (x, y, w, h, f, c) { return advRect(svg, x, y, w, h, f, c); };
  R(0, 0, ADV_W, ADV_H, "#8E9B48");
  var leaves = ["#76823A", "#76823A", "#B5532A", "#D69A2E", "#8E3424"];
  for (var i = 0; i < 110; i++) R((i * 53) % 372, (i * 97) % 592, 4, 4, leaves[i % 5]);
  // sand path along the whole route, and the gate at the bottom
  var pts = [[200, 600]].concat(ADV_CHAIN);
  for (var j = 1; j < pts.length; j++) {
    var a = pts[j - 1], b = pts[j];
    R(Math.min(a[0], b[0]) - 8, Math.min(a[1], b[1]) - 8, Math.abs(a[0] - b[0]) + 16, Math.abs(a[1] - b[1]) + 16, "#D6BC8E");
  }
  R(0, 586, 176, 6, "#5C4033"); R(224, 586, 156, 6, "#5C4033");
  for (var x = 4; x < 380; x += 20) if (x < 176 || x > 222) R(x, 580, 6, 16, "#8A6A4A");
  // trees seen from above
  var tree = function (tx, ty, c) { R(tx, ty + 6, 36, 24, c[0]); R(tx + 6, ty, 24, 36, c[0]); R(tx + 6, ty + 6, 24, 24, c[1]); R(tx + 12, ty + 10, 10, 8, c[2]); };
  var pine = ["#3F5A2A", "#4E6B2E", "#5E7A34"], autumn = ["#8E3424", "#B5532A", "#D69A2E"], gold = ["#A0701A", "#C08A1E", "#E0B040"];
  [[8, 8, pine], [334, 8, autumn], [10, 150, gold], [338, 120, pine], [6, 372, pine], [336, 430, autumn], [150, 520, gold], [300, 520, pine], [150, 380, autumn]]
    .forEach(function (t) { tree(t[0], t[1], t[2]); });
  // cabin roof from above with the front wall
  R(106, 26, 208, 118, "#5C4033");
  for (var k = 0; k < 14; k++) R(110, 30 + k * 8, 200, 8, k % 2 ? "#8E3424" : "#A04030");
  R(110, 82, 200, 6, "#6E2A1C");
  R(252, 44, 16, 16, "#5C4033");
  for (var m = 0; m < 3; m++) R(256, 40, 8, 8, "#D9D2C6", "yard-smoke").style.setProperty("--d", m + "s");
  R(110, 142, 200, 16, "#8A6A4A"); R(200, 142, 20, 16, "#4A2C1A");
  R(136, 146, 22, 8, "#FFD54A", "yard-glow"); R(262, 146, 22, 8, "#FFD54A", "yard-glow");
  // car from above with the backpack by the boot
  R(20, 444, 70, 42, "#2B1D14"); R(22, 446, 66, 38, "#3E6FB0");
  R(38, 450, 34, 30, "#2A4E80"); R(72, 450, 6, 30, "#9FD3F0"); R(32, 450, 4, 30, "#9FD3F0");
  [[18, 442], [78, 442], [18, 482], [78, 482]].forEach(function (w) { R(w[0], w[1], 14, 6, "#2B1D14"); });
  advSprite(svg, "batoh", 88, 438, 2, "yard-bob");
  // well with a „do not drink“ sign
  R(280, 350, 44, 44, "#6F767B"); R(284, 354, 36, 36, "#9AA0A6"); R(290, 360, 24, 24, "#1E2A4A"); R(296, 366, 8, 6, "#3E6FB0");
  R(276, 368, 52, 6, "#5C4033");
  R(342, 360, 4, 30, "#5C4033"); R(330, 342, 28, 22, "#2B1D14"); R(332, 344, 24, 18, "#E8D2A6");
  for (var n = 0; n < 5; n++) { R(336 + n * 3, 347 + n * 3, 3, 3, "#A3361E"); R(348 - n * 3, 347 + n * 3, 3, 3, "#A3361E"); }
  // fire pit with stones, and two log benches
  R(36, 242, 64, 8, "#8A6A4A"); R(36, 318, 64, 8, "#8A6A4A");
  for (var s = 0; s < 12; s++) { var t = s / 12 * Math.PI * 2; R(64 + Math.cos(t) * 24, 280 + Math.sin(t) * 24, 8, 8, "#9AA0A6"); }
  advSprite(svg, "ohen", 56, 268, 2, "yard-flame-a");
  var flip = svgEl(svg, "g", { "class": "yard-flame-b", transform: "translate(136 0) scale(-1 1)" });
  advSprite(flip, "ohen", 56, 268, 2);
  // signpost towards the hills, with a lantern and a ball
  advSprite(svg, "smerovnik", 304, 178, 3); R(356, 206, 2, 30, "#5C4033"); advSprite(svg, "lampion", 346, 204, 2, "yard-glow"); advSprite(svg, "lopta", 318, 236, 1);
}

function advReducedMotion() { return prefersReducedMotion(); }

// The desktop layout (CSS min-width 900 px): the yard and the slide side by side.
function advWide() { return !!(window.matchMedia && window.matchMedia("(min-width: 900px)").matches); }

// --- building the view ---

function advBuildStation(svg, st, i) {
  var g = svgEl(svg, "g", { "class": "yard-spot", "data-step": st.step });
  var bx = st.box[0], by = st.box[1], bw = st.box[2], bh = st.box[3], ax = st.anchor[0], ay = st.anchor[1];
  svgEl(g, "rect", { x: bx - 4, y: by - 4, width: bw + 8, height: bh + 8, fill: "none", stroke: "#FFD54A", "stroke-width": 3, "stroke-dasharray": "6 4", "class": "yard-ring" });
  // small name plate; the big marker replaces it on the next stop
  var nm = svgEl(g, "g", { "class": "yard-name" }), nw = st.label.length * 6 + 8;
  advRect(nm, ax - nw / 2 - 1, ay - 15, nw + 2, 14, "#2B1D14"); advRect(nm, ax - nw / 2, ay - 14, nw, 12, "#FBF6EC");
  svgEl(nm, "text", { x: ax, y: ay - 5, "text-anchor": "middle", "font-size": 9, "font-weight": 700, "font-family": "ui-monospace,Menlo,monospace", fill: "#2B1D14" }, st.label);
  var mk = svgEl(g, "g", { "class": "yard-marker" }), w = st.label.length * 7 + 12;
  advRect(mk, ax - w / 2, ay - 44, w, 16, "#2B1D14");
  svgEl(mk, "text", { x: ax, y: ay - 32, "text-anchor": "middle", "font-size": 11, "font-weight": 700, "font-family": "ui-monospace,Menlo,monospace", fill: "#FFD54A" }, st.label);
  var ar = svgEl(mk, "g", { "class": "yard-arrow" });
  advRect(ar, ax - 7, ay - 26, 14, 6, "#2B1D14"); advRect(ar, ax - 5, ay - 24, 10, 3, "#FFD54A");
  advRect(ar, ax - 5, ay - 20, 10, 4, "#2B1D14"); advRect(ar, ax - 3, ay - 20, 6, 3, "#FFD54A");
  advRect(ar, ax - 3, ay - 16, 6, 4, "#2B1D14"); advRect(ar, ax - 1, ay - 16, 2, 2, "#FFD54A");
  var ck = svgEl(g, "g", { "class": "yard-check" });
  advRect(ck, bx + bw - 10, by - 8, 18, 18, "#2B1D14"); advRect(ck, bx + bw - 8, by - 6, 14, 14, "#3F6E2C");
  svgEl(ck, "text", { x: bx + bw - 1, y: by + 6, "text-anchor": "middle", "font-size": 13, "font-weight": 900, fill: "#FBF6EC" }, "✓");
  var hit = svgEl(g, "rect", { x: bx - 6, y: by - 46, width: bw + 12, height: bh + 52, fill: "transparent", role: "button", tabindex: 0, "class": "yard-hit" });
  hit.setAttribute("aria-label", st.label + ": " + st.about);
  var go = function (e) { e.stopPropagation(); advGoTo(i); };
  hit.addEventListener("click", go);
  hit.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(e); } });
  return g;
}

function advBuild() {
  var view = $("adventure");
  clearNode(view);
  var world = htmlEl("div", { "class": "yard-world" });
  var svg = svgEl(null, "svg", { viewBox: "0 0 " + ADV_W + " " + ADV_H, "shape-rendering": "crispEdges", role: "group", "aria-label": "Dvor pri chate" });
  world.appendChild(svg);
  advDrawYard(svg);
  var spots = ADV_STATIONS.map(function (st, i) { return advBuildStation(svg, st, i); });
  var party = partyById(app.state, app.myParty);
  var me = svgEl(svg, "g");
  advRect(me, 2, 22, 18, 4, "rgba(0,0,0,.25)");
  var body = svgEl(me, "g");
  advFigure(body, 0, 0, party ? party.color : "#2F7D6D", 2);
  world.addEventListener("click", function () { if (!adv.walking && adv.slide) advCloseSlide(); });
  view.appendChild(world);

  var board = htmlEl("div", { "class": "yard-board", role: "status" });
  var boardIcon = htmlEl("span", { "class": "yard-board-icon" });
  var boardText = htmlEl("span");
  board.appendChild(boardIcon); board.appendChild(boardText);
  var top = htmlEl("div", { "class": "yard-top" });
  top.appendChild(board);
  view.appendChild(top);
  var host = htmlEl("div", { "class": "yard-host", hidden: "" });
  if (app.state.info && app.state.info.host_arrival) {
    host.textContent = app.state.info.host_arrival;
    host.hidden = false;
  }
  top.appendChild(host);

  // Desktop only (CSS): the welcome with the station list, beside the yard, while no slide is open.
  var side = htmlEl("div", { "class": "yard-side" });
  slWelcome(side);
  view.appendChild(side);

  var slide = htmlEl("div", { "class": "yard-slide", role: "dialog", "aria-modal": "true", "aria-labelledby": "advSlideTitle", hidden: "" });
  view.appendChild(slide);

  var bar = htmlEl("div", { "class": "yard-bar" });
  var list = htmlEl("button", { "class": "yard-list", type: "button", "aria-label": "Rýchly zoznam" }, "☰");
  list.addEventListener("click", advQuickList);
  var prog = htmlEl("div", { "class": "yard-prog", "aria-hidden": "true" });
  var slots = ADV_STATIONS.map(function (st) {
    var s = htmlEl("span"); s.appendChild(advIcon(st.icon)); prog.appendChild(s); return s;
  });
  var count = htmlEl("span", { "class": "yard-count", "aria-hidden": "true" });
  var nextBtn = htmlEl("button", { "class": "yard-next", type: "button" });
  nextBtn.addEventListener("click", function () {
    if (adv.walking) return;
    if (adv.slide && advWide()) {         // desktop: the button leads on, the yard beside the slide stays usable
      var after = nextStation(advVisited());
      if (after) { advGoTo(BRIEFING_STEPS.indexOf(after)); return; }
      adv.finishPending = false;
      advCloseSlide(true);
      advEndPanel();
    }
    else if (adv.slide) advCloseSlide();
    else if (!nextStation(advVisited())) advEndPanel();
    else advGoTo(BRIEFING_STEPS.indexOf(nextStation(advVisited())));
  });
  bar.appendChild(list); bar.appendChild(prog); bar.appendChild(count); bar.appendChild(nextBtn);
  view.appendChild(bar);

  adv.els = { world: world, svg: svg, spots: spots, me: me, body: body, board: board, boardIcon: boardIcon, boardText: boardText, slide: slide, side: side, nextBtn: nextBtn, slots: slots, count: count, host: host };
}

// --- state of the view ---

function advRefresh() {
  var e = adv.els;
  if (!e) return;
  var visited = advVisited(), next = nextStation(visited);
  var nextIdx = next ? BRIEFING_STEPS.indexOf(next) : -1;
  e.spots.forEach(function (g, i) {
    g.classList.toggle("next", i === nextIdx && !adv.slide && !adv.walking);
    g.classList.toggle("done", visited.indexOf(BRIEFING_STEPS[i]) !== -1);
  });
  e.slots.forEach(function (s, i) { s.classList.toggle("got", visited.indexOf(BRIEFING_STEPS[i]) !== -1); s.title = ADV_STATIONS[i].label; });
  e.count.textContent = BRIEFING_STEPS.filter(function (st) { return visited.indexOf(st) !== -1; }).length + " z " + BRIEFING_STEPS.length;
  var wide = advWide();
  e.slide.setAttribute("aria-modal", wide ? "false" : "true");
  e.nextBtn.textContent = adv.slide && !wide ? "‹ Späť na dvor" : next ? "Choď: " + ADV_STATIONS[nextIdx].label + " ›" : "Hotovo ›";
  var hint = adv.slide ? "Prečítaj si to. Potom ťukni na dvor a vyber si ďalšiu vec."
    : next ? boardHint(next) : "Máš všetko! Ťukni na hocičo a pozri si to znova.";
  e.boardText.textContent = hint;
  e.side.hidden = !!adv.slide;
  if (e.host.textContent) e.host.hidden = !!adv.slide;
  slWelcomeMarks(e.side, visited);
  var iconName = next && !adv.slide ? ADV_STATIONS[nextIdx].icon : adv.slide ? ADV_STATIONS[BRIEFING_STEPS.indexOf(adv.slide)].icon : "truhla";
  clearNode(e.boardIcon);
  e.boardIcon.appendChild(advIcon(iconName));
}

// New state arrived while the view is open: marks and board follow. A slide that shows state data is redrawn only
// when the numbers or places it shows changed, and then without the pop-in and with the focus kept on its heading.
function advOnState() {
  if (!adv.open || !adv.els) return;
  advRefresh();
  if (adv.slide !== "sleep" && adv.slide !== "food") return;
  var sig = slideSignature(adv.slide, app.state, app.myParty);
  if (sig === adv.slideSig) return;
  if (adv.slide === "food" && document.activeElement && document.activeElement.id === "foodNoteInput") return;   // keep the typed text
  var slide = adv.els.slide, back = slide.querySelector(".yard-back");
  var scroll = slide.querySelector(".yard-text");
  var top = scroll ? scroll.scrollTop : 0;
  var hadFocus = slide.contains(document.activeElement);
  clearNode(slide);
  slide.appendChild(back);
  openStation(adv.slide, slide);
  adv.slideSig = sig;
  slide.classList.add("still");
  scroll = slide.querySelector(".yard-text");
  if (scroll) scroll.scrollTop = top;
  var h = slide.querySelector("h2");
  if (h && hadFocus) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
}

function advPlace() {
  var x = Math.round(adv.pos[0] / 2) * 2, y = Math.round(adv.pos[1] / 2) * 2;   // pixel steps
  adv.els.me.setAttribute("transform", "translate(" + (x - 10) + " " + (y - 24) + ")");
}

// Follows the figure vertically; a short world sits at the bottom.
function advCamera(animate) {
  var e = adv.els, s = e.svg.clientWidth / ADV_W, h = e.world.clientHeight;
  var lo = h - ADV_H * s, hi = Math.max(0, h - ADV_H * s);
  var ty = Math.max(lo, Math.min(hi, h * 0.55 - adv.pos[1] * s));
  e.svg.style.transition = animate && !advReducedMotion() ? "translate .45s steps(6,end)" : "none";
  e.svg.style.translate = "0 " + Math.round(ty) + "px";
}

// --- walking ---

function advGoTo(i) {
  if (adv.walking) return;
  if (adv.slide) advCloseSlide(true);
  var a = advChainIndex(adv.at), b = advChainIndex(i);
  var route = a <= b ? ADV_CHAIN.slice(a, b + 1) : ADV_CHAIN.slice(b, a + 1).reverse();
  adv.at = i;
  advWalk(route.slice(1), function () { advOpenStation(i); });
}

function advWalk(points, done) {
  if (!points.length || advReducedMotion()) {
    if (points.length) adv.pos = points[points.length - 1].slice();
    advPlace(); advCamera(false);
    return done();
  }
  adv.walking = true;
  adv.els.body.classList.add("yard-bob");
  advRefresh();
  var k = 0, last = performance.now();
  var step = function (now) {
    if (!adv.walking) return;
    var left = ADV_SPEED * Math.min(0.05, (now - last) / 1000);
    last = now;
    while (left > 0 && k < points.length) {
      var dx = points[k][0] - adv.pos[0], dy = points[k][1] - adv.pos[1], d = Math.hypot(dx, dy);
      if (d <= left) { adv.pos = points[k].slice(); left -= d; k++; }
      else { adv.pos = [adv.pos[0] + dx / d * left, adv.pos[1] + dy / d * left]; left = 0; }
    }
    advPlace(); advCamera(false);
    if (k < points.length) adv.frame = requestAnimationFrame(step);
    else { adv.walking = false; adv.els.body.classList.remove("yard-bob"); done(); }
  };
  adv.frame = requestAnimationFrame(step);
}

// --- stations ---

function advOpenStation(i) {
  var step = BRIEFING_STEPS[i];
  var before = nextStation(advVisited());
  if (adv.sessionParty !== app.myParty) { adv.session = []; adv.sessionParty = app.myParty; }
  if (adv.session.indexOf(step) === -1) adv.session.push(step);
  if (before && !nextStation(advVisited())) adv.finishPending = true;
  adv.slide = step;
  var slide = adv.els.slide;
  clearNode(slide);
  slide.hidden = false;
  var back = htmlEl("button", { "class": "yard-back", type: "button" }, "‹ Dvor");
  back.addEventListener("click", function () { advCloseSlide(); });
  slide.appendChild(back);
  slide.classList.remove("still");
  openStation(step, slide);
  adv.slideSig = slideSignature(step, app.state, app.myParty);
  recordStep(step);
  advRefresh();
  var h = slide.querySelector("h2");
  if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
}

function advCloseSlide(silent) {
  if (!adv.slide) return;
  adv.slide = null;
  adv.els.slide.hidden = true;
  clearNode(adv.els.slide);
  advRefresh();
  if (silent) return;
  var spot = adv.els.spots[adv.at];
  if (adv.finishPending) {
    adv.finishPending = false;
    if (spot) spot.querySelector(".yard-hit").focus({ preventScroll: true });
    advEndPanel();
    return;
  }
  advCamera(true);
  if (spot) spot.querySelector(".yard-hit").focus({ preventScroll: true });
}

function advQuickList() {
  if (typeof openQuickList === "function") openQuickList();
  else showToast("Zoznam na zbalenie pribudne čoskoro.");
}

function advEndPanel() {
  openPanel("Máš všetko, vidíme sa na chate!", function (body) {
    var map = htmlEl("button", { "class": "btn", type: "button" }, "Na mapu postelí");
    map.addEventListener("click", function () { closePanel(); closeAdventure(); });
    var list = htmlEl("button", { "class": "btn secondary", type: "button" }, "Zoznam na zbalenie");
    list.addEventListener("click", advQuickList);
    var again = htmlEl("button", { "class": "btn secondary", type: "button" }, "Prejsť dvor znova");
    again.addEventListener("click", function () { closePanel(); advRestart(); });
    var wrap = htmlEl("div", { "class": "yard-end" });
    wrap.appendChild(map); wrap.appendChild(list); wrap.appendChild(again);
    body.appendChild(wrap);
  }, { center: true });
}

// The figure goes back to the start; the visited marks stay.
function advRestart() {
  if (adv.slide) advCloseSlide(true);
  adv.at = -1;
  adv.pos = ADV_START.slice();
  advPlace(); advCamera(false); advRefresh();
}

// --- open and close ---

function advOnKey(e) {
  if (e.key !== "Escape" || app.panel) return;
  e.preventDefault();
  if (adv.slide) advCloseSlide(); else closeAdventure();
}

function advSetInert(on) {
  ["scene", "srSummary", "hud"].forEach(function (id) {
    var n = $(id);
    if (!n) return;
    if (on) n.setAttribute("inert", ""); else n.removeAttribute("inert");
  });
}

function openAdventure() {
  if (adv.open || !app.state || !app.state.info) return;
  adv.open = true;
  adv.opener = document.activeElement;
  adv.at = -1; adv.pos = ADV_START.slice(); adv.slide = null; adv.finishPending = false; adv.walking = false;
  advBuild();
  var view = $("adventure");
  view.hidden = false;
  advSetInert(true);
  document.addEventListener("keydown", advOnKey);
  window.addEventListener("resize", advOnResize);
  advPlace(); advRefresh(); advCamera(false);
  window.requestAnimationFrame(function () {
    if (!adv.open) return;
    advCamera(false);
    var next = nextStation(advVisited());
    var spot = adv.els.spots[next ? BRIEFING_STEPS.indexOf(next) : 0];
    spot.querySelector(".yard-hit").focus({ preventScroll: true });
  });
}

function advOnResize() { if (adv.open) { advCamera(false); advRefresh(); } }

function closeAdventure() {
  if (!adv.open) return;
  adv.open = false;
  adv.walking = false;
  cancelAnimationFrame(adv.frame);
  document.removeEventListener("keydown", advOnKey);
  window.removeEventListener("resize", advOnResize);
  $("adventure").hidden = true;
  clearNode($("adventure"));
  adv.els = null;
  slidesReset();
  advSetInert(false);
  if (adv.opener && document.contains(adv.opener) && adv.opener.focus) adv.opener.focus({ preventScroll: true });
}
