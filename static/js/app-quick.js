"use strict";

// App part: „Rýchly prehľad“ (T-062), one page in the panel style: water, packing, sleep, food, program, copy for WhatsApp.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

function qkCard(parent, title, cls) {
  var card = htmlEl("section", { "class": "qk-card" + (cls ? " " + cls : "") });
  card.appendChild(htmlEl("h3", null, title));
  parent.appendChild(card);
  return card;
}

function qkWater(parent, info) {
  var water = info.water || {};
  var card = qkCard(parent, water.drinkable === false ? "Voda z kohútika nie je pitná" : "Voda", water.drinkable === false ? "qk-warn" : "");
  card.appendChild(htmlEl("p", null, "Dones balenú vodu, aspoň " + formatNumber(water.liters_per_day) + " l na človeka a deň."));
  var party = partyById(app.state, app.myParty), def = waterDefaults(app.state, app.myParty);
  if (party && def) {
    var r = waterResult(def.people, def.days, water);
    var p = htmlEl("p", null, "Tvoja partia „" + party.name + "“: ");
    p.appendChild(htmlEl("b", null, formatNumber(r.liters) + " l (" + bottlesText(r.bottles, water.bottle_liters).replace("≈ ", "") + ")"));
    card.appendChild(p);
  }
}

function qkPack(parent, info) {
  var card = qkCard(parent, "Zbaľ si");
  if (info.pack_intro) card.appendChild(htmlEl("p", null, info.pack_intro));
  var items = packItems(info, needsMat(app.state, app.myParty));
  var prog = htmlEl("div", { "class": "qk-prog" });
  var label = htmlEl("span"), track = htmlEl("i"), fill = htmlEl("b");
  track.appendChild(fill); prog.appendChild(label); prog.appendChild(track);
  card.appendChild(prog);
  var checks = htmlEl("div", { "class": "qk-checks" });
  var set = loadPacked(localStorage, app.myParty);      // re-read on every open, so it matches the pack slide
  function count() {
    var n = items.filter(function (it) { return set.has(it.label); }).length;
    label.textContent = packProgressText(n, items.length);
    fill.style.width = (items.length ? n / items.length * 100 : 0) + "%";
  }
  items.forEach(function (it) {
    var l = htmlEl("label", { "class": "qk-check" });
    var cb = htmlEl("input", { type: "checkbox" });
    cb.checked = set.has(it.label);
    l.classList.toggle("done", cb.checked);
    cb.addEventListener("change", function () {
      set = togglePacked(localStorage, it.label, app.myParty);
      cb.checked = set.has(it.label);
      l.classList.toggle("done", cb.checked);
      count();
    });
    l.appendChild(cb);
    var txt = htmlEl("span", null, it.label);
    if (it.note) txt.appendChild(htmlEl("small", { "class": "qk-note" }, it.note));
    l.appendChild(txt);
    checks.appendChild(l);
  });
  card.appendChild(checks);
  count();
}

function qkSleep(parent, info) {
  var card = qkCard(parent, "Spanie");
  if (info.sleep_intro) card.appendChild(htmlEl("p", null, info.sleep_intro));
  var ul = htmlEl("ul");
  (info.sleep || []).forEach(function (s) { ul.appendChild(htmlEl("li", null, s.note ? s.label + ": " + s.note : s.label)); });
  var places = matPlaces(app.state, app.myParty);
  if (places.length) ul.appendChild(htmlEl("li", null, "Tvoje miesto: " + places.join(", ") + ". Pribaľ karimatku."));
  card.appendChild(ul);
  var fac = facilityLists(info);
  [["Na chate je", "✓", fac.have, "have"], ["Na chate nie je", "✗", fac.missing, "missing"]].forEach(function (f) {
    if (!f[2].length) return;
    var p = htmlEl("p", { "class": "qk-fac " + f[3] });
    p.appendChild(htmlEl("b", null, f[1] + ": "));
    p.appendChild(document.createTextNode(f[2].join(", ")));
    card.appendChild(p);
  });
}

function qkFood(parent, info) {
  var card = qkCard(parent, "Jedlo");
  if (info.food_intro) card.appendChild(htmlEl("p", null, info.food_intro));
  var plan = infoList(info.food_plan);
  if (plan.length) {
    var ul = htmlEl("ul");
    plan.forEach(function (t) { ul.appendChild(htmlEl("li", null, t)); });
    card.appendChild(ul);
  }
  var days = menuDays(info);
  if (days.length) {
    var table = htmlEl("table", { "class": "qk-table" });
    days.forEach(function (d) {
      var tr = htmlEl("tr");
      tr.appendChild(htmlEl("td", null, dayLabel(d.day)));
      tr.appendChild(htmlEl("td", null, d.meals.map(function (m) { return m.when + ": " + m.what; }).join(" · ")));
      table.appendChild(tr);
    });
    card.appendChild(table);
  }
  if (info.food_note) card.appendChild(htmlEl("p", null, info.food_note));
  if (info.bring) card.appendChild(htmlEl("p", null, "Dones: " + bringText(info.bring)));
  var notes = foodNotes(app.state);
  if (notes.length) {
    card.appendChild(htmlEl("p", null, "Čo kto donesie:")).style.fontWeight = "700";
    foodNotesList(card, notes);
  }
}

function qkProgram(parent, info) {
  var card = qkCard(parent, "Program");
  var ul = htmlEl("ul");
  (info.program || []).forEach(function (p) { ul.appendChild(htmlEl("li", null, p.title + " (" + p.when + ")")); });
  card.appendChild(ul);
}

// The copy button; without clipboard access the text is shown selectable, like „Prehľad na poslanie“.
function qkCopy(body, text) {
  var btn = htmlEl("button", { "class": "btn qk-copy", type: "button" }, "Kopírovať do WhatsAppu");
  var area = htmlEl("textarea", { "class": "summary-text", readonly: "", rows: "8", "aria-label": "Text na poslanie", hidden: "" });
  area.value = text;
  function fallback() {
    area.hidden = false;
    area.focus({ preventScroll: true });
    area.select();
    area.setSelectionRange(0, area.value.length);
    var copied = false;
    try { copied = document.execCommand("copy"); } catch (e) { copied = false; }
    showToast(copied ? "Skopírované." : "Text je označený, skopíruj ho.", "info");
  }
  btn.addEventListener("click", function () {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { showToast("Skopírované.", "info"); }, fallback);
    } else {
      fallback();
    }
  });
  body.appendChild(btn);
  body.appendChild(area);
}

// Opens the quick list; replaces any open panel (e.g. the end panel of the adventure).
function openQuickList() {
  var info = app.state && app.state.info;
  if (!info) return;
  recordStep("list");
  openPanel("Rýchly prehľad", function (body) {
    if (info.host_arrival) body.appendChild(htmlEl("p", { "class": "qk-host" }, info.host_arrival));
    var grid = htmlEl("div", { "class": "qk-grid" });
    qkWater(grid, info);
    qkPack(grid, info);
    qkSleep(grid, info);
    qkFood(grid, info);
    qkProgram(grid, info);
    body.appendChild(grid);
    qkCopy(body, quickWhatsAppText(info, app.state.event.name));
  }, { returnKey: "letter", wide: true });
}
