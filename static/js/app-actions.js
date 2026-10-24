"use strict";

// App part 8: slot actions with optimistic UI, the walk to a bed, move mode.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// --- slot actions with optimistic UI ---

// „This place is already yours“ comes back as slot_taken with params.own, and is not an error.
function isOwnSlotTaken(e) {
  return !!(e && e.code === "slot_taken" && e.params && e.params.own === true);
}

// Draws the pending changes at once, sends the write, and reports a rejection in Slovak. The map
// already shows the server's state when the promise settles (see write()). Resolves to the write result.
function runWrite(path, body, ops) {
  app.pending = app.pending.concat(ops);
  renderBeds();
  return write("POST", path, body, ops).then(function (res) {
    if (res.ok) return res;
    if (res.status === 401) return res;     // the code screen is up; the person typed nothing wrong
    var e = res.error;
    // Tapping a place the party already holds changes nothing and is not an error.
    if (isOwnSlotTaken(e)) return res;
    showToast(errorText(e, app.state), "error");
    return res;
  });
}

// --- the walk from the meadow to the bed (T-017) ---

// Starts the walk of `list` (see walkers()) in the walk layer and hides the target slots until landing.
// Returns the walk (null when nobody walks) so that a rejected write can cancel just this one.
function startWalk(list, party, night) {
  if (!list.length) return null;
  var walk = { start: performance.now(), items: [] };
  var ch = shirtChar(party.name);
  list.forEach(function (w) {
    var key = night + "|" + w.slot;
    var node = svgEl(app.layers.walk, "g", { transform: "translate(" + w.from[0] + " " + w.from[1] + ")" });
    drawFigure(node, 0, 0, w.color, w.kind, ch);      // opaque all the way, even while the write is unconfirmed
    app.walking[key] = true;
    walk.items.push({ key: key, node: node, from: w.from, to: w.to });
  });
  app.walks.push(walk);
  if (!app.walkFrame) app.walkFrame = requestAnimationFrame(stepWalks);
  return walk;
}

// One animation frame for all walks: move every figure along its line, land the walks that are done.
function stepWalks(now) {
  app.walkFrame = 0;
  var landed = false;
  app.walks = app.walks.filter(function (walk) {
    var elapsed = now - walk.start;
    if (elapsed >= WALK_MS) {
      dropWalk(walk);
      landed = true;
      return false;
    }
    var t = walkProgress(elapsed, WALK_MS);
    walk.items.forEach(function (item) {
      var p = walkPosition(item.from, item.to, t);
      item.node.setAttribute("transform", "translate(" + p[0] + " " + p[1] + ")");
    });
    return true;
  });
  // The figure now stands in the bed: opaque if the server has confirmed meanwhile, else semi-transparent.
  if (landed) renderBeds();
  if (app.walks.length) app.walkFrame = requestAnimationFrame(stepWalks);
}

// Removes the walkers of one walk and shows their slots again (the caller redraws the beds).
function dropWalk(walk) {
  walk.items.forEach(function (item) {
    if (item.node.parentNode) item.node.parentNode.removeChild(item.node);
    delete app.walking[item.key];
  });
}

function stopWalkLoop() {
  if (!app.walks.length && app.walkFrame) {
    cancelAnimationFrame(app.walkFrame);
    app.walkFrame = 0;
  }
}

// Cancels one walk, or all walks without an argument. Does not redraw: the caller does, or a render follows.
function cancelWalks(only) {
  app.walks = app.walks.filter(function (walk) {
    if (only && walk !== only) return true;
    dropWalk(walk);
    return false;
  });
  stopWalkLoop();
}

// A walker whose bed place is released or moved away while it is still on its way would land in an empty
// bed, so it goes away at once (the redraw that follows shows the place as it now is).
function cancelWalkersAt(night, slot) {
  var key = night + "|" + slot;
  app.walks.forEach(function (walk) {
    walk.items = walk.items.filter(function (item) {
      if (item.key !== key) return true;
      dropWalk({ items: [item] });
      return false;
    });
  });
  app.walks = app.walks.filter(function (walk) { return walk.items.length; });
  stopWalkLoop();
}

function myParty(st) {
  return partyById(st, app.myParty);
}

function assignHere(bed, stay) {
  var st = viewState().state, party = myParty(st), night = app.night;
  if (!party) { closePanel(); openWho(); return; }
  if (!isPresent(party, night)) return;
  var slots = slotsToTake(st, party, bed, night);
  if (!slots.length) return;
  var ops = [], nights = stay ? stayNights(st, party, slots) : [night];
  nights.forEach(function (n) {
    slots.forEach(function (slot) { ops.push({ night: n, slot: slot, party_id: party.id }); });
  });
  var walk = null;
  if (!prefersReducedMotion()) {
    var after = withPending(app.state, app.pending.concat(ops)).state;
    walk = startWalk(walkers(st, after, party, bed, slots, night, st.layout.map.scene.meadow), party, night);
  }
  closePanel();
  var run = stay
    ? runWrite("api/assign-stay", { slots: slots, party_id: party.id }, ops)
    : runWrite("api/assign", { night: night, slots: slots, party_id: party.id }, ops);
  run.then(function (res) {
    // A rejected write puts the figure back on the meadow by the normal rollback (a 401 already cancelled).
    if (walk && !res.ok && !isOwnSlotTaken(res.error)) {
      cancelWalks(walk);
      renderBeds();
    }
    var skipped = res.ok && res.json && res.json.skipped;
    if (skipped && skipped.length) showToast(skippedText(skipped), "info");
  });
}

function clearSlot(slot) {
  var night = app.night;
  closePanel();
  cancelWalkersAt(night, slot);
  runWrite("api/clear", { night: night, slot: slot }, [{ night: night, slot: slot, party_id: null }]);
}

// --- move mode ---

function renderMoveBar() {
  var bar = $("moveBar"), m = app.move;
  bar.hidden = !m;
  if (m && app.state) {
    var party = myParty(app.state);
    $("moveText").textContent = moveBarText(party ? party.name : "");
    $("moveThis").setAttribute("aria-pressed", m.all ? "false" : "true");
    $("moveAll").setAttribute("aria-pressed", m.all ? "true" : "false");
  }
  if (app.refit) app.refit();      // the scene makes room for the bar (or takes it back)
}

function startMove(slot) {
  app.move = { partyId: app.myParty, fromSlot: slot, all: false };
  closePanel();
  renderMoveBar();
  $("moveThis").focus({ preventScroll: true });
}

function cancelMove() {
  app.move = null;
  renderMoveBar();
}

function moveTo(bed) {
  var m = app.move, st = viewState().state;
  var plan = planMove(st, m, bed, app.night);
  if (plan.error) {
    showToast(plan.error, "error");
    return;
  }
  var ops = [];
  plan.nights.forEach(function (n) {
    ops.push({ night: n, slot: m.fromSlot, party_id: null });
    ops.push({ night: n, slot: plan.target, party_id: m.partyId });
  });
  app.move = null;
  renderMoveBar();
  plan.nights.forEach(function (n) { cancelWalkersAt(n, m.fromSlot); });
  runWrite("api/move", { party_id: m.partyId, from_slot: m.fromSlot, to_slot: plan.target, nights: plan.nights }, ops);
}

function onBedTap(room, bed) {
  if (app.move) moveTo(bed);
  else openBedSheet(room, bed);
}

// --- fewer places for one night (T-033) ---

// Sets the number of places the party needs on a night (the panel button sends its placed count).
function sendPlaces(action, party) {
  closePanel();
  write("POST", "api/places", { party_id: party.id, night: action.night, places: action.places }).then(function (res) {
    if (!res.ok && res.status !== 401) showToast(errorText(res.error, app.state), "error");
  });
}

// The panel opened from the red status board when its night is already selected.
function openPlacesPanel(night) {
  var st = viewState().state, party = myParty(st);
  var info = placesPanelInfo(st, party, night);
  if (!info) return;
  openPanel(info.title, function (body) {
    body.className = "places-panel";
    info.lines.forEach(function (line) { body.appendChild(htmlEl("p", null, line)); });
    var primary = htmlEl("button", { "class": "btn", type: "button", "data-key": "places-primary" }, info.primary.label);
    primary.addEventListener("click", function () {
      if (info.primary.kind === "fewer") sendPlaces(info.primary.action, party);
      else { closePanel(); openPartyForm(party, { returnKey: "status" }); }
    });
    var secondary = htmlEl("button", { "class": "btn secondary", type: "button", "data-key": "places-secondary" }, info.secondary.label);
    secondary.addEventListener("click", closePanel);
    body.appendChild(primary);
    body.appendChild(secondary);
  }, { returnKey: "status" });
}

// The panel opened from the green „len N z M“ board: take „nás viac nebude“ back for the selected night.
function openPlacesUndoPanel(night) {
  var st = viewState().state, party = myParty(st);
  var info = placesUndoInfo(st, party, night);
  if (!info) return;
  openPanel(info.title, function (body) {
    body.className = "places-panel";
    body.appendChild(htmlEl("p", null, info.line));
    var primary = htmlEl("button", { "class": "btn", type: "button", "data-key": "places-undo" }, info.primary.label);
    primary.addEventListener("click", function () { sendPlaces(info.primary.action, party); });
    var secondary = htmlEl("button", { "class": "btn secondary", type: "button", "data-key": "places-keep" }, info.secondary.label);
    secondary.addEventListener("click", closePanel);
    body.appendChild(primary);
    body.appendChild(secondary);
  }, { returnKey: "status" });
}
