// Pure page logic: the people of the isometric 3D world as small voxel dolls (T-138).
// No DOM, no browser globals: tests/js/logic.test.mjs loads all logic-*.js files into one Node vm context.
// Plain script, shares the global scope with the other logic-*.js and app-*.js files (see index.html for the order).
//
// A doll is built from a few boxes (isoFigureLayout) in "doll units", then scaled by ISO.figScale in the 3D world.
// Poses: "stand" (on the meadow), "sit" (day, in bed) and "lie" (night, under a quilt). All steps of the little
// animations (pop in, shake, fade, hop, walk) count ticks of the shared 8 fps tick (ISO_TICK_MS), no smooth tweens.

var ISO_PEOPLE = {
  kid: 0.72,                    // a kid is an adult scaled by this
  skin: "#F1C7A0", hair: "#4A2E1E", eye: "#2A1A12",
  ring: "#FFD23F",             // the ring around my party's figure
  pop: [0.4, 1.15, 1],         // scale of the three frames when a figure appears
  shake: [1, -1],              // x offsets of the two frames of a rejected figure
  fadeSteps: 4,                // opacity steps of the 06:00 swap
  hopEvery: 32,                // a meadow waiter hops every 32 ticks (4 s) ...
  hopFrames: 2,                // ... for 2 ticks
  lift: 3,                     // the figure picked in the move mode
  walkMs: 1600                 // the walk from the meadow to a bed in 3D (at most)
};

// The boxes of a doll: {c, x, y, z, w, h, d}, x and z the middle, y the bottom, +z the front (the side with the
// face and the letter), all multiplied by the kid factor. `c` is the colour key: legs, body, skin, hair, eye, quilt.
function isoFigureLayout(kind, pose) {
  var f = kind === "kid" ? ISO_PEOPLE.kid : 1, parts = [], letter;
  function add(c, x, y, z, w, h, d) { parts.push({ c: c, x: x * f, y: y * f, z: z * f, w: w * f, h: h * f, d: d * f }); }
  if (pose === "lie") {      // head north on the pillow, the quilt over the body, 15 units long in all
    add("skin", 0, 0.6, -3.5, 4, 3.5, 3);
    add("hair", 0, 0.6, -5.5, 4.4, 3.7, 1);
    add("eye", -1, 4.1, -2.4, 1, 0.25, 1);
    add("eye", 1, 4.1, -2.4, 1, 0.25, 1);
    add("quilt", 0, 0, 1.5, 6.5, 1.5, 7);
    letter = { x: 0, y: 1.55, z: 1.5, size: 3.6, flat: true };
  } else {
    var base = pose === "stand" ? 3 : 0;      // a sitting doll has no legs showing
    if (pose === "stand") add("legs", 0, 0, 0, 4, 3, 4);
    add("body", 0, base, 0, 5, 4, 4);
    add("skin", 0, base + 4, 0, 4, 3, 4);
    add("hair", 0, base + 7, 0, 4.4, 1, 4.4);
    add("hair", 0, base + 4, -2.1, 4.4, 3, 0.6);
    add("eye", -1, base + 5.2, 2.1, 1, 1, 0.25);
    add("eye", 1, base + 5.2, 2.1, 1, 1, 0.25);
    letter = { x: 0, y: base + 2, z: 2.05, size: 3.6, flat: false };
  }
  letter = { x: letter.x * f, y: letter.y * f, z: letter.z * f, size: letter.size * f, flat: letter.flat };
  return { parts: parts, letter: letter };
}

// The colours of a doll for a party colour: dark legs (-30 %), the body, and the quilt (+35 % white).
function isoFigureColors(color) {
  return { legs: isoMix(color, "#000000", 0.3), body: color, quilt: isoMix(color, "#FFFFFF", 0.35) };
}

// The height of a sitting doll in doll units (a kid is smaller).
function isoSitHeight(kind) {
  return 8 * (kind === "kid" ? ISO_PEOPLE.kid : 1);
}

// 1, or 0.85 when a sitting doll would reach the berth above it (the lower berth of a bunk, T-138 Design):
// `figScale` is ISO.figScale. The clearance is the gap from the lower berth top to the underside of the upper one.
function isoSitScale(bed, index, kind, figScale) {
  if (bed.kind !== "bunk" || index === 0) return 1;
  var clear = (ISO_BUNK_TOP - 3) - ISO_BED_TOP.bunk - 2;
  return isoSitHeight(kind) * figScale > clear ? 0.85 : 1;
}

// The scale of frame `step` of the pop in (-1 = done: 1).
function isoPopScale(step) {
  return step >= 0 && step < ISO_PEOPLE.pop.length ? ISO_PEOPLE.pop[step] : 1;
}

// The opacity of a fading figure `elapsed` ms after the swap began: `dir` 1 fades in, -1 out, in 4 steps (never 0 on the first
// frame of a fade in, so it is seen at once; exactly 0 after the last step of a fade out).
function isoFadeAlpha(dir, elapsed) {
  var n = ISO_PEOPLE.fadeSteps, step = Math.max(0, Math.floor(elapsed / ISO_TICK_MS)), a = Math.min(1, (step + 1) / n);
  return dir > 0 ? a : Math.max(0, 1 - a);
}

// Rounds an opacity to a quarter, so a few cached materials are enough.
function isoQuarter(o) {
  return Math.round(Math.max(0, Math.min(1, o)) * 4) / 4;
}

// 1 (one unit up) for the two ticks in which waiter `index` of `count` hops, else 0: every hopEvery ticks one random waiter.
function isoWaiterHop(tick, index, count) {
  if (count < 1 || tick % ISO_PEOPLE.hopEvery >= ISO_PEOPLE.hopFrames) return 0;
  return Math.floor(isoNoise(Math.floor(tick / ISO_PEOPLE.hopEvery), 71) * count) === index ? 1 : 0;
}

// The height offset of the figure picked in the move mode: lifted 3 units and bobbing 1 unit every tick.
function isoLiftOffset(tick) {
  return ISO_PEOPLE.lift + (tick % 2);
}

// The bed (with its room) that holds `slot`, or null.
function isoBedOfSlot(layout, slot) {
  for (var i = 0; i < layout.rooms.length; i++) {
    for (var j = 0; j < layout.rooms[i].beds.length; j++) {
      if (layout.rooms[i].beds[j].slots.indexOf(slot) !== -1) return { room: layout.rooms[i], bed: layout.rooms[i].beds[j] };
    }
  }
  return null;
}

// The door of the house of `room` that is nearest to the point `from` ([x, y]): [x, y] of its middle, or null.
function isoWalkDoor(layout, room, from) {
  var house = isoHouseList(layout).filter(function (h) { return h.rooms.indexOf(room.id) !== -1; })[0];
  if (!house) return null;
  var rects = layout.rooms.filter(function (r) { return house.rooms.indexOf(r.id) !== -1; }).map(function (r) { return r.rect; });
  var best = null, bestD = Infinity;
  ((layout.map && layout.map.doors) || []).forEach(function (d) {
    if (!rects.some(function (r) { return rectsOverlap(d, r); })) return;
    var c = [d[0] + d[2] / 2, d[1] + d[3] / 2], dist = Math.hypot(c[0] - from[0], c[1] - from[1]);
    if (dist < bestD) { bestD = dist; best = c; }
  });
  return best;
}

// The corners of a walk (flat sprite corners like figurePosition): from, the door when there is one (as the sprite
// corner that puts the feet in the middle of the door), to.
function isoWalkPoints(from, door, to) {
  return door ? [from, [door[0] - 5, door[1] - 7], to] : [from, to];
}

// Where a walk is `elapsed` ms into `ms`: {pos: [x, y] whole units, bob: 0 | 1}. One hop per tick along the polyline
// of `points`, ending exactly on the last point; the bob lifts the figure on every second hop.
function isoWalkSample(points, elapsed, ms) {
  var steps = Math.max(1, Math.floor(ms / ISO_TICK_MS)), step = Math.max(0, Math.floor(elapsed / ISO_TICK_MS));
  var last = points[points.length - 1];
  if (step >= steps) return { pos: [last[0], last[1]], bob: 0 };
  var lens = [], total = 0, i;
  for (i = 1; i < points.length; i++) { lens.push(Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])); total += lens[i - 1]; }
  var at = total * step / steps, pos = [last[0], last[1]];
  for (i = 0; i < lens.length; i++) {
    if (at <= lens[i] || i === lens.length - 1) {
      var t = lens[i] > 0 ? Math.min(1, at / lens[i]) : 1;
      pos = [Math.round(points[i][0] + (points[i + 1][0] - points[i][0]) * t), Math.round(points[i][1] + (points[i + 1][1] - points[i][1]) * t)];
      break;
    }
    at -= lens[i];
  }
  return { pos: pos, bob: step % 2 };
}
