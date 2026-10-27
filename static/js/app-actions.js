"use strict";

// App part 8: slot actions with optimistic UI, the walk to a bed.
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
  openHousesOfSlots(ops);      // a closed house shows the pending figure
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
  var three = isoActive(), walk = { start: performance.now(), items: [], ms: three ? ISO_PEOPLE.walkMs : WALK_MS };
  var ch = shirtChar(party.name), layout = app.state.layout;
  list.forEach(function (w) {
    var key = night + "|" + w.slot, item = { key: key, node: null, fig: null, from: w.from, to: w.to, h: w.h };
    if (three) {      // a 3D doll hopping over the meadow, through the door of the house, to the bed (the house opens meanwhile)
      var at = isoBedOfSlot(layout, w.slot);
      item.points = isoWalkPoints(w.from, at ? isoWalkDoor(layout, at.room, w.from) : null, w.to);
      item.fig = isoWalkerAdd(w, ch);
    }
    if (!item.fig) {
      item.node = svgEl(app.layers.walk, "g", { transform: isoFigureTransform(isoWalkFigure(app.iso, w.from, w.to, 0, 0)) });
      drawFootShadow(item.node);
      drawFigure(item.node, 0, 0, w.color, w.kind, ch);      // opaque all the way, even while the write is unconfirmed
    }
    app.walking[key] = true;
    walk.items.push(item);
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
    if (elapsed >= walk.ms) {
      dropWalk(walk);
      landed = true;
      return false;
    }
    var t = walkProgress(elapsed, walk.ms);
    walk.items.forEach(function (item) {
      var hop = isoWalkHeight(elapsed, walk.ms, item.h);
      if (item.fig) {      // one hop per tick with a bob; the height hops up onto the bed at the end
        var smp = isoWalkSample(item.points, elapsed, walk.ms);
        isoWalkerSet(item.fig, smp.pos, hop || smp.bob);
        return;
      }
      // projected each frame; the height stays 0 on the floor and hops up onto the bed at the end (isoWalkHeight)
      var f = isoWalkFigure(app.iso, item.from, item.to, t, hop);
      item.node.setAttribute("transform", isoFigureTransform(f));
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
    if (item.fig) isoWalkerRemove(item.fig);
    else if (item.node.parentNode) item.node.parentNode.removeChild(item.node);
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

// `only` (optional): exactly these slots, e.g. the one free place tapped in the bed sheet. `stayOnly` (optional, with
// `stay`): only these nights of the stay.
function assignHere(bed, stay, only, stayOnly) {
  var st = viewState().state, party = myParty(st), night = app.night;
  if (!party) { closePanel(); openWho(); return; }
  if (!isPresent(party, night)) return;
  var slots = only ? only.filter(function (slot) { return isFreeSlot(st, slot, night); }) : slotsToTake(st, party, bed, night);
  if (!slots.length) return;
  var ops = [], nights = stay ? stayNights(st, party, slots) : [night];
  if (stay && stayOnly) nights = nights.filter(function (n) { return stayOnly.indexOf(n) !== -1; });
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
    ? runWrite("api/assign-stay", stayOnly ? { slots: slots, party_id: party.id, nights: stayOnly } : { slots: slots, party_id: party.id }, ops)
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

// Releases one place in the shown night, or (`nights`, my own place held in 2+ nights) in all of them in one write.
// The bed sheet stays open and shows the free place; `mine` adds the hint how to move now.
function clearSlot(slot, nights, mine) {
  var list = nights && nights.length ? nights : [app.night];
  list.forEach(function (n) { cancelWalkersAt(n, slot); });
  var ops = list.map(function (n) { return { night: n, slot: slot, party_id: null }; });
  var body = list.length > 1 ? { nights: list, slot: slot } : { night: list[0], slot: slot };
  var run = runWrite("api/clear", body, ops);
  if (app.panel && app.panel.refresh) app.panel.refresh();      // the pending release shows at once
  if (mine) run.then(function (res) { if (res.ok) showToast(RELEASE_TEXTS.toast, "info", RELEASE_TOAST_MS); });
}

function onBedTap(room, bed) {
  openBedSheet(room, bed);
}

// --- fewer places for one night (T-033) ---

// Sets the number of places the party needs on a night (the panel button sends its placed count).
function sendPlaces(action, party) {
  closePanel();
  if (!canWrite(app.state, app.role)) return;      // signup was locked meanwhile
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
    var locked = !canWrite(st, app.role);
    if (locked) body.appendChild(htmlEl("p", { "class": "note" }, LOCKED_TEXTS.note));
    var secondary = htmlEl("button", { "class": "btn secondary", type: "button", "data-key": "places-secondary" }, info.secondary.label);
    secondary.addEventListener("click", closePanel);
    if (!locked) body.appendChild(primary);
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
    var locked = !canWrite(st, app.role);
    if (locked) body.appendChild(htmlEl("p", { "class": "note" }, LOCKED_TEXTS.note));
    var primary = htmlEl("button", { "class": "btn", type: "button", "data-key": "places-undo" }, info.primary.label);
    primary.addEventListener("click", function () { sendPlaces(info.primary.action, party); });
    var secondary = htmlEl("button", { "class": "btn secondary", type: "button", "data-key": "places-keep" }, info.secondary.label);
    secondary.addEventListener("click", closePanel);
    if (!locked) body.appendChild(primary);
    body.appendChild(secondary);
  }, { returnKey: "status" });
}
