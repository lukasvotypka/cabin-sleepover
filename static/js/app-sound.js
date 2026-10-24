"use strict";

// App part 11b: the scene sounds (organizer request, 24. 10. 2026). The bird chirps once at a random moment of
// each flight, and a tap on the tree blows wind through its crown. Synthesized with Web Audio, so there
// are no sound files. Browsers allow sound only after the first touch, click or key, so the audio starts then;
// before that the bird is silent. With `prefers-reduced-motion` the bird is hidden and never chirps.
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
function unlockSound() {
  var ctx = soundContext();
  if (ctx && ctx.state === "suspended") ctx.resume();
}
["pointerdown", "touchend", "keydown"].forEach(function (type) {
  document.addEventListener(type, unlockSound, { capture: true, passive: true });
});

// The audio when it may play now: unlocked, running and the tab in front.
function liveSound() {
  var ctx = app.audio;
  return ctx && ctx.state === "running" && document.visibilityState === "visible" ? ctx : null;
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
