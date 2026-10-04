// Approximate female acupoint anchors: each male anchor's skin point and
// outward direction carried by the registration field (warp.py writes them),
// then projected along that direction onto the HRA female skin. These are
// unreviewed approximations, shown only when the viewer asks for them.
// Writes public/models/acupoint-anchors-female.json.
// Usage: node scripts/build-female-anchors.mjs
import fs from "node:fs";
import { BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3, DoubleSide } from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
Mesh.prototype.raycast = acceleratedRaycast;
const C = ".cache/female-transport";
const index = JSON.parse(fs.readFileSync(`${C}/female-scene/index.json`, "utf8")).parts, blob = fs.readFileSync(`${C}/female-scene/geometry.bin`);
const part = index.find((p) => p.name === "HRAF0003");
const pos = new Float32Array(blob.buffer.slice(blob.byteOffset + part.posOffset, blob.byteOffset + part.posOffset + part.posBytes));
const idx = new Uint32Array(blob.buffer.slice(blob.byteOffset + part.idxOffset, blob.byteOffset + part.idxOffset + part.idxBytes));
const g = new BufferGeometry(); g.setAttribute("position", new BufferAttribute(pos, 3)); g.setIndex(new BufferAttribute(idx, 1)); g.boundsTree = new MeshBVH(g);
const mesh = new Mesh(g, new MeshBasicMaterial({ side: DoubleSide })), ray = new Raycaster();
const anchors = JSON.parse(fs.readFileSync("data/anchors.json", "utf8"));
const rays = new Float32Array(fs.readFileSync(`${C}/out/anchor-rays.bin`).buffer.slice(0));
const round = (v) => +v.toFixed(5), out = [];
for (const [i, a] of anchors.entries()) {
  const o = new Vector3(rays[i * 6], rays[i * 6 + 1], rays[i * 6 + 2]), d = new Vector3(rays[i * 6 + 3], rays[i * 6 + 4], rays[i * 6 + 5]);
  let best = null;
  for (const s of [1, -1]) {
    ray.set(o, d.clone().multiplyScalar(s)); ray.far = 0.12;
    const h = ray.intersectObject(mesh)[0];
    if (h && (!best || h.distance < best.distance)) best = h;
  }
  let surface, normal, method;
  if (best) { surface = best.point; normal = best.face.normal.clone(); method = "field-ray"; }
  else { const t = g.boundsTree.closestPointToPoint(o); surface = t.point; normal = d.clone(); method = "field-closest"; }
  // Face the normal the way the carried outward direction points.
  if (normal.dot(d) < 0) normal.negate();
  const position = surface.clone().addScaledVector(normal, a.displayOffset ?? 0.003);
  out.push({ pointId: a.pointId, occurrence: a.occurrence, key: a.key, side: a.side, mode: "female-approximation", method,
    surfacePoint: surface.toArray().map(round), position: position.toArray().map(round), projectionMm: +(surface.distanceTo(o) * 1000).toFixed(2),
    status: "approximate-unreviewed" });
}
fs.writeFileSync("public/models/acupoint-anchors-female.json", JSON.stringify(out) + "\n");
const mm = out.map((a) => a.projectionMm).sort((x, y) => x - y);
console.log("female anchors", out.length, "ray", out.filter((a) => a.method === "field-ray").length, "projection median", mm[mm.length >> 1], "mm p90", mm[Math.floor(mm.length * .9)]);
