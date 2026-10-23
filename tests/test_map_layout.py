"""The furniture drawn on the map must not cover room names, windows or doors in config/cabin.yaml.

The geometry helpers live in the page logic (`<script id="logic">` of static/index.html), so this test
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


def test_furniture_clear_of_labels_windows_and_doors():
    node = shutil.which("node")
    assert node, "Node is required for the page logic tests"
    html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    logic = re.search(r'<script id="logic">([\s\S]*?)</script>', html).group(1)
    layout = yaml.safe_load((ROOT / "config" / "cabin.yaml").read_text(encoding="utf-8"))
    payload = json.dumps({"logic": logic, "layout": layout})
    done = subprocess.run([node, "-e", CHECK], input=payload, capture_output=True, text=True, check=False)
    assert done.returncode == 0, f"node failed\nstdout: {done.stdout}\nstderr: {done.stderr}"
    assert json.loads(done.stdout) == []
