"use strict";

// App part 15: „Pred cestou“, the five station slides (pixel picture on top, text below) shown by the adventure view.
// Plain script: top-level names are shared with the other files. advOpenStation (app-adventure.js) calls
// openStation(step, slide); the texts come from state.info and are always set with textContent.

var slidesState = { water: null };   // the water calculator values of this visit to the yard; null = start from the party

function slidesReset() { slidesState.water = null; }

// --- small drawing helpers (pictures are 380 x 210, fixed colors like the scene) ---

function slSky(svg, cols) {
  var h = Math.ceil(150 / cols.length);
  cols.forEach(function (c, i) { advRect(svg, 0, i * h, 380, h, c); });
}

function slGrass(svg, y) {
  advRect(svg, 0, y, 380, 210 - y, "#8E9B48");
  var leaves = ["#B5532A", "#D69A2E", "#8E3424"];
  for (var i = 0; i < 40; i++) advRect(svg, (i * 53) % 372, y + 4 + (i * 37) % (204 - y), 4, 4, i % 3 ? "#76823A" : leaves[i % 3]);
}

function slTrees(svg, xs, y) {
  xs.forEach(function (x) {
    advRect(svg, x + 8, y + 36, 6, 10, "#5C4033"); advRect(svg, x, y + 22, 22, 16, "#3F5A2A");
    advRect(svg, x + 3, y + 10, 16, 14, "#4E6B2E"); advRect(svg, x + 7, y, 8, 12, "#5E7A34");
  });
}

function slStars(svg, n) {
  for (var i = 0; i < n; i++) advRect(svg, (i * 89 + 17) % 370, (i * 53) % 100, 3, 3, i % 4 ? "#FBF1D0" : "#FFD54A", "adv-glow").style.setProperty("--d", (i * 0.37).toFixed(2) + "s");
}

function slLeaves(svg, n) {
  var cols = ["#B5532A", "#D69A2E", "#8E3424"];
  for (var i = 0; i < n; i++) advRect(svg, 20 + (i * 71) % 340, 0, 4, 4, cols[i % 3], "adv-leaf").style.setProperty("--d", (i * 0.7).toFixed(1) + "s");
}

function slCabin(svg, x, y) {
  var R = function (a, b, w, h, f, c) { return advRect(svg, x + a, y + b, w, h, f, c); };
  R(66, -18, 10, 20, "#5C4033");
  for (var i = 0; i < 3; i++) R(68, -26, 6, 6, "#D9D2C6", "adv-smoke").style.setProperty("--d", i + "s");
  for (var k = 0; k < 6; k++) R(-8 + k * 9, k * 6 - 4, 106 - k * 18, 6, k % 2 ? "#8E3424" : "#A04030");
  R(-10, 32, 110, 6, "#5C4033"); R(0, 38, 90, 52, "#8A6A4A");
  for (var j = 0; j < 6; j++) R(0, 44 + j * 8, 90, 2, "#6E5238");
  R(38, 58, 16, 32, "#4A2C1A"); R(50, 74, 2, 2, "#FFD54A");
  R(10, 52, 18, 14, "#2B1D14"); R(12, 54, 14, 10, "#FFD54A", "adv-glow");
  R(64, 52, 18, 14, "#2B1D14"); R(66, 54, 14, 10, "#FFD54A", "adv-glow");
}

function slFigure(svg, x, y, color, s, kid) {
  var g = svgEl(svg, "g");
  if (kid) { advRect(g, x + s, y + 3 * s, 8 * s, 6 * s, color); advRect(g, x + 2 * s, y, 6 * s, 4 * s, "#F2C9A0"); }
  else advFigure(g, x, y, color, s);
  return g;
}

// --- the five pictures ---

var SL_PICTURES = {
  pack: function (svg) {
    advRect(svg, 0, 0, 380, 210, "#C9A67A");
    for (var i = 0; i < 9; i++) advRect(svg, 0, i * 24, 380, 2, "#B08E62");
    advSprite(svg, "batoh", 142, 52, 6, "adv-bob");
    [["spacak", 40, 70], ["vankus", 280, 60], ["celovka", 60, 150], ["topanky", 290, 140]].forEach(function (a) { advSprite(svg, a[0], a[1], a[2], 4); });
  },
  water: function (svg) {
    advRect(svg, 0, 0, 380, 210, "#CFD8DC");
    for (var y = -208; y < 130; y += 16) for (var x = ((y + 208) / 16) % 2 * 16; x < 380; x += 32) advRect(svg, x, y, 16, 16, "#BFC9CE");
    advRect(svg, 0, 130, 380, 80, "#8A6A4A"); advRect(svg, 0, 130, 380, 6, "#5C4033");
    advRect(svg, 30, 112, 140, 22, "#9AA0A6"); advRect(svg, 36, 116, 128, 10, "#6F767B");
    advRect(svg, 92, 70, 8, 44, "#6F767B"); advRect(svg, 92, 70, 34, 8, "#6F767B"); advRect(svg, 118, 78, 8, 8, "#6F767B"); advRect(svg, 98, 64, 12, 6, "#2B1D14");
    advRect(svg, 120, 90, 4, 6, "#3E6FB0", "adv-drip");
    var ring = svgEl(svg, "g", { "class": "adv-glow" });
    for (var a = 0; a < 24; a++) { var t = a / 24 * Math.PI * 2; advRect(ring, 106 + Math.cos(t) * 40 - 3, 84 + Math.sin(t) * 40 - 3, 7, 7, "#A3361E"); }
    for (var d = -4; d <= 4; d++) advRect(ring, 106 + d * 7 - 3, 84 - d * 7 - 3, 7, 7, "#A3361E");
    for (var b = 0; b < 5; b++) advSprite(svg, "flasa", 200 + b * 34, 92, 3);
  },
  food: function (svg) {
    slSky(svg, ["#2E2A44", "#3E3456", "#5B4466", "#7A4E5C", "#8E5568"]);
    slStars(svg, 12);
    advRect(svg, 0, 110, 380, 40, "#3F4A1C"); slGrass(svg, 140);
    advRect(svg, 150, 60, 6, 110, "#5C4033"); advRect(svg, 224, 60, 6, 110, "#5C4033"); advRect(svg, 150, 56, 80, 6, "#5C4033"); advRect(svg, 188, 62, 2, 30, "#2B1D14");
    advSprite(svg, "hrniec", 166, 80, 4);
    for (var i = 0; i < 3; i++) advRect(svg, 178 + i * 10, 84, 6, 6, "#E9E4DA", "adv-smoke").style.setProperty("--d", (i * 0.9) + "s");
    advSprite(svg, "ohen", 166, 124, 4, "adv-flame-a");
    var flip = svgEl(svg, "g", { "class": "adv-flame-b", transform: "translate(380 0) scale(-1 1)" });
    advSprite(flip, "ohen", 166, 124, 4);
    slFigure(svg, 60, 150, "#2F7D6D", 3); slFigure(svg, 100, 160, "#D07A2B", 3, true);
    slFigure(svg, 270, 150, "#6D5BA8", 3); slFigure(svg, 310, 156, "#C08A1E", 3);
  },
  program: function (svg) {
    slSky(svg, ["#7FA6C9", "#9DBAD2", "#C4CFCF", "#E6D3A8", "#E9B87A"]);
    for (var i = 0; i < 7; i++) advRect(svg, 172 - i * 18, 34 + i * 12, 36 + i * 36, 12, i < 2 ? "#F4F1EA" : i % 2 ? "#6A6E5A" : "#5E624F");
    advRect(svg, 0, 110, 380, 40, "#5E6B24"); slTrees(svg, [10, 330], 90); slGrass(svg, 140);
    for (var s = 0; s < 6; s++) advRect(svg, 150 + s * 14, 196 - s * 10, 14, 10, "#D6BC8E");
    advSprite(svg, "smerovnik", 116, 108, 4); advSprite(svg, "lezenie", 226, 110, 4); advSprite(svg, "lopta", 292, 174, 2);
    advRect(svg, 340, 112, 3, 66, "#5C4033"); advRect(svg, 326, 110, 17, 3, "#5C4033"); advSprite(svg, "lampion", 316, 112, 2, "adv-glow");
    advSprite(svg, "truhla", 30, 160, 3);
    slLeaves(svg, 5);
  },
  sleep: function (svg) {
    advRect(svg, 0, 0, 380, 210, "#3B3550");
    advRect(svg, 0, 120, 380, 90, "#7A6650");
    for (var i = 0; i < 4; i++) advRect(svg, 0, 130 + i * 20, 380, 2, "#6A5844");
    advRect(svg, 250, 20, 90, 70, "#2B1D14"); advRect(svg, 255, 25, 80, 60, "#1E2A4A");
    advSprite(svg, "mesiac", 304, 30, 2);
    advRect(svg, 293, 25, 4, 60, "#2B1D14"); advRect(svg, 255, 53, 80, 4, "#2B1D14");
    advRect(svg, 30, 120, 190, 54, "#2B1D14"); advRect(svg, 34, 124, 182, 46, "#E8E1D0"); advRect(svg, 34, 124, 182, 6, "#CFC6B2");
    advRect(svg, 44, 132, 40, 24, "#FBF6EC"); advRect(svg, 56, 132, 24, 20, "#F2C9A0");
    advRect(svg, 62, 140, 3, 3, "#3A2A1E"); advRect(svg, 70, 140, 3, 3, "#3A2A1E"); advRect(svg, 52, 128, 30, 8, "#5C4033");
    advRect(svg, 84, 128, 126, 38, "#2F7D6D"); advRect(svg, 84, 128, 126, 4, "#1F5A4E");
    ["Z", "z", "Z"].forEach(function (z, k) {
      svgEl(svg, "text", { x: 96 + k * 16, y: 112 - k * 8, "font-size": 14 + k * 3, "font-family": "ui-monospace,Menlo,monospace", "font-weight": 700, fill: "#FBF6EC", "class": "adv-zz" }, z).style.setProperty("--d", (k * 0.8) + "s");
    });
  }
};

// --- text parts ---

var slideDelay = 0;

// Marks an element to pop in (stepped); the order gives the delay.
function slPop(el) {
  el.classList.add("adv-b");
  el.style.setProperty("--d", (0.2 + slideDelay * 0.1).toFixed(2) + "s");
  slideDelay++;
  return el;
}

function slAdd(parent, tag, cls, text) {
  var el = htmlEl(tag, cls ? { "class": cls } : null, text);
  parent.appendChild(el);
  return slPop(el);
}

function slHead(box, kick, title) {
  slAdd(box, "p", "adv-kick", kick);
  var h = htmlEl("h2", { id: "advSlideTitle" }, title);
  box.appendChild(slPop(h));
}

function slPack(box, info) {
  slHead(box, "1 · Auto", "Zbaľ si");
  slAdd(box, "p", null, "Koniec októbra na chate býva chladno a vlhko. Toto si dones:");
  var items = packItems(info, needsMat(app.state, app.myParty));
  var bar = slAdd(box, "div", "adv-packbar");
  var label = htmlEl("span"), track = htmlEl("i"), fill = htmlEl("b");
  track.appendChild(fill); bar.appendChild(label); bar.appendChild(track);
  var grid = slAdd(box, "div", "adv-grid");
  var buttons = [];
  var sync = function () {
    var set = loadPacked(localStorage), n = 0;
    items.forEach(function (it, i) {
      var got = set.has(it.label);
      if (got) n++;
      buttons[i].classList.toggle("got", got);
      buttons[i].setAttribute("aria-pressed", String(got));
    });
    label.textContent = packProgressText(n, items.length);
    fill.style.width = (items.length ? n / items.length * 100 : 0) + "%";
  };
  items.forEach(function (it) {
    var b = htmlEl("button", { "class": "adv-slot", type: "button" });
    b.appendChild(advIcon(it.icon));
    b.appendChild(htmlEl("div", null, it.label));
    b.addEventListener("click", function () { togglePacked(localStorage, it.label); sync(); });
    grid.appendChild(b);
    buttons.push(b);
  });
  sync();
}

function slWater(box, info) {
  slHead(box, "2 · Studňa", "Pitná voda");
  if (info.water.drinkable === false) {
    var warn = slAdd(box, "div", "adv-warn");
    warn.setAttribute("role", "alert");
    warn.appendChild(htmlEl("b", null, "Voda z kohútika nie je na pitie."));
    warn.appendChild(htmlEl("span", null, "Na umývanie je v poriadku. Na pitie, čaj a varenie nie."));
  }
  slAdd(box, "p", null, "Dones balenú vodu: aspoň " + formatNumber(info.water.liters_per_day) + " l na človeka a deň.");
  var party = partyById(app.state, app.myParty);
  var bounds = waterBounds(app.state);
  if (!slidesState.water) slidesState.water = waterDefaults(app.state, app.myParty) || { people: bounds.peopleMin, days: bounds.daysMin };
  var vals = slidesState.water;
  var calc = slAdd(box, "div", "adv-calc");
  calc.appendChild(htmlEl("div", { "class": "adv-who" }, party ? "Podľa tvojej partie „" + party.name + "“. Môžeš zmeniť." : "Môžeš zmeniť."));
  var steps = htmlEl("div", { "class": "adv-steps" });
  var outs = {};
  [["people", "Ľudia", bounds.peopleMin, bounds.peopleMax], ["days", "Dni", bounds.daysMin, bounds.daysMax]].forEach(function (f) {
    var key = f[0], wrap = htmlEl("div", { "class": "adv-step" });
    wrap.appendChild(htmlEl("label", null, f[1]));
    var row = htmlEl("div");
    var minus = htmlEl("button", { type: "button", "aria-label": f[1] + " menej" }, "−");
    var out = htmlEl("output"); outs[key] = out;
    var plus = htmlEl("button", { type: "button", "aria-label": f[1] + " viac" }, "+");
    minus.addEventListener("click", function () { vals[key] = Math.max(f[2], vals[key] - 1); upd(); });
    plus.addEventListener("click", function () { vals[key] = Math.min(f[3], vals[key] + 1); upd(); });
    row.appendChild(minus); row.appendChild(out); row.appendChild(plus);
    wrap.appendChild(row); steps.appendChild(wrap);
  });
  calc.appendChild(steps);
  var lit = htmlEl("div", { "class": "adv-liters", "aria-live": "polite" });
  var big = htmlEl("strong"), sub = htmlEl("span");
  lit.appendChild(big); lit.appendChild(sub); calc.appendChild(lit);
  var bottles = htmlEl("div", { "class": "adv-bottles", "aria-hidden": "true" });
  calc.appendChild(bottles);
  function upd() {
    var r = waterResult(vals.people, vals.days, info.water);
    outs.people.textContent = vals.people; outs.days.textContent = vals.days;
    big.textContent = formatNumber(r.liters) + " l";
    sub.textContent = bottlesText(r.bottles, info.water.bottle_liters);
    clearNode(bottles);
    for (var i = 0; i < Math.min(r.bottles, 30); i++) bottles.appendChild(advIcon("flasa"));
  }
  upd();
}

function slFood(box, info) {
  slHead(box, "3 · Ohnisko", "Čo sa bude variť");
  var menu = slAdd(box, "div", "adv-menu");
  (info.menu || []).forEach(function (d) {
    var row = htmlEl("div", { "class": "adv-day" });
    row.appendChild(htmlEl("span", { "class": "adv-d" }, dayLabel(d.day)));
    var meals = htmlEl("div", { "class": "adv-m" });
    d.meals.forEach(function (m, j) {
      if (j) meals.appendChild(document.createElement("br"));
      meals.appendChild(htmlEl("i", null, m.when + ": "));
      meals.appendChild(document.createTextNode(m.what));
    });
    row.appendChild(meals); menu.appendChild(row);
  });
  if (info.bring) {
    var tip = slAdd(box, "div", "adv-tip");
    tip.appendChild(htmlEl("b", null, "Do kuchyne dones: "));
    tip.appendChild(document.createTextNode(bringText(info.bring) + " Nákup na spoločné jedlá rozpočítame."));
  }
  var days = eventDays(app.state.event), counts = foodRow(app.state);
  var eat = slAdd(box, "div", "adv-eat");
  eat.appendChild(htmlEl("b", null, "Na jedlo nás je"));
  var list = htmlEl("div", { "class": "adv-eat-days" });
  days.forEach(function (day, i) { list.appendChild(htmlEl("span", null, dayLabel(day) + ": " + counts[i])); });
  eat.appendChild(list);
}

function slProgram(box, info) {
  slHead(box, "4 · Smerovník", "Čo budeme robiť");
  info.program.forEach(function (p) {
    var q = slAdd(box, "div", "adv-quest");
    q.appendChild(advIcon(p.icon));
    var t = htmlEl("div", { "class": "adv-t" });
    t.appendChild(htmlEl("b", null, p.title));
    t.appendChild(htmlEl("span", null, p.when + (p.note ? " · " + p.note : "")));
    q.appendChild(t);
  });
  slAdd(box, "p", "adv-muted", "Nič nie je povinné. Kto chce, len leží pri peci.");
}

function slSleep(box, info) {
  slHead(box, "5 · Chata", "Na čom sa spí");
  slAdd(box, "p", null, "Postele a matrace sú pripravené, ale bez perín a obliečok.");
  var rows = slAdd(box, "div", "adv-rows");
  info.sleep.forEach(function (s) {
    var r = htmlEl("div", { "class": "adv-row" });
    r.appendChild(advIcon(s.icon));
    var t = htmlEl("div");
    t.appendChild(htmlEl("b", null, s.label));
    if (s.note) t.appendChild(htmlEl("span", null, s.note));
    r.appendChild(t); rows.appendChild(r);
  });
  var places = matPlaces(app.state, app.myParty);
  if (places.length) {
    var tip = slAdd(box, "div", "adv-tip");
    tip.appendChild(htmlEl("span", { "class": "adv-chip" }, "Tvoje miesto"));
    tip.appendChild(document.createTextNode(places.join(", ") + ". Od zeme ťahá, pribaľ karimatku."));
  }
}

var SL_BUILDERS = { pack: slPack, water: slWater, food: slFood, program: slProgram, sleep: slSleep };

// Fills the slide of a station: the picture on top, the text below.
function openStation(step, slide) {
  var info = app.state && app.state.info;
  if (!info || !SL_BUILDERS[step]) return;
  slide.setAttribute("data-step", step);
  var pic = svgEl(null, "svg", { "class": "adv-pic", viewBox: "0 0 380 210", preserveAspectRatio: "xMidYMid slice", "shape-rendering": "crispEdges", "aria-hidden": "true" });
  SL_PICTURES[step](pic);
  slide.appendChild(pic);
  var text = htmlEl("div", { "class": "adv-text" });
  var box = htmlEl("div", { "class": "adv-slide-body" });
  text.appendChild(box); slide.appendChild(text);
  slideDelay = 0;
  SL_BUILDERS[step](box, info);
}

// --- the desktop welcome: shown beside the yard while no slide is open ---

function slWelcome(side) {
  clearNode(side);
  var box = htmlEl("div", { "class": "adv-slide-body" });
  box.appendChild(htmlEl("p", { "class": "adv-kick" }, "Pred cestou"));
  box.appendChild(htmlEl("h2", null, "Vitaj na dvore"));
  box.appendChild(htmlEl("p", null, "Ťukni na zastávku na dvore alebo tu. Zaberie to asi minútu."));
  var list = htmlEl("div", { "class": "adv-stlist" });
  ADV_STATIONS.forEach(function (st, i) {
    var b = htmlEl("div", { "class": "adv-st", role: "button", tabindex: "0", "data-step": st.step });
    b.setAttribute("aria-label", st.label + ": " + st.about);
    b.appendChild(advIcon(st.icon));
    var t = htmlEl("div");
    t.appendChild(htmlEl("b", null, st.label));
    t.appendChild(htmlEl("span", null, st.about));
    b.appendChild(t);
    b.appendChild(htmlEl("em", { "class": "adv-st-ok", "aria-hidden": "true" }, "✓"));
    var go = function () { advGoTo(i); };
    b.addEventListener("click", go);
    b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    list.appendChild(b);
  });
  box.appendChild(list);
  side.appendChild(box);
}

// Marks the visited stations in the welcome list.
function slWelcomeMarks(side, visited) {
  Array.prototype.forEach.call(side.querySelectorAll(".adv-st"), function (b) {
    b.classList.toggle("got", visited.indexOf(b.getAttribute("data-step")) !== -1);
  });
}
