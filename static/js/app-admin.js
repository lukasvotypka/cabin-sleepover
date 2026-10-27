"use strict";

// App part: the organizer's key icon and admin panel (T-076): lock signup, download the data, delete a party.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// The key icon, drawn only for the admin role. The hit area is the whole key cell of the icon grid (isoScene).
function drawKey(parent, r) {
  var g = svgEl(parent, "g");
  var x = r[0] + (r[2] - 28) / 2, y = r[1] + (r[3] - 28) / 2;
  blockShadow(g, [x, y + 2, 28, 16]);
  rect(g, x, y + 2, 16, 16, COLORS.amberEdge);               // the bow (ring)
  rect(g, x + 4, y + 6, 8, 8, COLORS.grass);                 // the hole
  rect(g, x + 14, y + 8, 14, 4, COLORS.amberEdge);           // the shaft
  rect(g, x + 22, y + 12, 3, 6, COLORS.amberEdge);           // the teeth
  rect(g, x + 26, y + 12, 2, 4, COLORS.amberEdge);
  rect(g, x + 3, y + 3, 10, 2, COLORS.amber, { opacity: ".7" });
  iconCaption(g, r[0] + r[2] / 2, r[1] + 37, "Admin");
  hitRect(g, r);
  makeButton(g, "Admin nástroje", "key", openAdmin);
}

// Called when the role changes (the admin code was entered or the admin cookie is gone).
function renderAdminUi() {
  if (!isAdmin(app.role) && app.panel && app.panel.isAdmin) closePanel();
  if (app.state) render();
}

// Downloads the export through fetch, so an expired admin cookie shows the Slovak error and hides the admin UI.
function downloadExport() {
  fetch("api/admin/export", { credentials: "same-origin", cache: "no-store", headers: { "X-Client-Id": clientId } }).then(function (res) {
    if (res.ok) {
      var cd = res.headers.get("Content-Disposition") || "";
      var m = /filename="?([^";]+)"?/.exec(cd);
      return res.blob().then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = htmlEl("a", { href: url, download: m ? m[1] : "cabin-data.yaml" });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      });
    }
    return res.json().then(function (json) { return json; }, function () { return null; }).then(function (json) {
      var err = json ? json.error : undefined;
      var role = roleAfterResponse(app.role, res.status, err);
      if (role !== app.role) setRole(role);
      if (res.status === 401) showCodeScreen();
      else showToast(errorText(err, app.state), "error");
    });
  }).then(null, function () { showToast(errorText(undefined, app.state), "error"); });
}

function openAdmin() {
  if (!isAdmin(app.role)) return;
  var mode = "main", picked = null;
  openPanel("Admin", function (body, panel) {
    panel.isAdmin = true;
    function btn(text, cls, key, onClick) {
      var b = htmlEl("button", { "class": cls, type: "button", "data-key": key }, text);
      b.addEventListener("click", onClick);
      return b;
    }
    function fail(res) {
      if (!res.ok && res.status !== 401) showToast(errorText(res.error, app.state), "error");
    }
    function show() {
      clearNode(body);
      var box = htmlEl("div", { "class": "actions admin-tools" });
      body.appendChild(box);
      var parties = app.state ? app.state.parties : [];
      if (mode === "confirm" && !partyById(app.state, picked)) mode = "pick";
      if (mode === "main") {
        box.appendChild(btn(signupToggleLabel(app.state.signup_open), "btn", "admin-signup", function () {
          lock.disabled = true;
          write("POST", "api/admin/signup", { open: app.state.signup_open === false }).then(function (res) {
            fail(res);
            if (app.panel === panel) show();
          });
        }));
        var lock = box.lastChild;
        box.appendChild(btn(phoneVerifyToggleLabel(app.state.phone_verify), "btn secondary", "admin-phone-verify", function () {
          write("POST", "api/admin/phone-verify", { on: app.state.phone_verify === false }).then(function (res) {
            fail(res);
            if (app.panel === panel) show();
          });
        }));
        box.appendChild(btn("Stiahnuť dáta", "btn secondary", "admin-export", function () { downloadExport(); }));
        box.appendChild(btn("Zmazať partiu", "btn secondary danger", "admin-delete", function () { mode = "pick"; show(); }));
      } else if (mode === "pick") {
        body.insertBefore(htmlEl("p", null, parties.length ? "Vyber partiu, ktorú chceš zmazať." : "Nie je čo zmazať."), box);
        var list = htmlEl("ul", { "class": "party-list" });
        parties.forEach(function (party) {
          var li = htmlEl("li");
          var row = htmlEl("button", { "class": "party-row", type: "button", "data-key": "admin-party-" + party.id });
          var swatch = htmlEl("span", { "class": "swatch", "aria-hidden": "true" });
          swatch.style.background = party.color;
          row.appendChild(swatch);
          row.appendChild(htmlEl("span", { "class": "name" }, party.name));
          row.addEventListener("click", function () { picked = party.id; mode = "confirm"; show(); });
          li.appendChild(row);
          list.appendChild(li);
        });
        body.insertBefore(list, box);
        box.appendChild(btn("Späť", "btn secondary", "admin-back", function () { mode = "main"; show(); }));
      } else {
        var party = partyById(app.state, picked);
        body.insertBefore(htmlEl("p", { "class": "confirm-text" }, deleteConfirmText(party.name)), box);
        var del = btn("Zmazať", "btn danger", "admin-confirm-delete", function () {
          del.disabled = true;
          write("DELETE", "api/parties/" + encodeURIComponent(party.id)).then(function (res) {
            fail(res);
            if (res.ok) { mode = "main"; picked = null; }
            if (app.panel === panel) show();
          });
        });
        box.appendChild(del);
        box.appendChild(btn("Späť", "btn secondary", "admin-back", function () { mode = "pick"; show(); }));
      }
    }
    panel.refresh = show;
    show();
  }, { returnKey: "key" });
}
