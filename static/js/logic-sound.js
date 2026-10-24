"use strict";

// Logic: the timing and shape of the scene sounds (a bird's chirp, the wind in the tree). Pure functions
// that take a random source `rand` (a function returning [0, 1)), so they can be tested in Node; the playing
// is in app-sound.js.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// The bird's cycle in the style sheet (`birdFly`): 28 s, of which the first 22 % is the flight across the map.
var BIRD_CYCLE_S = 28;
var BIRD_FLIGHT_S = BIRD_CYCLE_S * .22;
var BIRD_CHIRP_EDGE_S = .8;      // never right at the edges, where the bird is still off the map

// When, in seconds after the flight starts, the bird chirps: a random moment while it is over the map.
function birdChirpDelay(rand) {
  return BIRD_CHIRP_EDGE_S + rand() * (BIRD_FLIGHT_S - 2 * BIRD_CHIRP_EDGE_S);
}

// One chirp: two to four short tweets, each a quick pitch slide. `at` and `dur` in seconds, `f0` and `f1` in Hz.
function chirpNotes(rand) {
  var count = 2 + Math.floor(rand() * 3), notes = [], at = 0, i;
  var base = 2600 + rand() * 1400;
  for (i = 0; i < count; i++) {
    var dur = .06 + rand() * .07, up = rand() < .35;
    var f0 = base * (up ? .8 : 1.15) + rand() * 300, f1 = base * (up ? 1.2 : .7);
    notes.push({ at: at, dur: dur, f0: f0, f1: f1, gain: .5 + rand() * .5 });
    at += dur + .03 + rand() * .08;
  }
  return notes;
}

// The wind in the tree crown when it is tapped (sample 3, „Whistling wind“, chosen by the organizer on
// 25. 10. 2026): a thin whistle through the branches over a low breeze, with the leaves fluttering in it. Each
// layer is noise through a filter: `type` (band-pass unless given) and `q`, its frequency following `freq` and
// its loudness following `gain` ([seconds, value] points), and an optional `flutter` of quick random dips.
var TREE_WIND = [
  { q: 9, freq: [[0, 520], [1.1, 780], [2.8, 600]], gain: [[0, 0], [1.0, .55], [2.8, 0]] },
  { type: "lowpass", q: .5, freq: [[0, 500], [2.8, 500]], gain: [[0, 0], [1.0, .3], [2.8, 0]] },
  { q: .9, freq: [[0, 4000], [2.8, 4000]], gain: [[0, 0], [1.2, .15], [2.8, 0]], flutter: { rate: 9, depth: .7 } }
];

// How long a layer lasts: its last gain point.
function windLayerEnd(layer) {
  return layer.gain[layer.gain.length - 1][0];
}

// The flutter of a layer: [seconds, gain 0 to 1] points at about `rate` per second up to `end`, each a dip of
// up to `depth`.
function flutterSteps(flutter, end, rand) {
  var steps = [], t = 0;
  while (t < end) {
    t += 1 / (flutter.rate * (.6 + rand() * .8));
    steps.push([t, 1 - flutter.depth * rand()]);
  }
  return steps;
}
