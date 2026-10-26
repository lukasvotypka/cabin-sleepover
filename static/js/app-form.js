"use strict";

// App part 10: the party form.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// --- party form ---

var FORM_LABELS = {
  name: "Meno", adults: "Dospelí", kids: "Deti", kids_in_parents_bed: "Deti spiace s rodičmi",
  arrive: "Príchod", leave: "Odchod", day_visits: "Ktoré dni prídeš?", arrival_time: "Čas príchodu", note: "Poznámka", color: "Farba"
};

// The party form for a new party (`party` is null) or to edit one. `opts.returnKey` is the scene element
// that gets focus back on close.
function openPartyForm(party, opts) {
  var event = app.state.event, editing = !!party;
  var fields = {}, errors = {};
  openPanel(editing ? "Upraviť „" + party.name + "“" : "Pridať sa", function (body, panel) {
    var values = editing ? partyToForm(party, event) : defaultPartyForm(event);
    var form = htmlEl("form", { "class": "pform", novalidate: "" });
    var formError = htmlEl("p", { "class": "form-error", role: "alert", hidden: "" });

    // One labelled field: `input` is the control, and a paragraph under it carries that field's error.
    function field(name, input, opts2) {
      var wrap = htmlEl("div", { "class": "field" });
      var label = htmlEl("label", { "for": "pf-" + name }, FORM_LABELS[name]);
      if (opts2 && opts2.optional) label.appendChild(htmlEl("span", { "class": "opt" }, " (nepovinné)"));
      input.id = "pf-" + name;
      input.name = name;
      var err = htmlEl("p", { "class": "field-error", id: "pf-" + name + "-err", hidden: "" });
      input.setAttribute("aria-describedby", "pf-" + name + "-err" + (opts2 && opts2.hint ? " pf-" + name + "-hint" : ""));
      wrap.appendChild(label);
      wrap.appendChild(input);
      if (opts2 && opts2.hint) wrap.appendChild(htmlEl("p", { "class": "hint", id: "pf-" + name + "-hint" }, opts2.hint));
      wrap.appendChild(err);
      fields[name] = input;
      errors[name] = err;
      return wrap;
    }

    function textInput(name, max) {
      var i = htmlEl("input", { type: "text", maxlength: String(max), autocomplete: "off" });
      i.value = values[name];
      return i;
    }

    function countInput(name) {
      var i = htmlEl("input", {
        type: "number", min: "0", max: String(PARTY_LIMITS.countMax), step: "1", inputmode: "numeric"
      });
      i.value = String(values[name]);
      return i;
    }

    function daySelect(name, days) {
      var sel = htmlEl("select");
      days.forEach(function (day) {
        var o = htmlEl("option", { value: day }, dayOptionText(day));
        if (day === values[name]) o.selected = true;
        sel.appendChild(o);
      });
      return sel;
    }

    // The color picker: „Vyberie sa sama“ (create only), the palette swatches and a free color input.
    // `group.value` holds the chosen "#RRGGBB" ("" = the server picks) and is read like an input's value.
    function colorField() {
      var wrap = htmlEl("div", { "class": "field" });
      var group = htmlEl("div", { "class": "colors", role: "group", "aria-labelledby": "pf-color-label", tabindex: "-1", id: "pf-color" });
      group.value = values.color;
      var buttons = [];
      var custom = htmlEl("input", { type: "color", "aria-label": "Vlastná farba", id: "pf-color-custom" });
      custom.value = /^#[0-9A-Fa-f]{6}$/.test(values.color) ? values.color.toLowerCase() : "#2f7d6d";

      function mark() {
        var chosen = group.value.toUpperCase();
        buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-color") === chosen)); });
        var inPalette = PARTY_PALETTE.indexOf(chosen) !== -1;
        custom.classList.toggle("chosen", chosen !== "" && !inPalette);
      }
      function choose(value) {
        group.value = value;
        mark();
        group.dispatchEvent(new Event("change", { bubbles: true }));
      }

      var swatches = htmlEl("div", { "class": "swatches" });
      if (!editing) {
        var auto = htmlEl("button", { "class": "swatch auto", type: "button", "data-color": "", "aria-pressed": "false" }, "Vyberie sa sama");
        auto.addEventListener("click", function () { choose(""); });
        buttons.push(auto);
        swatches.appendChild(auto);
      }
      PARTY_PALETTE.forEach(function (color, i) {
        var b = htmlEl("button", {
          "class": "swatch", type: "button", "data-color": color, "aria-pressed": "false", "aria-label": "Farba " + (i + 1)
        });
        b.style.background = color;
        b.style.color = shirtInk(color);
        b.addEventListener("click", function () { choose(color); });
        buttons.push(b);
        swatches.appendChild(b);
      });
      custom.addEventListener("input", function () { choose(custom.value.toUpperCase()); });

      var customRow = htmlEl("div", { "class": "custom-color" });
      customRow.appendChild(htmlEl("label", { "for": "pf-color-custom" }, "Vlastná farba"));
      customRow.appendChild(custom);
      group.appendChild(swatches);
      group.appendChild(customRow);
      wrap.appendChild(htmlEl("span", { "class": "label", id: "pf-color-label" }, FORM_LABELS.color));
      wrap.appendChild(group);
      var err = htmlEl("p", { "class": "field-error", id: "pf-color-err", hidden: "" });
      wrap.appendChild(err);
      fields.color = group;
      errors.color = err;
      mark();
      return wrap;
    }

    // „Prídem len na návštevu“: a pressed toggle swaps the stay fields for one button per event day.
    var dayOnly = values.day_only;
    var dayToggle = htmlEl("button", { "class": "toggle", type: "button", "aria-pressed": String(dayOnly), id: "pf-day-only" });
    var toggleBox = htmlEl("span", { "class": "box", "aria-hidden": "true" });
    var toggleText = htmlEl("span", null);
    toggleText.appendChild(htmlEl("b", null, "Prídem len na návštevu"));
    toggleText.appendChild(htmlEl("br"));
    toggleText.appendChild(htmlEl("small", null, "Nebudem nocovať, nepotrebujem miesto na spanie."));
    dayToggle.appendChild(toggleBox);
    dayToggle.appendChild(toggleText);

    // `group.value` is the sorted list of the pressed days, read like an input's value.
    function dayField() {
      var wrap = htmlEl("div", { "class": "field" });
      var group = htmlEl("div", { "class": "daygrid", role: "group", "aria-labelledby": "pf-day_visits-label", tabindex: "-1", id: "pf-day_visits" });
      var picked = values.day_visits.slice();
      var buttons = [];
      function mark() {
        group.value = picked.slice().sort();
        buttons.forEach(function (b) {
          var on = picked.indexOf(b.getAttribute("data-day")) !== -1;
          b.setAttribute("aria-pressed", String(on));
          b.firstChild.textContent = on ? "✓" : "";
        });
      }
      eventDays(event).forEach(function (day) {
        var b = htmlEl("button", { "class": "btn secondary", type: "button", "data-day": day });
        b.appendChild(htmlEl("span", { "class": "box", "aria-hidden": "true" }));
        b.appendChild(document.createTextNode(dayLabel(day)));
        b.addEventListener("click", function () {
          var i = picked.indexOf(day);
          if (i === -1) picked.push(day); else picked.splice(i, 1);
          mark();
          group.dispatchEvent(new Event("change", { bubbles: true }));
        });
        buttons.push(b);
        group.appendChild(b);
      });
      var err = htmlEl("p", { "class": "field-error", id: "pf-day_visits-err", hidden: "" });
      group.setAttribute("aria-describedby", "pf-day_visits-err pf-day_visits-hint");
      wrap.appendChild(htmlEl("span", { "class": "label", id: "pf-day_visits-label" }, FORM_LABELS.day_visits));
      wrap.appendChild(group);
      wrap.appendChild(htmlEl("p", { "class": "hint", id: "pf-day_visits-hint" }, "Môžeš vybrať aj dni, ktoré nejdú po sebe."));
      wrap.appendChild(err);
      fields.day_visits = group;
      errors.day_visits = err;
      mark();
      return wrap;
    }

    var note = htmlEl("textarea", { maxlength: String(PARTY_LIMITS.note), rows: "3" });
    note.value = values.note;

    form.appendChild(formError);
    form.appendChild(field("name", textInput("name", PARTY_LIMITS.name), { hint: "napr. Jano, Jano a Zuzka, Novákovci" }));
    var pair = htmlEl("div", { "class": "pair" });
    pair.appendChild(field("adults", countInput("adults")));
    pair.appendChild(field("kids", countInput("kids")));
    form.appendChild(dayToggle);
    form.appendChild(pair);
    var inBed = field("kids_in_parents_bed", countInput("kids_in_parents_bed"), {
      hint: "Takéto dieťa nepotrebuje vlastné miesto."
    });
    form.appendChild(inBed);
    var days = htmlEl("div", { "class": "pair" });
    days.appendChild(field("arrive", daySelect("arrive", event.arrive_days)));
    days.appendChild(field("leave", daySelect("leave", event.leave_days)));
    form.appendChild(days);
    var dayGrid = dayField();
    form.appendChild(dayGrid);
    // The hidden fields keep their values, so toggling back and forth loses nothing.
    function applyMode() {
      toggleBox.textContent = dayOnly ? "✓" : "";
      dayToggle.setAttribute("aria-pressed", String(dayOnly));
      inBed.hidden = dayOnly;
      days.hidden = dayOnly;
      dayGrid.hidden = !dayOnly;
    }
    dayToggle.addEventListener("click", function () {
      dayOnly = !dayOnly;
      applyMode();
      clearErrors();
      form.dispatchEvent(new Event("change"));
    });
    applyMode();
    form.appendChild(field("arrival_time", textInput("arrival_time", PARTY_LIMITS.arrival_time), { optional: true }));
    form.appendChild(field("note", note, { optional: true }));
    form.appendChild(colorField());

    var confirmBox = htmlEl("div", { "class": "note", hidden: "", role: "alert" });
    form.appendChild(confirmBox);
    var row = htmlEl("div", { "class": "row" });
    var save = htmlEl("button", { "class": "btn", type: "submit", "data-key": "save" }, "Uložiť");
    var cancel = htmlEl("button", { "class": "btn secondary", type: "button" }, "Zrušiť");
    cancel.addEventListener("click", closePanel);
    row.appendChild(save);
    row.appendChild(cancel);
    form.appendChild(row);
    body.appendChild(form);
    if (!canWrite(app.state, app.role)) {
      // Signup is closed: show the party, but nothing can be saved.
      form.insertBefore(htmlEl("p", { "class": "note" }, LOCKED_TEXTS.note), form.firstChild);
      Array.prototype.forEach.call(form.querySelectorAll("input, select, textarea, button"), function (el) {
        if (el !== cancel) el.disabled = true;
      });
      save.hidden = true;
      cancel.textContent = "Zavrieť";
    }

    function readPayload() {
      var raw = {};
      FORM_FIELDS.forEach(function (name) {
        var input = fields[name];
        // A number field with unreadable text reports an empty value: keep it as an error, not a 0.
        raw[name] = input.validity && input.validity.badInput ? "?" : input.value;
      });
      raw.day_only = dayOnly;
      return partyPayload(raw);
    }

    function clearErrors() {
      FORM_FIELDS.forEach(function (name) {
        errors[name].hidden = true;
        errors[name].textContent = "";
        fields[name].removeAttribute("aria-invalid");
      });
      formError.hidden = true;
      formError.textContent = "";
    }

    // The Slovak text of an error goes next to the field it is about, else on top of the form.
    function showError(error) {
      clearErrors();
      var name = errorField(error), text = errorText(error, app.state);
      if (name) {
        errors[name].textContent = text;
        errors[name].hidden = false;
        fields[name].setAttribute("aria-invalid", "true");
        fields[name].focus();
      } else {
        formError.textContent = text;
        formError.hidden = false;
        formError.scrollIntoView({ block: "nearest" });
      }
    }

    function hideConfirm() {
      confirmBox.hidden = true;
      clearNode(confirmBox);
      save.textContent = "Uložiť";
      save.removeAttribute("data-confirm");
    }

    // Shortening a stay frees places: name them and ask once.
    function askToFree(freed) {
      clearNode(confirmBox);
      confirmBox.appendChild(htmlEl("p", null, FREED_TEXTS.ask));
      var list = htmlEl("ul", { "class": "freed" });
      freedLines(app.state, freed).forEach(function (line) { list.appendChild(htmlEl("li", null, line)); });
      confirmBox.appendChild(list);
      confirmBox.hidden = false;
      save.textContent = "Uložiť a uvoľniť miesta";
      save.setAttribute("data-confirm", "1");
      save.focus();
    }

    function showDone(freed) {
      clearNode(body);
      body.appendChild(htmlEl("p", null, FREED_TEXTS.done));
      var list = htmlEl("ul", { "class": "done-list" });
      freedLines(app.state, freed).forEach(function (line) { list.appendChild(htmlEl("li", null, line)); });
      body.appendChild(list);
      var ok = htmlEl("button", { "class": "btn", type: "button" }, "Zavrieť");
      ok.addEventListener("click", closePanel);
      body.appendChild(ok);
      ok.focus();
    }

    function send(payload) {
      save.disabled = true;
      save.textContent = "Ukladám…";
      var req = editing ? write("PUT", "api/parties/" + encodeURIComponent(party.id), payload) : write("POST", "api/parties", payload);
      req.then(function (res) {
        if (res.ok) {
          var created = res.json && res.json.party;
          if (!editing && created) {
            setMyParty(created.id);
            app.night = defaultNightFor(created, app.state.event.nights);
            render();
          }
          var freed = (res.json && res.json.freed) || [];
          if (app.panel !== panel) return;
          if (freed.length) { showDone(freed); return; }
          closePanel();
          showToast(editing ? "Zmeny sú uložené." : "Pridané: „" + payload.name + "“.", "info");
          return;
        }
        if (app.panel !== panel || res.status === 401) return;
        save.disabled = false;
        hideConfirm();
        showError(res.error || { code: "" });
      });
    }

    form.addEventListener("input", function () {
      if (!confirmBox.hidden) hideConfirm();
    });
    form.addEventListener("change", function () {
      if (!confirmBox.hidden) hideConfirm();
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (save.disabled) return;
      clearErrors();
      var payload = readPayload();
      var problem = checkPartyPayload(payload, event, editing ? party.color : "");
      if (problem) { hideConfirm(); showError(problem); return; }
      if (editing && !save.getAttribute("data-confirm")) {
        var freed = freedByStay(app.state, party.id, payload.day_visits ? null : payload.arrive, payload.day_visits ? null : payload.leave);
        if (freed.length) { askToFree(freed); return; }
      }
      send(payload);
    });
  }, {
    returnKey: opts && opts.returnKey,
    initialFocus: function (body) { return body.querySelector("input"); }
  });
}
