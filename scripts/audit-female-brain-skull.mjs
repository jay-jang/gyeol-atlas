// Surface crossings between the female brain models (Allen reference + VHF
// optic chiasm) and the borrowed skull bones: before = the regional placement
// the app drew (female-scene dump); after = skull at the registration field
// placement (warp.py) and the brain fitted into that cranium (brain.py). Exact BVH triangle intersection tests.
// Usage: node scripts/audit-female-brain-skull.mjs [--write]
import fs from "node:fs";
import { BufferGeometry, BufferAttribute, Matrix4 } from "three";
import { MeshBVH } from "three-mesh-bvh";
const C = ".cache/female-transport";
const index = JSON.parse(fs.readFileSync(`${C}/female-scene/index.json`, "utf8")).parts, blob = fs.readFileSync(`${C}/female-scene/geometry.bin`);
const slice = (b, off, bytes, T) => new T(b.buffer.slice(b.byteOffset + off, b.byteOffset + off + bytes));
const out = JSON.parse(fs.readFileSync(`${C}/out/index.json`, "utf8")), bb = fs.readFileSync(`${C}/out/borrowed.bin`);
const moved = new Map(out.borrowed.map(p => [p.id, slice(bb, p.offset, p.vertexCount * 12, Float32Array)]));
const geo = (pos, idx) => { const g = new BufferGeometry(); g.setAttribute("position", new BufferAttribute(pos, 3)); g.setIndex(new BufferAttribute(idx, 1)); g.computeBoundingBox(); return g; };
const brain = index.filter(p => p.system === "brain");
// The field-fitted reference brain (scripts/female-transport/brain.py), when present.
const brainOut = fs.existsSync(`${C}/out/brain.json`) ? JSON.parse(fs.readFileSync(`${C}/out/brain.json`, "utf8")) : null;
const brainBlob = brainOut && fs.readFileSync(`${C}/out/brain.bin`);
const fitted = new Map(); if (brainOut) { let o = 0; for (const p of brainOut.parts) { fitted.set(p.id, slice(brainBlob, o, p.vertexCount * 12, Float32Array)); o += p.vertexCount * 12; } }
// Borrowed skull and face bones (BM0002-BM0021; the alar cartilages and hyoids are not skull).
const skull = index.filter(p => p.system === "borrowed" && /^(Ethmoid|Frontal bone|Left|Right|Mandible|Occipital bone|Sphenoid bone|Vomer)/.test(p.sourceName) && Number(p.name.slice(2)) <= 21);
const report = { version: 1, brainModels: brain.length, skullBones: skull.length };
for (const label of ["before", "after"]) {
  const bones = skull.map(p => { const g = geo(label === "after" ? moved.get(p.name) : slice(blob, p.posOffset, p.posBytes, Float32Array), slice(blob, p.idxOffset, p.idxBytes, Uint32Array)); g.boundsTree = new MeshBVH(g); return { p, g }; });
  const pairs = [];
  for (const n of brain) {
    const g = geo(label === "after" && fitted.has(n.name) ? fitted.get(n.name) : slice(blob, n.posOffset, n.posBytes, Float32Array), slice(blob, n.idxOffset, n.idxBytes, Uint32Array));
    for (const b of bones) if (g.boundingBox.intersectsBox(b.g.boundingBox) && b.g.boundsTree.intersectsGeometry(g, new Matrix4())) pairs.push([n.name, b.p.name]);
  }
  report[label] = { pairs: pairs.length, brainModels: new Set(pairs.map(p => p[0])).size, skullBones: [...new Set(pairs.map(p => p[1]))].map(id => skull.find(s => s.name === id).sourceName).sort() };
}
console.log(JSON.stringify(report));
if (process.argv.includes("--write")) fs.writeFileSync("docs/anatomy-alignment/female-brain-skull.json", JSON.stringify(report, null, 1) + "\n");
