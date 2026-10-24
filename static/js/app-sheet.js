"use strict";

// App part 9: the bed sheet, „Kto si?“ and the legend.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// --- the bed sheet ---

function openBedSheet(room, bed) {
  openPanel(bed.name, function (body, panel) {
    var confirm = null;     // {slot, partyId, night} while „Naozaj ho uvoľniť?“ is asked

    function button(text, key, onClick, secondary, label) {
      var b = htmlEl("button", { "class": "btn" + (secondary ? " secondary" : ""), type: "button", "data-key": key }, text);
      if (label) b.setAttribute("aria-label", label);
      b.addEventListener("click", onClick);
      return b;
    }

    function focusKey(key) {
      var node = byKey(body, key);
      if (node) node.focus({ preventScroll: true });
    }

    function slotRow(st, slot, i, night) {
      var who = slotOccupant(st, slot, night), name = who ? (who.party ? who.party.name : UNKNOWN_PARTY) : "voľné";
      var rowText = (bed.slots.length > 1 ? "Miesto " + (i + 1) + ": " : "") + name;
      var row = htmlEl("div", { "class": "slot-row" });
      var label = htmlEl("span", { "class": "who" });
      var swatch = htmlEl("span", { "class": "swatch" + (who ? "" : " free"), "aria-hidden": "true" });
      if (who && who.party) swatch.style.background = who.party.color;
      label.appendChild(swatch);
      label.appendChild(htmlEl("span", null, rowText));
      if (!who && bed.tight.indexOf(slot) !== -1) label.appendChild(htmlEl("span", { "class": "tight" }, "(tesné)"));
      row.appendChild(label);
      if (who && night === app.night) slotActions(row, st, slot, who, rowText);
      return row;
    }

    function slotActions(row, st, slot, who, rowText) {
      var pid = who.party ? who.party.id : null, mine = pid !== null && pid === app.myParty;
      var name = who.party ? who.party.name : UNKNOWN_PARTY;
      if (confirm && confirm.slot === slot && confirm.partyId === pid && confirm.night === app.night) {
        row.appendChild(htmlEl("p", { "class": "confirm" }, releaseConfirmText(name)));
        row.appendChild(button("Uvoľniť", "yes-" + slot, function () { clearSlot(slot); }, false, "Naozaj uvoľniť: " + rowText));
        row.appendChild(button("Nie", "no-" + slot, function () { confirm = null; panel.refresh(); focusKey("clear-" + slot); }, true));
        return;
      }
      row.appendChild(button("Uvoľniť", "clear-" + slot, function () {
        if (mine) clearSlot(slot);
        else { confirm = { slot: slot, partyId: pid, night: app.night }; panel.refresh(); focusKey("no-" + slot); }
      }, true, "Uvoľniť " + rowText));
      if (mine) row.appendChild(button("Presunúť", "move-" + slot, function () { startMove(slot); }, true, "Presunúť " + rowText));
    }

    function nightSection(st, night) {
      var info = nightInfo(night) || { label: night, dates: "" };
      var sec = htmlEl("section", { "class": "night" + (night === app.night ? " on" : "") });
      var head = htmlEl("button", {
        "class": "night-head", type: "button", "data-key": "night-" + night, "aria-pressed": night === app.night ? "true" : "false"
      }, info.label + " · " + info.dates);
      head.addEventListener("click", function () { selectNight(night); });
      sec.appendChild(head);
      bed.slots.forEach(function (slot, i) { sec.appendChild(slotRow(st, slot, i, night)); });
      return sec;
    }

    function addActions(st) {
      var night = app.night, party = myParty(st), box = htmlEl("div", { "class": "actions" });
      var present = party ? isPresent(party, night) : true;
      var take = party && present ? slotsToTake(st, party, bed, night) : [];
      var blocked = !!party && take.length === 0;
      var assign = button(assignLabel(take.length, party ? party.name : null), "assign", function () { assignHere(bed, false); });
      var stay = button("Na všetky naše noci", "stay", function () { assignHere(bed, true); }, true);
      assign.disabled = blocked;
      stay.disabled = blocked;
      box.appendChild(assign);
      box.appendChild(stay);
      if (party && !present) {
        box.appendChild(htmlEl("p", { "class": "note" }, notPresentText(night)));
        box.appendChild(button("Upraviť príchod a odchod", "edit-party", function () {
          closePanel();
          openPartyForm(party, { returnKey: "bed-" + bed.id });
        }, true));
      } else if (blocked) {
        box.appendChild(htmlEl("p", { "class": "note" }, "Táto posteľ je v túto noc plná."));
      } else if (party && missingPlaces(st, party, night) === 0) {
        box.appendChild(htmlEl("p", { "class": "note" }, enoughAlreadyText(party.name)));
        box.appendChild(button("Zmeniť partiu", "switch-party", function () {
          closePanel();
          openWho({ returnKey: "bed-" + bed.id });
        }, true));
      }
      body.appendChild(box);
    }

    function fill() {
      clearNode(body);
      var st = viewState().state;
      if (confirm) {      // drop the question when the place changed hands or the night changed
        var who = slotOccupant(st, confirm.slot, app.night), pid = who && who.party ? who.party.id : null;
        if (confirm.night !== app.night || pid !== confirm.partyId) confirm = null;
      }
      body.appendChild(htmlEl("p", { "class": "sub" }, room.name));
      st.event.nights.forEach(function (night) { body.appendChild(nightSection(st, night)); });
      addActions(st);
    }

    panel.refresh = function () {
      keepFocus(body, fill, function () { return body.querySelector("button:not([disabled])"); });
    };
    app.selectedBed = bed.id;
    renderBeds();
    fill();
  }, {
    returnKey: "bed-" + bed.id,
    onClose: function () {
      if (app.selectedBed !== bed.id) return;
      app.selectedBed = null;
      if (app.state) renderBeds();
    }
  });
}

function openWho(opts) {
  openPanel("Kto si?", function (body, panel) {
    body.appendChild(htmlEl("p", null, "Vyber partiu, za ktorú sa zapisuješ."));
    var list = htmlEl("ul", { "class": "party-list" });
    body.appendChild(list);
    var actions = htmlEl("div", { "class": "actions" });
    body.appendChild(actions);
    var add = htmlEl("button", { "class": "btn", type: "button", "data-key": "add-party" }, "Pridať partiu");
    add.addEventListener("click", function () {
      closePanel();
      openPartyForm(null, { returnKey: "who" });
    });
    var edit = htmlEl("button", { "class": "btn secondary", type: "button", "data-key": "edit-party" });
    edit.addEventListener("click", function () {
      var mine = app.state ? partyById(app.state, app.myParty) : null;
      if (!mine) return;
      closePanel();
      openPartyForm(mine, { returnKey: "who" });
    });
    actions.appendChild(add);
    actions.appendChild(edit);
    panel.refresh = function () {
      // A new state rebuilds the rows, so focus returns to the same party (or to the first button).
      keepFocus(body, function () {
        fillParties(list);
        var mine = app.state ? partyById(app.state, app.myParty) : null;
        edit.hidden = !mine;
        if (mine) edit.textContent = "Upraviť partiu „" + mine.name + "“";
      }, function () { return add; });
    };
    function fillParties(list) {
      clearNode(list);
      var parties = app.state ? app.state.parties : [];
      if (!parties.length) {
        list.appendChild(htmlEl("li", { "class": "muted" }, "Zatiaľ tu nikto nie je. Pridaj prvú partiu."));
      }
      parties.forEach(function (party) {
        var li = htmlEl("li");
        var row = htmlEl("button", {
          "class": "party-row", type: "button", "data-key": "party-" + party.id, "aria-current": party.id === app.myParty ? "true" : "false"
        });
        var swatch = htmlEl("span", { "class": "swatch", "aria-hidden": "true" });
        swatch.style.background = party.color;
        row.appendChild(swatch);
        row.appendChild(htmlEl("span", { "class": "name" }, party.name));
        if (party.id === app.myParty) row.appendChild(htmlEl("span", { "class": "mark", "aria-hidden": "true" }, "✓"));
        row.addEventListener("click", function () {
          setMyParty(party.id);
          closePanel();
          render();
        });
        li.appendChild(row);
        list.appendChild(li);
      });
    }
    panel.refresh();
  }, { returnKey: (opts && opts.returnKey) || "who" });
}

// The shirt letter at 2 CSS px per pixel, for the legend swatch: the same mark as on the map.
function glyphIcon(ch, ink) {
  var svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 3 5");
  svg.setAttribute("width", "6");
  svg.setAttribute("height", "10");
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  var path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", glyphPath(ch, 0, 0));
  path.setAttribute("fill", ink);
  svg.appendChild(path);
  return svg;
}

// „Kto je kto“: a read-only list of the parties with the colour of their figures.
function openLegend(returnKey) {
  openPanel("Kto je kto", function (body, panel) {
    body.appendChild(htmlEl("p", null, "Farba postavičky na mape patrí partii."));
    var list = htmlEl("ul", { "class": "legend-list" });
    body.appendChild(list);
    body.appendChild(htmlEl("p", null, "Menšia postavička je dieťa. Žltý rámik majú miesta tvojej partie."));
    var actions = htmlEl("div", { "class": "actions" });
    var choose = htmlEl("button", { "class": "btn secondary", type: "button", "data-key": "choose-party" }, "Vybrať moju partiu");
    choose.addEventListener("click", function () {
      closePanel();
      openWho();
    });
    actions.appendChild(choose);
    body.appendChild(actions);
    panel.refresh = function () {
      clearNode(list);
      var rows = app.state ? legendRows(app.state, app.myParty) : [];
      var tableRows = app.state ? partyTableRows(app.state, app.myParty) : [];
      if (!rows.length) list.appendChild(htmlEl("li", { "class": "legend-empty" }, "Zatiaľ tu nikto nie je."));
      rows.forEach(function (row, i) {
        var li = htmlEl("li", { "class": "legend-row" });
        var swatch = htmlEl("span", { "class": "swatch", "aria-hidden": "true" });
        swatch.style.background = row.color;
        swatch.appendChild(glyphIcon(row.ch, row.ink));
        var text = htmlEl("div", { "class": "legend-text" });
        var name = htmlEl("div", { "class": "legend-name" }, row.name);
        if (row.mine) name.appendChild(htmlEl("span", { "class": "legend-me" }, " (ty)"));
        text.appendChild(name);
        text.appendChild(htmlEl("div", { "class": "legend-meta" }, row.people + " · " + row.stay));
        text.appendChild(nightsLine(tableRows[i]));
        li.appendChild(swatch);
        li.appendChild(text);
        list.appendChild(li);
      });
    };
    panel.refresh();
  }, { returnKey: returnKey || "legend" });
}

// The per-night places of one party as a line of parts that do not break inside: "Št → Pi 2/3".
function nightsLine(row) {
  var line = htmlEl("div", { "class": "legend-nights" });
  legendNightParts(row).forEach(function (part, i) {
    if (i) line.appendChild(document.createTextNode(" · "));
    line.appendChild(htmlEl("span", null, part));
  });
  return line;
}
