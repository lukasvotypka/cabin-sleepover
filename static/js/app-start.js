"use strict";

// App part 12: event listeners, the first poll and the splash. Loaded last.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// --- start ---

$("moveThis").addEventListener("click", function () { if (app.move) { app.move.all = false; renderMoveBar(); } });
$("moveAll").addEventListener("click", function () { if (app.move) { app.move.all = true; renderMoveBar(); } });
$("moveCancel").addEventListener("click", cancelMove);
$("toast").addEventListener("click", hideToast);
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && app.move && !app.panel) cancelMove();
});
document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape" && e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") app.navKeyAt = Date.now();
}, true);
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState !== "visible") return;
  // A poll still waiting from before the phone slept is most likely dead: drop it and ask again.
  if (app.polling && app.pollAbort) {
    app.pollAgain = true;    // the aborted poll starts a new one when it has finished
    app.pollAbort.abort();
    return;
  }
  poll();
});
window.addEventListener("online", function () { poll(); });   // the network is back: do not wait for the tick
setInterval(function () {
  if (document.visibilityState === "visible") poll();
}, POLL_MS);
setInterval(renderAge, AGE_TICK_MS);
poll();           // the first request leaves before anything is drawn
drawSplash();
