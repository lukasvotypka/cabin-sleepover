"use strict";

// App part 16: „Pred cestou“ entry (T-063): the board in the scene, the one-time offer above the bottom HUD, and
// sending POST /api/briefing when a station or the quick list is opened. The state parts are in logic-info.js.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

var briefingUi = { offerClosed: false, sending: {} };   // offerClosed: hidden until the next page load

// --- the board in the scene (map.scene.briefing) ---

function briefingLabel(state) {
  var count = briefingCount(state), mine = briefingDone(state, app.myParty);
  var text = "Pred cestou: čo si zbaliť a čo nás čaká.";
  if (count) text += " Prešlo to " + count.done + " z " + count.total + ".";
  if (partyById(state, app.myParty)) text += mine ? " Tvoja partia to má prejdené." : " Tvoja partia to ešte nemá prejdené.";
  return text + " Ťuknutím otvoríš dvor.";
}

function drawBriefing(parent, r, state) {
  var g = svgEl(parent, "g");
  var x = r[0], y = r[1], w = r[2];
  blockShadow(g, [x, y + 6, w, 40]);
  rect(g, x + 8, y + 40, 6, 10, COLORS.woodDark);                  // posts
  rect(g, x + w - 14, y + 40, 6, 10, COLORS.woodDark);
  board(g, [x, y + 6, w, 40], COLORS.plank);
  advSprite(g, "batoh", x + (w - 32) / 2, y + 10, 2);
  var count = briefingCount(state);
  iconCaption(g, x + w / 2, y + 48, "Pred cestou");
  if (count) {                                                     // the count as a small badge on the board
    rect(g, x - 2, y + 1, 24, 11, COLORS.woodDark);
    rect(g, x - 1, y + 2, 22, 9, COLORS.paper);
    addText(g, x + 10, y + 9, count.done + "/" + count.total, 7, COLORS.ink, { anchor: "middle", bold: true, maxWidth: 20 });
  }
  if (partyById(state, app.myParty) && !briefingDone(state, app.myParty)) {                         // the blinking „!“ bubble
    var bang = svgEl(g, "g", { "class": "briefing-bang", "aria-hidden": "true" });
    rect(bang, x + w - 20, y, 18, 20, COLORS.woodDark);
    rect(bang, x + w - 18, y + 2, 14, 16, "#FFD54A");
    rect(bang, x + w - 12, y + 5, 3, 7, COLORS.woodDark);
    rect(bang, x + w - 12, y + 14, 3, 3, COLORS.woodDark);
  }
  hitRect(g, r);
  makeButton(g, briefingLabel(state), "briefing", enterBriefing);
}

// --- the way in ---

// Opens the adventure. Without a chosen party „Kto si?“ comes first and the adventure follows the pick.
function enterBriefing() {
  if (!app.state || !app.state.info) return;
  briefingUi.offerClosed = true;
  renderBriefingOffer();
  if (!partyById(app.state, app.myParty)) { openWho({ after: enterBriefing }); return; }
  openAdventure();
}

// --- the offer above the bottom HUD ---

function briefingOfferWanted() {
  return !!(app.state && app.state.info && !briefingUi.offerClosed && app.introDone && !splash.falling && app.introZoom === "done" &&
    !app.codeOpen && !$("hud").hidden && !adv.open && partyById(app.state, app.myParty) && !briefingDone(app.state, app.myParty));
}

function renderBriefingOffer() {
  var node = $("briefingOffer");
  if (!briefingOfferWanted()) { node.hidden = true; return; }
  if (node.hidden || !node.firstChild) {
    clearNode(node);
    var go = htmlEl("button", { "class": "briefing-offer-go", type: "button", "data-key": "briefing-offer" });
    go.appendChild(advIcon("batoh"));
    var text = htmlEl("span");
    text.appendChild(htmlEl("b", null, "Pred cestou"));
    text.appendChild(document.createTextNode(" · Čo si zbaliť, voda, jedlo a program"));
    go.appendChild(text);
    go.appendChild(htmlEl("em", { "aria-hidden": "true" }, "›"));
    go.addEventListener("click", enterBriefing);
    var close = htmlEl("button", { "class": "briefing-offer-x", type: "button", "aria-label": "Zavrieť ponuku Pred cestou" }, "×");
    close.addEventListener("click", function () { briefingUi.offerClosed = true; renderBriefingOffer(); });
    node.appendChild(go);
    node.appendChild(close);
    node.hidden = false;
  }
  placeBriefingOffer();
}

// Stacks the offer above the update sign and the toast, which sit at the same place.
function placeBriefingOffer() {
  var node = $("briefingOffer");
  if (node.hidden) return;
  var lift = 0;
  [$("updateSign"), $("toast")].forEach(function (n) { if (!n.hidden) lift += n.offsetHeight + 8; });
  node.style.marginBottom = lift + "px";
}

// --- recording the progress ---

// Sends that a station (or "list") was opened by my party. Nothing without a chosen party or when the step is already
// known; a rejection shows the Slovak text and never blocks the view.
function recordStep(step) {
  var state = app.state;
  if (!state || !state.info || !partyById(state, app.myParty)) return;
  if (briefingSteps(state, app.myParty).indexOf(step) !== -1) return;
  var key = app.myParty + "|" + step;
  if (briefingUi.sending[key]) return;
  briefingUi.sending[key] = true;
  write("POST", "api/briefing", { party_id: app.myParty, step: step }).then(function (res) {
    delete briefingUi.sending[key];
    if (!res.ok && res.status !== 401) showToast(errorText(res.error, app.state), "error");
  });
}
