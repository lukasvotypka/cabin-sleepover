"use strict";

// App part 7: panels that slide over the scene, and the toast.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// --- panels that slide over the scene ---

function closePanel() {
  var p = app.panel;
  if (!p) return;
  app.panel = null;
  document.removeEventListener("keydown", p.onKey, true);
  clearNode($("panelRoot"));
  if (p.onClose) p.onClose();
  // The scene is redrawn while a panel is open, so find the opener again by its key.
  var target = p.returnKey && app.layers ? byKey($("scene"), p.returnKey) : null;
  if (!target && p.returnFocus && document.contains(p.returnFocus)) target = p.returnFocus;
  if (target && target.focus) target.focus({ preventScroll: true });
}

// `build(body, panel)` fills the panel; it may set `panel.refresh` to redraw on new state.
// `opts.returnKey` is the data-key of the scene element that gets focus back on close,
// `opts.initialFocus(body)` picks the element that gets focus first (default: the first button), and
// `opts.onClose` runs after the panel is gone.
function openPanel(title, build, opts) {
  closePanel();
  hideToast();      // a message would sit on top of the sheet buttons
  var root = $("panelRoot");
  var backdrop = htmlEl("div", { "class": "backdrop" });
  var sheet = htmlEl("div", { "class": "sheet", role: "dialog", "aria-modal": "true", "aria-labelledby": "panelTitle" });
  var head = htmlEl("div", { "class": "sheet-head" });
  head.appendChild(htmlEl("h2", { id: "panelTitle" }, title));
  var close = htmlEl("button", { "class": "close", type: "button", "aria-label": "Zavrieť" }, "✕");
  head.appendChild(close);
  var body = htmlEl("div");
  sheet.appendChild(head);
  sheet.appendChild(body);
  root.appendChild(backdrop);
  root.appendChild(sheet);

  opts = opts || {};
  var panel = {
    returnFocus: document.activeElement, returnKey: opts.returnKey || null, onClose: opts.onClose || null,
    refresh: null, onKey: null
  };
  panel.onKey = function (e) {
    // One Escape closes only the panel: it must not reach the move mode handler below.
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePanel(); return; }
    if (e.key !== "Tab") return;
    var items = Array.prototype.filter.call(
      sheet.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex='0']"),
      function (node) { return node.getClientRects().length > 0; }
    );
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener("keydown", panel.onKey, true);
  backdrop.addEventListener("click", closePanel);
  close.addEventListener("click", closePanel);
  app.panel = panel;
  build(body, panel);
  window.requestAnimationFrame(function () {
    sheet.classList.add("open");
    var first = (opts.initialFocus ? opts.initialFocus(body) : null) || body.querySelector("button") || close;
    first.focus({ preventScroll: true });
  });
  return panel;
}

// --- toast ---

function hideToast() {
  $("toast").hidden = true;
}

function showToast(text, kind) {
  var node = $("toast");
  node.textContent = text;
  node.className = kind || "info";
  node.hidden = false;
  clearTimeout(app.toastTimer);
  app.toastTimer = setTimeout(hideToast, TOAST_MS);
}
