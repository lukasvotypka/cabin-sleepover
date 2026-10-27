"""The furniture drawn on the map must not cover room names, windows or doors in config/cabin.yaml.

The geometry helpers live in the page logic (the `static/js/logic-*.js` files), so this test
runs them in Node against the real layout file. Node is a project requirement (`node --test tests/js/`).
"""

import json
import re
import shutil
import subprocess
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent

CHECK = r"""
const vm = require("node:vm");
const input = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
const L = vm.createContext({});
vm.runInContext(input.logic, L);
const overlap = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
const problems = [];
const others = [...input.layout.map.windows, ...input.layout.map.doors];
for (const room of input.layout.rooms) {
  const band = L.roomLabelBand(room);
  const [rx, ry, rw, rh] = room.rect;
  for (const b of room.beds) {
    const f = L.furnitureBounds(b);
    if (overlap(f, band)) problems.push(`${b.id} overlaps the name of ${room.id}`);
    if (f[0] < rx + 4 || f[1] < ry + 4 || f[0] + f[2] > rx + rw - 4 || f[1] + f[3] > ry + rh - 4) problems.push(`${b.id} sticks out of ${room.id}`);
    others.forEach((o) => { if (overlap(f, o)) problems.push(`${b.id} overlaps a window or door`); });
  }
  others.forEach((o) => { if (overlap(band, o)) problems.push(`the name of ${room.id} overlaps a window or door`); });
}
process.stdout.write(JSON.stringify(problems));
"""


# Roofs and chimneys (T-029): the roofs sit on the top edge of the houses, the chimney stands on the roof and
# the smoke column above it (24 px high, drifting up to 5 px to the right) must stay clear of rooms and boards.
ROOF_CHECK = r"""
const vm = require("node:vm");
const input = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
const L = vm.createContext({});
vm.runInContext(input.logic, L);
const overlap = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
const { rooms, houses, map } = input.layout;
const [vw] = map.viewbox;
const TREE = [-20, 184, 34, 68];              // the decorative tree (drawTree): crown and trunk at the left edge
const problems = [];
const scene = Object.entries(map.scene);
const furniture = rooms.flatMap((r) => r.beds.map((b) => [b.id, L.furnitureBounds(b)]));
const roofs = houses.map((h) => ({ id: h.id, outline: L.houseOutline(h, rooms) }));
roofs.forEach((h) => { h.roof = L.roofRect(h.outline); });
houses.forEach((house, n) => {
  const { outline, roof } = roofs[n];
  const rows = L.roofRows(outline);
  if (roof[0] < 0 || roof[0] + roof[2] > vw || roof[1] < 0) problems.push(`roof of ${house.id} is outside the viewbox`);
  if (roof[1] + roof[3] !== outline[1]) problems.push(`roof of ${house.id} does not sit on the house`);
  if (rows.length !== 8 || rows[0].w !== outline[2] + 8 || rows[7].w !== outline[2] + 8 - 32) problems.push(`roof of ${house.id} has the wrong shape`);
  const things = [
    ...rooms.map((r) => [`room ${r.id}`, r.rect]), ...scene.map(([k, v]) => [`scene ${k}`, v]), ...furniture,
    ...map.doors.map((d, i) => [`door ${i}`, d]), ...map.windows.map((w, i) => [`window ${i}`, w]), ["tree", TREE],
    ...roofs.filter((o) => o !== roofs[n]).map((o) => [`roof of ${o.id}`, o.roof]),
  ];
  const chimney = L.chimneyRect(outline, house.chimney);
  const smoke = [chimney[0], chimney[1] - 28, chimney[2] + 5, 28];
  const top = rows[7];
  if (chimney[0] < top.x || chimney[0] + chimney[2] > top.x + top.w) problems.push(`chimney of ${house.id} is not on the roof ridge`);
  things.forEach(([name, rect]) => {
    if (overlap(roof, rect)) problems.push(`roof of ${house.id} overlaps ${name}`);
    if (overlap(chimney, rect)) problems.push(`chimney of ${house.id} overlaps ${name}`);
    if (overlap(smoke, rect)) problems.push(`smoke of ${house.id} overlaps ${name}`);
  });
});
process.stdout.write(JSON.stringify(problems));
"""


def page_logic():
    """The source of the logic-*.js files, in the order static/index.html loads them."""
    html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    files = re.findall(r'<script src="(static/js/logic-[\w-]+\.js)(?:\?[^"]*)?"></script>', html)
    assert files, "index.html must load static/js/logic-*.js"
    return "\n".join((ROOT / f).read_text(encoding="utf-8") for f in files)


def _run_node(script):
    node = shutil.which("node")
    assert node, "Node is required for the page logic tests"
    logic = page_logic()
    layout = yaml.safe_load((ROOT / "config" / "cabin.yaml").read_text(encoding="utf-8"))
    payload = json.dumps({"logic": logic, "layout": layout})
    done = subprocess.run([node, "-e", script], input=payload, capture_output=True, text=True, check=False)
    assert done.returncode == 0, f"node failed\nstdout: {done.stdout}\nstderr: {done.stderr}"
    return json.loads(done.stdout)


def test_furniture_clear_of_labels_windows_and_doors():
    assert _run_node(CHECK) == []


def test_roofs_and_chimneys_clear_of_everything():
    assert _run_node(ROOF_CHECK) == []


def test_scene_boards_stay_clear_of_rooms_and_each_other():
    layout = yaml.safe_load((ROOT / "config" / "cabin.yaml").read_text(encoding="utf-8"))
    width, height = layout["map"]["viewbox"]
    boards = {k: v for k, v in layout["map"]["scene"].items()}
    rooms = {f"room {r['id']}": r["rect"] for r in layout["rooms"]}
    names = sorted(boards)
    for i, a in enumerate(names):
        x, y, w, h = boards[a]
        assert x >= 0 and y >= 0 and x + w <= width and y + h <= height, f"{a} is outside the viewbox"
        for name, rect in rooms.items():
            assert not _overlap(boards[a], rect), f"{a} overlaps {name}"
        for b in names[i + 1:]:
            assert not _overlap(boards[a], boards[b]), f"{a} overlaps {b}"


def _overlap(a, b):
    return a[0] < b[0] + b[2] and b[0] < a[0] + a[2] and a[1] < b[1] + b[3] and b[1] < a[1] + a[3]


def test_nothing_hardcodes_the_old_viewbox_height():
    sources = [ROOT / "static" / "index.html", *sorted((ROOT / "static" / "js").glob("*.js"))]
    for source in sources:
        assert not re.search(r"\b412\b", source.read_text(encoding="utf-8")), source.name
