"use strict";

// App part 11b: the scene sounds (organizer request, 24. 10. 2026). The bird chirps once at a random moment of
// each flight, and a tap on the tree blows wind through its crown. Synthesized with Web Audio, so there
// are no sound files. Browsers allow sound only after the first touch, click or key, so the audio starts then;
// before that the bird is silent. With `prefers-reduced-motion` the bird is hidden and never chirps. The speaker
// button in „Kto si?“ mutes all sounds on this device (remembered in browser storage).
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

var SOUND_VOLUME = .12;
var WIND_BOOST = 4;      // the filtered noise is much quieter than the chirp's sine at the same gain

function soundContext() {
  if (app.audio) return app.audio;
  var Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try { app.audio = new Ctx(); } catch (err) { return null; }
  app.audioOut = app.audio.createGain();
  app.audioOut.gain.value = SOUND_VOLUME;
  app.audioOut.connect(app.audio.destination);
  return app.audio;
}

// Called from a touch, click or key: creates or wakes the audio (iOS Safari allows that only inside a gesture).
// iOS leaves the audio "interrupted" (not "suspended") after the app was in the background, the screen locked or a
// call, so anything but "running" is woken; a closed one is replaced.
function unlockSound() {
  if (app.audio && app.audio.state === "closed") app.audio = app.noise = null;
  var ctx = soundContext();
  if (ctx && ctx.state !== "running") ctx.resume().catch(function () {});
}
["pointerdown", "touchend", "keydown"].forEach(function (type) {
  document.addEventListener(type, unlockSound, { capture: true, passive: true });
});
// Back in front: try to wake the audio at once (may need the next tap on iOS, which unlockSound handles).
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible" && app.audio && app.audio.state !== "running" && app.audio.state !== "closed") {
    app.audio.resume().catch(function () {});
  }
});

app.muted = storage.get(KEYS.sound) === "off";

// The audio when it may play now: not muted, unlocked, running and the tab in front.
function liveSound() {
  var ctx = app.audio;
  return !app.muted && ctx && ctx.state === "running" && document.visibilityState === "visible" ? ctx : null;
}

// A pixel speaker, 9 x 7 cells: [x, y, width, height]. With sound on it sends two waves, muted it has a cross.
var SPEAKER_CELLS = [[0, 2, 2, 3], [2, 1, 1, 5], [3, 0, 1, 7]];
var SPEAKER_ON = [[5, 2, 1, 3], [7, 1, 1, 5]];
var SPEAKER_OFF = [[5, 2, 1, 1], [7, 2, 1, 1], [6, 3, 1, 1], [5, 4, 1, 1], [7, 4, 1, 1]];

function drawSpeaker(button) {
  clearNode(button);
  var svg = svgEl(button, "svg", {
    viewBox: "0 0 9 7", width: "27", height: "21", "shape-rendering": "crispEdges", "aria-hidden": "true", focusable: "false"
  });
  SPEAKER_CELLS.concat(app.muted ? SPEAKER_OFF : SPEAKER_ON).forEach(function (c) {
    svgEl(svg, "rect", { x: c[0], y: c[1], width: c[2], height: c[3], fill: "currentColor" });
  });
  button.setAttribute("aria-pressed", app.muted ? "true" : "false");
  button.setAttribute("aria-label", app.muted ? "Zapnúť zvuky" : "Vypnúť zvuky");
  button.title = app.muted ? "Zapnúť zvuky" : "Vypnúť zvuky";
}

// The mute button for a panel head (next to the close button).
function soundToggle() {
  var button = htmlEl("button", { "class": "close sound-toggle", type: "button", "data-key": "sound-toggle" });
  drawSpeaker(button);
  button.addEventListener("click", function () {
    app.muted = !app.muted;
    if (app.muted) storage.set(KEYS.sound, "off");
    else storage.remove(KEYS.sound);
    if (app.muted) clearTimeout(app.chirpTimer);
    drawSpeaker(button);
  });
  return button;
}

function noiseBuffer(ctx) {
  if (app.noise) return app.noise;
  var length = Math.floor(ctx.sampleRate * 2), buf = ctx.createBuffer(1, length, ctx.sampleRate);
  var data = buf.getChannelData(0), i;
  for (i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  app.noise = buf;
  return buf;
}

// A gain node that swells in over `attack` s, then fades out by `at + dur`.
function envelope(ctx, at, dur, gain, attack) {
  var g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(.001, at + dur);
  g.connect(app.audioOut);
  return g;
}

function playChirp() {
  var ctx = liveSound();
  if (!ctx) return;
  var t0 = ctx.currentTime + .02;
  chirpNotes(Math.random).forEach(function (n) {
    var osc = ctx.createOscillator(), at = t0 + n.at;
    osc.type = "sine";
    osc.frequency.setValueAtTime(n.f0, at);
    osc.frequency.exponentialRampToValueAtTime(n.f1, at + n.dur);
    osc.connect(envelope(ctx, at, n.dur, n.gain * .6, .01));
    osc.start(at);
    osc.stop(at + n.dur + .02);
  });
}

// Follows [seconds, value] points from `t0` on.
function followCurve(param, t0, points) {
  param.setValueAtTime(points[0][1], t0 + points[0][0]);
  points.slice(1).forEach(function (p) { param.linearRampToValueAtTime(p[1], t0 + p[0]); });
}

// One layer of `TREE_WIND`: looping noise through its filter, flutter and loudness.
function playWindLayer(ctx, t0, layer) {
  var src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), flutter = ctx.createGain(), gain = ctx.createGain();
  var end = windLayerEnd(layer);
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  filter.type = layer.type || "bandpass";
  filter.Q.value = layer.q;
  followCurve(filter.frequency, t0, layer.freq);
  flutter.gain.value = 1;
  if (layer.flutter) {
    flutterSteps(layer.flutter, end, Math.random).forEach(function (p) { flutter.gain.linearRampToValueAtTime(p[1], t0 + p[0]); });
  }
  followCurve(gain.gain, t0, layer.gain.map(function (p) { return [p[0], p[1] * WIND_BOOST]; }));
  src.connect(filter);
  filter.connect(flutter);
  flutter.connect(gain);
  gain.connect(app.audioOut);
  src.start(t0, Math.random());
  src.stop(t0 + end + .05);
}

function playTreeWind() {
  var ctx = liveSound();
  if (!ctx) return;
  var t0 = ctx.currentTime + .02;
  TREE_WIND.forEach(function (layer) { playWindLayer(ctx, t0, layer); });
}

// The bird's `birdFly` animation starts a flight on its start and on every repeat: one chirp somewhere in it.
// The flap animations of its frames bubble up here too and are ignored.
function onBirdFlight(e) {
  if (e.animationName !== "birdFly") return;
  clearTimeout(app.chirpTimer);
  app.chirpTimer = setTimeout(playChirp, birdChirpDelay(Math.random) * 1000);
}

// A tap on the tree: the crown sways and the wind whistles through it.
function rustleTree(tree) {
  unlockSound();
  playTreeWind();
  tree.classList.remove("rustle");
  void tree.getBBox();      // restart the sway when tapped again during it
  tree.classList.add("rustle");
  clearTimeout(app.rustleTimer);
  app.rustleTimer = setTimeout(function () { tree.classList.remove("rustle"); }, 700);
}
