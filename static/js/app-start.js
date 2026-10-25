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
// No stream in a hidden tab. It is closed at once: iOS Safari freezes a hidden page right away, so a delayed
// close would never run and the stream would hang open. The server keeps the party online for a 10 s grace
// (STREAM_GRACE in app/seen.py), so a quick return shows no gap to the others.
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState !== "visible") {
    if (live.active) liveStop();
    return;
  }
  if (app.state && !live.fallback && live.supported) { liveEnsure(); return; }   // the new stream brings fresh state
  // A poll still waiting from before the phone slept is most likely dead: drop it and ask again.
  if (app.polling && app.pollAbort) {
    app.pollAgain = true;    // the aborted poll starts a new one when it has finished
    app.pollAbort.abort();
    return;
  }
  poll();
});
// Closing the tab or leaving the page (also into the back-forward cache): close the stream explicitly.
window.addEventListener("pagehide", function () { if (live.active) liveStop(); });
window.addEventListener("pageshow", function (e) {   // back from the back-forward cache: open it again
  if (e.persisted && document.visibilityState === "visible" && app.state && !live.fallback && live.supported) liveEnsure();
});
window.addEventListener("online", function () {
  if (live.supported && !live.fallback && app.state && (!live.es || live.es.readyState === 2)) {   // reopen a closed stream at once
    if (!app.codeOpen && document.visibilityState === "visible") liveOpen();
  }
  else if (!liveStreaming()) poll();
});   // the network is back: do not wait for the tick
setInterval(function () {
  if (document.visibilityState === "visible" && (live.fallback || !live.supported)) poll();
}, POLL_MS);
setInterval(function () { liveTick(); renderAge(); }, AGE_TICK_MS);
poll();           // the first request leaves before anything is drawn
drawSplash();

// Installable app (T-055): a minimal service worker without a fetch handler. A failure changes nothing.
if ("serviceWorker" in navigator) {
  try { navigator.serviceWorker.register("sw.js").catch(function () {}); } catch (err) { /* ignored */ }
}
