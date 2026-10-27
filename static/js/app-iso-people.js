"use strict";

// App part: the people of the 3D world (T-138): small voxel dolls in the party colour, with the shirt letter, sitting
// in bed by day and lying under a quilt at night. The svg keeps the tap areas, labels, free „+“ marks and „z-z-z“.
// drawBeds collects one spec per figure (isoPeopleBegin / isoPeopleAdd / isoPeopleEnd) and this file builds them again
// on every redraw (a dozen figures: cheap), keeping what must go on between redraws (pop in, shake, walkers).
// Everything that moves steps on the shared 30 fps update (isoPeopleTick, called by isoLoop); with reduced motion nothing animates.
// Without the 3D world isoActive() is false and the svg sprites are drawn as before.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

var isoPeopleSpecs = null;      // the specs of the redraw in progress, null outside one (and without 3D)

function isoPeopleBegin() {
  isoPeopleSpecs = isoActive() ? [] : null;
}

// spec: {key, kind, color, ch, x, z (the feet), h, pose "bed" | "stand", pending, mine, scale, fade {dir, start}, hop {index, count}}
function isoPeopleAdd(spec) {
  if (isoPeopleSpecs) isoPeopleSpecs.push(spec);
}

// The spec of the figure in slot number `index` of `bed` (a shared start for beds, ghosts and the meadow).
function isoBedSpec(bed, index, who, extra) {
  var pos = figurePosition(bed, index), spec = {
    key: "", kind: who.kind, color: who.party ? who.party.color : COLORS.mat, ch: who.party ? shirtChar(who.party.name) : null,
    x: pos[0] + 5, z: pos[1] + 7, h: isoSlotHeight(bed, index), pose: "bed",
    scale: isoSitScale(bed, index, who.kind, app.iso.figScale), pending: false, mine: false, fade: null, hop: null
  };
  Object.keys(extra).forEach(function (k) { spec[k] = extra[k]; });
  return spec;
}

// Ends a redraw: `ctx` says which bed rooms were drawn (figures of a room that just opened do not pop in).
function isoPeopleEnd(ctx) {
  var specs = isoPeopleSpecs;
  isoPeopleSpecs = null;
  if (!specs || !iso3 || iso3.lost) return;
  isoPeopleBuild(iso3, specs, ctx);
}

// --- shared things of one world: geometry, materials, letter textures ---

function isoPeopleKit(me) {
  var P = me.people;
  if (P) return P;
  P = me.people = { group: new THREE.Group(), entries: [], dying: [], walkers: [], keys: {}, ctx: null, mats: {}, tex: {}, still: false };
  P.box = new THREE.BoxGeometry(1, 1, 1);
  P.plane = new THREE.PlaneGeometry(1, 1);
  P.blob = new THREE.PlaneGeometry(5, 4).rotateX(-Math.PI / 2);
  P.blobMat = new THREE.MeshBasicMaterial({ color: "#1A1020", transparent: true, opacity: 0.3, depthWrite: false });
  P.ringMat = new THREE.MeshBasicMaterial({ color: ISO_PEOPLE.ring, transparent: true });
  P.yaw = Math.atan2(me.sc.basis.s, me.sc.basis.c);      // the front of every doll looks at the camera
  me.scene.add(P.group);
  return P;
}

function isoPeopleMat(P, hex, opacity) {
  var o = isoOpacityStep(opacity), key = hex + "|" + o;
  return P.mats[key] || (P.mats[key] = new THREE.MeshLambertMaterial({ color: hex, transparent: o < 1, opacity: o }));
}

// An 8 x 8 canvas texture of the letter `ch` in `ink`, transparent around it (the 3 x 5 pixel font, centred).
function isoLetterMat(P, ch, ink, opacity) {
  var o = isoOpacityStep(opacity), key = "L|" + ch + "|" + ink + "|" + o;
  if (P.mats[key]) return P.mats[key];
  var tex = P.tex[ch + ink];
  if (!tex) {
    var cv = document.createElement("canvas"), ctx = cv.getContext("2d");
    cv.width = cv.height = 8;
    ctx.fillStyle = ink;
    var rows = Object.prototype.hasOwnProperty.call(PIXEL_FONT, ch) ? PIXEL_FONT[ch] : PIXEL_FONT["·"];
    rows.forEach(function (row, r) {
      for (var c = 0; c < row.length; c++) if (row.charAt(c) === "#") ctx.fillRect(2 + c, 1 + r, 1, 1);
    });
    tex = P.tex[ch + ink] = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
  }
  return (P.mats[key] = new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity: o, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
}

// --- one doll ---

// The group of one pose: its boxes and letter. `entry.mats` lists what must change with the opacity.
function isoPoseGroup(P, entry, spec, pose) {
  var lay = isoFigureLayout(spec.kind, pose), col = isoFigureColors(spec.color), g = new THREE.Group();
  var hex = { legs: col.legs, body: col.body, quilt: col.quilt, skin: ISO_PEOPLE.skin, hair: ISO_PEOPLE.hair, eye: ISO_PEOPLE.eye };
  lay.parts.forEach(function (p) {
    var m = new THREE.Mesh(P.box, isoPeopleMat(P, hex[p.c], 1));
    m.scale.set(p.w, p.h, p.d);
    m.position.set(p.x, p.y + p.h / 2, p.z);
    g.add(m);
    entry.mats.push({ mesh: m, hex: hex[p.c] });
  });
  if (spec.ch) {
    var L = lay.letter, m2 = new THREE.Mesh(P.plane, isoLetterMat(P, spec.ch, shirtInk(pose === "lie" ? col.quilt : col.body), 1));
    m2.scale.set(L.size, L.size, 1);
    entry.mats.push({ mesh: m2, letter: true, ch: spec.ch, ink: shirtInk(pose === "lie" ? col.quilt : col.body) });
    if (L.flat) {      // on the quilt, turned so that its top points away from the camera
      var pivot = new THREE.Group();
      pivot.position.set(L.x, L.y, L.z);
      pivot.rotation.y = P.yaw;
      m2.rotation.x = -Math.PI / 2;
      pivot.add(m2);
      g.add(pivot);
    } else {
      m2.position.set(L.x, L.y, L.z);
      g.add(m2);
    }
  }
  if (pose !== "lie") g.rotation.y = P.yaw;
  return g;
}

function isoPeopleMake(me, spec) {
  var P = isoPeopleKit(me), root = new THREE.Group();
  var entry = { spec: spec, root: root, mats: [], sit: null, lie: null, stand: null, opacity: -1, popAt: -1, shakeAt: -1, ring: null };
  if (spec.pose === "stand") {
    entry.stand = isoPoseGroup(P, entry, spec, "stand");
    root.add(entry.stand);
    var blob = new THREE.Mesh(P.blob, P.blobMat);
    blob.position.y = 0.12;
    root.add(blob);
  } else {
    entry.sit = isoPoseGroup(P, entry, spec, "sit");
    entry.lie = isoPoseGroup(P, entry, spec, "lie");
    root.add(entry.sit);
    root.add(entry.lie);
  }
  if (spec.mine) {      // a yellow frame on the bed top around the figure (blinks, isoPeopleTick)
    entry.ringMat = P.ringMat.clone();      // own material, so the frame follows the figure's opacity
    var ring = new THREE.Group(), w = 9, d = 12, t = 0.75;
    [[0, -d / 2, w, t], [0, d / 2, w, t], [-w / 2, 0, t, d], [w / 2, 0, t, d]].forEach(function (r) {
      var m = new THREE.Mesh(P.box, entry.ringMat);
      m.scale.set(r[2], 0.3, r[3]);
      m.position.set(r[0], 0.25, r[1] - 0.5);
      ring.add(m);
    });
    entry.ring = ring;
    root.add(ring);
  }
  root.scale.setScalar(me.sc.figScale * (spec.scale || 1));
  isoPeopleApply(me, entry);
  return entry;
}

// The opacity (pending, fading), the pose and the place of an entry, for the current clock.
function isoPeopleApply(me, entry) {
  var s = entry.spec, P = me.people, o = s.pending ? 0.5 : 1, clock = me.clock;
  if (s.fade) o *= isoFadeAlpha(s.fade.dir, performance.now() - s.fade.start);
  o = isoOpacityStep(o);
  if (entry.opacity !== o) {
    entry.opacity = o;
    entry.mats.forEach(function (m) { m.mesh.material = m.letter ? isoLetterMat(P, m.ch, m.ink, o) : isoPeopleMat(P, m.hex, o); });
    entry.root.visible = o > 0;
    if (entry.ringMat) entry.ringMat.opacity = P.ringMat.opacity * o;
  }
  if (entry.sit) {
    var sleep = !!(me.light && me.light.sleep);
    entry.sit.visible = !sleep;
    entry.lie.visible = sleep;
  }
  var hop = s.hop ? isoWaiterHop(clock, s.hop.index, s.hop.count) : 0;
  var shake = entry.shakeAt >= 0 ? isoShakeOffset(clock - entry.shakeAt) : 0;
  entry.root.position.set(s.x + shake, s.h + hop, s.z);
  var pop = isoPopScale(entry.popAt >= 0 ? clock - entry.popAt : null) * me.sc.figScale * (s.scale || 1);
  entry.root.scale.setScalar(pop);
}

// Builds the figures of a redraw. Unchanged figures are built again (cheap); a new key pops in, and a pending
// figure that vanishes (the server said no) shakes for 250 ms and goes.
function isoPeopleBuild(me, specs, ctx) {
  var P = isoPeopleKit(me), still = prefersReducedMotion(), same = P.ctx === ctx, keys = {};
  var kept = {};
  specs.forEach(function (s) { kept[s.key] = true; });
  P.entries.forEach(function (e) {
    P.group.remove(e.root);
    if (same && !still && e.spec.pending && !e.spec.fade && !kept[e.spec.key]) { e.shakeAt = me.clock; P.dying.push(e); P.group.add(e.root); }
  });
  P.entries = specs.map(function (s) {
    var e = isoPeopleMake(me, s);
    keys[s.key] = true;
    if (same && !still && !P.keys[s.key] && !s.fade) e.popAt = me.clock;
    P.group.add(e.root);
    isoPeopleApply(me, e);
    return e;
  });
  P.keys = keys;
  P.ctx = ctx;
  isoDirty();
}

// Day or night changed (isoLight): sit or lie.
function isoPeoplePose(me) {
  var P = me.people;
  if (!P) return;
  P.entries.forEach(function (e) { isoPeopleApply(me, e); });
}

// One update: pops, shakes, the 06:00 fade, hops and the blinking frames.
function isoPeopleTick(me) {
  var P = me.people;
  if (!P) return;
  var blink = Math.floor(me.clock / (4 * ISO_STEP_MS)) % 2 === 0;      // half a second on, half a second dim
  P.ringMat.opacity = blink ? 1 : 0.35;
  P.entries.forEach(function (e) {
    if (e.ringMat) e.ringMat.opacity = P.ringMat.opacity * Math.max(e.opacity, 0);
    if (e.popAt >= 0 && me.clock - e.popAt >= ISO_PEOPLE.popMs) e.popAt = -1;
    if (e.popAt >= 0 || e.spec.fade || e.spec.hop) isoPeopleApply(me, e);
  });
  P.dying = P.dying.filter(function (e) {
    if (me.clock - e.shakeAt >= ISO_PEOPLE.shakeMs) { P.group.remove(e.root); return false; }
    isoPeopleApply(me, e);
    return true;
  });
}

// --- walkers: the figures on their way from the meadow to a bed (app-actions.js) ---

function isoWalkerAdd(w, ch) {
  var me = iso3;
  if (!me || me.lost) return null;
  var spec = { key: "walk", kind: w.kind, color: w.color, ch: ch, x: w.from[0] + 5, z: w.from[1] + 7, h: 0, pose: "stand", scale: 1, pending: false };
  var entry = isoPeopleMake(me, spec);
  entry.me = me;
  isoPeopleKit(me).group.add(entry.root);
  isoDirty();
  return entry;
}

// Puts the walker at the sprite corner `pos` ([x, y]) and height `h`.
function isoWalkerSet(entry, pos, h) {
  if (!entry || iso3 !== entry.me) return;
  entry.root.position.set(pos[0] + 5, h, pos[1] + 7);
  isoDirty();
}

function isoWalkerRemove(entry) {
  if (!entry || iso3 !== entry.me) return;
  iso3.people.group.remove(entry.root);
  isoDirty();
}
