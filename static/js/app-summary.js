"use strict";

// App part 11: „Prehľad na poslanie“ and the code screen.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// --- „Prehľad na poslanie“ ---

function pageLink() {
  return window.location.origin + window.location.pathname;
}

function openSummary() {
  openPanel("Prehľad na poslanie", function (body, panel) {
    body.appendChild(htmlEl("p", null, "Skopíruj text a pošli ho do skupiny."));
    var area = htmlEl("textarea", { "class": "summary-text", readonly: "", rows: "14", "aria-label": "Text na poslanie" });
    var status = htmlEl("p", { "class": "copy-status", role: "status" });
    var copy = htmlEl("button", { "class": "btn", type: "button", "data-key": "copy" }, "Kopírovať");
    body.appendChild(area);
    body.appendChild(copy);
    body.appendChild(status);

    // The text follows the state while the panel is open (a poll may change it).
    panel.refresh = function () {
      var text = app.state ? summaryText(viewState().state, pageLink()) : "";
      if (area.value !== text) area.value = text;
    };

    function selectText() {
      area.focus({ preventScroll: true });
      area.select();
      area.setSelectionRange(0, area.value.length);
    }

    function fallback() {
      selectText();
      var copied = false;
      try { copied = document.execCommand("copy"); } catch (e) { copied = false; }
      status.textContent = copied ? "Skopírované." : "Text je označený, skopíruj ho.";
    }

    copy.addEventListener("click", function () {
      var text = area.value;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          status.textContent = "Skopírované.";
        }, fallback);
      } else {
        fallback();
      }
    });
    panel.refresh();
  }, { returnKey: "letter" });
}

// --- code screen ---

function showCodeScreen(voluntary) {
  if (app.codeOpen) return;
  app.codeOpen = true;
  app.codeVoluntary = voluntary === true;
  $("codeBack").hidden = !app.codeVoluntary;
  liveStop();
  cancelWalks();
  closePanel();
  hideToast();
  app.move = null;
  renderMoveBar();
  if (app.introTimer !== null) {
    clearTimeout(app.introTimer);
    app.introTimer = null;
  }
  hideBoot();
  stopIntroZoom();     // a 401 during the fall never reaches finishSplash: the intro must not wait on a touch
  showScene(false);
  $("codeScreen").hidden = false;
  $("codeInput").focus();
}

// „Späť“ on a code screen that the visitor opened himself: back to the map.
$("codeBack").addEventListener("click", function () {
  hideCodeScreen();
  showScene(app.introDone);
  liveOpen();
});

function hideCodeScreen() {
  app.codeOpen = false;
  $("codeScreen").hidden = true;
  $("codeError").textContent = "";
}

$("codeForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var input = $("codeInput"), button = $("codeButton"), errorNode = $("codeError");
  var code = input.value.trim();
  if (!code) {
    errorNode.textContent = "Najprv napíš kód.";
    input.focus();
    return;
  }
  button.disabled = true;
  errorNode.textContent = "";
  request("POST", "api/join", { code: code }).then(function (r) {
    if (r.status === 200 && r.json && r.json.ok) {
      if (r.json.role) setRole(r.json.role);
      input.value = "";
      app.askWho = !app.myParty || app.codeVoluntary;
      app.etag = null;
      hideCodeScreen();
      // Before the first reveal (no state yet, or one that was only stored) the splash shows again
      // and the intro clock restarts, so the intro plays once, after the code.
      if (!app.introDone) {
        app.introStart = performance.now();
        showBoot();
      }
      showScene(app.introDone);
      poll();
    } else {
      errorNode.textContent = errorText(r.json ? r.json.error : undefined, null);
      input.focus();
    }
  }, function () {
    errorNode.textContent = errorText(undefined, null);
  }).then(function () {
    button.disabled = false;
  });
});
