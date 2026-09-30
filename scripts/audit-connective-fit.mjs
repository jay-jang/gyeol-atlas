// How closely do the registered Z-Anatomy ligaments and tendons meet the base
// meshes they attach to? Only the uniform male registration is applied; this
// measures that placement and does not register or move any structure.
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { PropertyBinding } from "three";

const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const registration = read("data/catalog/male-registration.json");
const catalog = read("data/connective-structures.json");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });
function points(doc, keep, register) {
  const out = new Map();
  for (const node of doc.getRoot().listNodes()) {
    if (!node.getMesh() || !keep(node.getName())) continue;
    const m = node.getWorldMatrix(), list = [], v = [0, 0, 0];
    for (const primitive of node.getMesh().listPrimitives()) {
      const position = primitive.getAttribute("POSITION");
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, v);
        let x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
        if (register) { x = x * registration.scale + registration.translation[0]; y = y * registration.scale + registration.translation[1]; z = z * registration.scale + registration.translation[2]; }
        list.push(x, y, z);
      }
    }
    out.set(node.getName(), Float64Array.from(list));
  }
  return out;
}
const cell = 0.004;
function grid(sets) {
  const g = new Map();
  for (const pts of sets) for (let i = 0; i < pts.length; i += 3) {
    const key = `${Math.floor(pts[i] / cell)},${Math.floor(pts[i + 1] / cell)},${Math.floor(pts[i + 2] / cell)}`;
    let bucket = g.get(key);
    if (!bucket) g.set(key, (bucket = []));
    bucket.push(pts[i], pts[i + 1], pts[i + 2]);
  }
  return g;
}
// Nearest base vertex within 48mm (vertex spacing bounds the error from above).
function nearest(g, x, y, z) {
  const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
  let best = Infinity;
  for (let r = 0; r <= 12; r++) {
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
      if (Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) !== r) continue;
      const bucket = g.get(`${cx + i},${cy + j},${cz + k}`);
      if (bucket) for (let q = 0; q < bucket.length; q += 3) best = Math.min(best, (bucket[q] - x) ** 2 + (bucket[q + 1] - y) ** 2 + (bucket[q + 2] - z) ** 2);
    }
    if (best <= (r * cell) ** 2) break;
  }
  return Math.sqrt(best);
}
const [boneDoc, organDoc, muscleDoc, ligamentDoc, tendonDoc] = await Promise.all(["bone", "organ", "muscle", "ligament-full", "tendon-full"].map((f) => io.read(`public/models/${f}.glb`)));
const targets = {
  "ligament-full.glb": grid([...points(boneDoc, () => true, false).values(), ...points(organDoc, () => true, false).values()]),
  "tendon-full.glb": grid([...points(boneDoc, () => true, false).values(), ...points(muscleDoc, () => true, false).values()]),
};
const byNode = new Map(catalog.map((e) => [PropertyBinding.sanitizeNodeName(e.node), e]));
const rows = [];
for (const [doc, model] of [[ligamentDoc, "ligament-full.glb"], [tendonDoc, "tendon-full.glb"]]) {
  const keep = new Set(catalog.filter((e) => e.model === model).map((e) => e.node));
  for (const [name, pts] of points(doc, (n) => keep.has(n), true)) {
    const entry = catalog.find((e) => e.node === name && e.model === model) || byNode.get(name);
    let closest = Infinity;
    const step = Math.max(3, Math.floor(pts.length / 3 / 600) * 3);
    for (let i = 0; i < pts.length; i += step) closest = Math.min(closest, nearest(targets[model], pts[i], pts[i + 1], pts[i + 2]));
    rows.push({ id: entry.id, name: entry.name, kind: entry.kind, model, closestMm: +(closest * 1000).toFixed(2) });
  }
}
if (rows.length !== catalog.length) throw Error(`measured ${rows.length} of ${catalog.length}`);
const summary = (list) => {
  const d = list.map((r) => r.closestMm).sort((a, b) => a - b);
  const q = (p) => d[Math.min(d.length - 1, Math.floor(d.length * p))];
  return { structures: d.length, medianMm: q(0.5), p90Mm: q(0.9), maxMm: d[d.length - 1], over5Mm: d.filter((v) => v > 5).length };
};
const result = {
  date: new Date().toISOString(),
  method: "Closest approach from sampled vertices of each registered supplement mesh to the nearest vertex of the rendered base meshes it attaches to (ligaments: bone and organ, including laryngeal cartilages; tendon-model items: bone and muscle). Uniform male registration only; nothing is moved.",
  ligament: summary(rows.filter((r) => r.model === "ligament-full.glb")),
  tendon: summary(rows.filter((r) => r.model === "tendon-full.glb")),
  worst: [...rows].sort((a, b) => b.closestMm - a.closestMm).slice(0, 20),
  rows,
};
fs.writeFileSync("docs/anatomy-alignment/connective-fit.json", JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ ligament: result.ligament, tendon: result.tendon, worst: result.worst.slice(0, 8).map((r) => `${r.name} ${r.closestMm}mm`) }, null, 1));
