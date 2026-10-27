"use strict";

// App part: turning the map to one of the four view angles (T-143). The angle is kept in `app.viewAngle` and in the browser
// storage (`cabin-view-angle`); every angle-dependent part (projection, walls, roofs, sun, hit regions, boards) is rebuilt
// by ensureScene() because the angle is part of its layout key. T-144 adds the buttons and the swing on top of this.
// Plain script: top-level names are shared with the other logic-*.js and app-*.js files (see index.html for the order).

// Turns the map to `angle` (45, 135, 225 or 315; anything else is 45) and keeps the view: a map at rest lands on the
// new rest view, a zoomed one keeps the plan point under the middle of the screen and its zoom (isoTurnView). Open houses stay open.
function setViewAngle(angle) {
  angle = isoAngle(angle);
  if (angle === app.viewAngle) return;
  storage.set(KEYS.angle, String(angle));
  var from = app.iso, oldView = app.view, oldRest = app.bounds && app.sceneSize ? appRestView(app.bounds) : null;
  app.viewAngle = angle;
  if (!from || !oldView) return;      // nothing drawn yet: the first ensureScene uses the new angle
  stopHouseTween();
  housesZooming = true;      // the zoom rule must not look at the view while it is rebuilt
  render();
  if (app.iso !== from) {
    setView(isoTurnView(from, app.iso, oldView, oldRest, appRestView(app.bounds), app.bounds));
    housesLastW = app.view.w;
  }
  housesZooming = false;
}

// The next angle after `steps` quarter turns (+1 = the map turns clockwise on screen).
function turnViewAngle(steps) {
  setViewAngle(isoTurnAngle(app.viewAngle, steps));
}
