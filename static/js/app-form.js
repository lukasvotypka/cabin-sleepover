"use strict";

// App part 10: the party form.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// --- party form ---

var FORM_LABELS = {
  name: "Meno", adults: "Dospelí", kids: "Deti", kids_in_parents_bed: "Deti spiace s rodičmi",
  arrive: "Príchod", leave: "Odchod", arrival_time: "Čas príchodu", note: "Poznámka"
};

// The party form for a new party (`party` is null) or to edit one. `opts.returnKey` is the scene element
// that gets focus back on close.
function openPartyForm(party, opts) {
  var event = app.state.event, editing = !!party;
  var fields = {}, errors = {};
  openPanel(editing ? "Upraviť „" + party.name + "“" : "Pridať sa", function (body, panel) {
    var values = editing ? partyToForm(party) : defaultPartyForm(event);
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

    var note = htmlEl("textarea", { maxlength: String(PARTY_LIMITS.note), rows: "3" });
    note.value = values.note;

    form.appendChild(formError);
    form.appendChild(field("name", textInput("name", PARTY_LIMITS.name), { hint: "napr. Jano, Jano a Zuzka, Novákovci" }));
    var pair = htmlEl("div", { "class": "pair" });
    pair.appendChild(field("adults", countInput("adults")));
    pair.appendChild(field("kids", countInput("kids")));
    form.appendChild(pair);
    form.appendChild(field("kids_in_parents_bed", countInput("kids_in_parents_bed"), {
      hint: "Takéto dieťa nepotrebuje vlastné miesto."
    }));
    var days = htmlEl("div", { "class": "pair" });
    days.appendChild(field("arrive", daySelect("arrive", event.arrive_days)));
    days.appendChild(field("leave", daySelect("leave", event.leave_days)));
    form.appendChild(days);
    form.appendChild(field("arrival_time", textInput("arrival_time", PARTY_LIMITS.arrival_time), { optional: true }));
    form.appendChild(field("note", note, { optional: true }));

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

    function readPayload() {
      var raw = {};
      FORM_FIELDS.forEach(function (name) {
        var input = fields[name];
        // A number field with unreadable text reports an empty value: keep it as an error, not a 0.
        raw[name] = input.validity && input.validity.badInput ? "?" : input.value;
      });
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
      var problem = checkPartyPayload(payload, event);
      if (problem) { hideConfirm(); showError(problem); return; }
      if (editing && !save.getAttribute("data-confirm")) {
        var freed = freedByStay(app.state, party.id, payload.arrive, payload.leave);
        if (freed.length) { askToFree(freed); return; }
      }
      send(payload);
    });
  }, {
    returnKey: opts && opts.returnKey,
    initialFocus: function (body) { return body.querySelector("input"); }
  });
}
