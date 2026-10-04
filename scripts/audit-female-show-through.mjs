// Female show-through at 0%: rays from outside the body (Fibonacci directions,
// parallel grids) against everything the female overview draws at 0% — the
// HRA meshes, the borrowed bones at their field placement and the transported
// male structures. A first hit that is not the skin (or the skin's own breast
// structures) is a structure showing through. Before/after is the borrowed
// placement and transport (BASELINE=1 uses the drawn pre-transport scene).
// Inputs: .cache/female-transport/female-scene (scripts/dump-drawn-geometry.mjs)
// and .cache/female-transport/out (scripts/female-transport/warp.py).
// Usage: node scripts/audit-female-show-through.mjs [--write]
import fs from "node:fs";
import { BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3, DoubleSide } from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
Mesh.prototype.raycast = acceleratedRaycast;
const CACHE = ".cache/female-transport", baseline = process.env.BASELINE === "1";
const index = JSON.parse(fs.readFileSync(`${CACHE}/female-scene/index.json`, "utf8")).parts;
const blob = fs.readFileSync(`${CACHE}/female-scene/geometry.bin`);
const slice = (b, off, bytes, T) => new T(b.buffer.slice(b.byteOffset + off, b.byteOffset + off + bytes));
const out = JSON.parse(fs.readFileSync(`${CACHE}/out/index.json`, "utf8"));
const borrowedBlob = fs.readFileSync(`${CACHE}/out/borrowed.bin`);
const borrowed = new Map(out.borrowed.map(p => [p.id, slice(borrowedBlob, p.offset, p.vertexCount * 12, Float32Array)]));
// The reference brain fitted into the field's cranium (brain.py).
const brainOut = JSON.parse(fs.readFileSync(`${CACHE}/out/brain.json`, "utf8")), brainBlob = fs.readFileSync(`${CACHE}/out/brain.bin`);
let brainOffset = 0; for (const p of brainOut.parts) { borrowed.set(p.id, slice(brainBlob, brainOffset, p.vertexCount * 12, Float32Array)); brainOffset += p.vertexCount * 12; }
const catalogue = new Map(JSON.parse(fs.readFileSync("data/female-atlas-structures.json", "utf8")).map(s => [s.id, s]));
const transported = JSON.parse(fs.readFileSync("data/female-transport-structures.json", "utf8"));
const maleNames = new Map([...JSON.parse(fs.readFileSync("data/full-system-structures.json", "utf8")), ...JSON.parse(fs.readFileSync("data/connective-structures.json", "utf8")),
  ...JSON.parse(fs.readFileSync("data/sex-lymph-structures.json", "utf8")), ...JSON.parse(fs.readFileSync("scripts/model-inputs.json", "utf8")).assets].map(s => [s.id, s.name]));
const names = new Map(transported.map(s => [`FT_${s.transport}`, maleNames.get(s.transport)]));
// Skin-toned while the skin is drawn (src/anatomy-rendering.ts SURFACE_TONES, catalogue surfaceTone).
const toned = new Set([...transported.filter(s => s.surfaceTone).map(s => `FT_${s.transport}`), ...out.borrowed.filter(p => p.surfaceTone).map(p => p.id), "HRAF0928", "HRAF0955", "HRAF0908", "BM0000", "BM0001"]);
const parts = [];
for (const p of index) {
  if (!/^(HRAF|BM|VHF)/.test(p.name)) continue;
  // Hidden by default at 0%: pregnancy references and the donor leg muscles (after transport).
  if (p.system === "pregnancy" || (!baseline && p.system === "donor-muscle")) continue;
  if (baseline && p.system === "donor-muscle" && /^Rectus femoris/.test(p.sourceName)) continue;
  const pos = !baseline && borrowed.has(p.name) ? borrowed.get(p.name) : slice(blob, p.posOffset, p.posBytes, Float32Array);
  parts.push({ id: p.name, name: p.sourceName, skin: p.layer === "skin", pos, idx: slice(blob, p.idxOffset, p.idxBytes, Uint32Array) });
}
if (!baseline) for (const system of ["nerve", "vessel", "muscle", "ligament", "tendon", "lymph", "bone", "organ"]) {
  const b = fs.readFileSync(`${CACHE}/out/${system}.bin`);
  for (const e of out[system]) parts.push({ id: `FT_${e.id}`, name: names.get(`FT_${e.id}`), skin: false, pos: slice(b, e.posOffset, e.vertexCount * 12, Float32Array), idx: slice(b, e.idxOffset, e.indexCount * 4, Uint32Array) });
}
let vCount = 0, tCount = 0; for (const p of parts) { vCount += p.pos.length / 3; tCount += p.idx.length / 3; }
const pos = new Float32Array(vCount * 3), idx = new Uint32Array(tCount * 3), owner = new Uint32Array(tCount);
let vo = 0, to = 0;
parts.forEach((p, k) => {
  pos.set(p.pos, vo * 3);
  for (let i = 0; i < p.idx.length; i++) idx[to * 3 + i] = p.idx[i] + vo;
  owner.fill(k, to, to + p.idx.length / 3); vo += p.pos.length / 3; to += p.idx.length / 3;
});
const g = new BufferGeometry(); g.setAttribute("position", new BufferAttribute(pos, 3)); g.setIndex(new BufferAttribute(idx, 1));
g.boundsTree = new MeshBVH(g, { indirect: true }); g.computeBoundingSphere();
const mesh = new Mesh(g, new MeshBasicMaterial({ side: DoubleSide }));
const ray = new Raycaster(); ray.firstHitOnly = true;
const center = g.boundingSphere.center, radius = g.boundingSphere.radius + 0.05;
const N = 120, step = 0.005, d = new Vector3(), u = new Vector3(), v = new Vector3(), o = new Vector3();
const hits = new Map(); let rays = 0, total = 0, tonedRays = 0;
for (let k = 0; k < N; k++) {
  const y = 1 - (k + .5) / N * 2, r = Math.sqrt(1 - y * y), phi = k * Math.PI * (3 - Math.sqrt(5));
  d.set(Math.cos(phi) * r, y, Math.sin(phi) * r).normalize();
  u.set(Math.abs(d.y) < .9 ? 0 : 1, Math.abs(d.y) < .9 ? 1 : 0, 0).cross(d).normalize(); v.copy(d).cross(u);
  for (let a = -radius; a <= radius; a += step) for (let b = -radius; b <= radius; b += step) {
    o.copy(center).addScaledVector(u, a).addScaledVector(v, b).addScaledVector(d, -radius);
    ray.set(o, d); ray.far = 2 * radius;
    const h = ray.intersectObject(mesh)[0]; rays++;
    if (!h) continue;
    const p = parts[owner[h.faceIndex]];
    if (p.skin) continue;
    total++; if (!baseline && toned.has(p.id)) tonedRays++;
    const e = hits.get(p.id) || { id: p.id, name: p.name, rays: 0, at: h.point.toArray().map(x => +x.toFixed(3)) };
    e.rays++; hits.set(p.id, e);
  }
}
const rows = [...hits.values()].sort((a, b) => b.rays - a.rays);
const kind = (id) => id.startsWith("FT_") ? "transported" : id.startsWith("BM") ? "borrowed" : id.startsWith("VHF") ? "donor muscle" : "HRA female";
const byKind = {}; for (const r of rows) byKind[kind(r.id)] = (byKind[kind(r.id)] || 0) + r.rays;
const report = { version: 1, scene: baseline ? "before (drawn HRA + borrowed + donor muscles)" : "after (field placement + transported structures)", directions: N, spacingMm: step * 1000, rays, showThroughRays: total,
  skinTonedRays: tonedRays, otherColourRays: total - tonedRays, byKind, structures: rows.slice(0, 60).map(r => ({ ...r, skinToned: !baseline && toned.has(r.id) })) };
console.log(JSON.stringify({ ...report, structures: rows.slice(0, 25).map(r => `${r.rays} ${r.id} ${r.name} @${r.at}`) }, null, 1));
if (process.argv.includes("--write")) fs.writeFileSync(`docs/anatomy-alignment/female-show-through${baseline ? "-before" : ""}.json`, JSON.stringify(report, null, 1) + "\n");
