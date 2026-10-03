// Refit the uniform male registration (scale + translation, the form the app
// applies to every Z-Anatomy supplement) on the skeleton the two sources share.
// Z-Anatomy's male bones are BodyParts3D bone geometry: after a per-bone rigid
// fit they coincide with the base bones to ~0.05 mm (audit-male-hand-bones).
// The previous fit used four neural centres in the head, which leaves scale
// weakly constrained, so limbs drift up to ~1 cm. Here every Z-Anatomy bone
// vertex sample is matched to the nearest base-bone surface point (trimmed
// ICP) and the least-squares scale + translation is solved in closed form.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import { MeshBVH } from "three-mesh-bvh";
import { ensureSkeleton, meshes, SKELETON_SHA256 } from "./audit-male-hand-bones.mjs";

const skeleton = ".cache/anatria-3d/skeletal_male.glb";
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
await ensureSkeleton();
const stored = read("data/catalog/male-registration.json");
// Always start from the earlier neural-centre fit so a rerun reproduces itself.
const current = stored.previous ?? stored;
const raw = await meshes(skeleton, false), base = await meshes("public/models/bone.glb", false);
const manifest = new Map(read("public/models/manifest.json").assets.map((a) => [a.id, a]));

// One BVH over every base bone.
const merged = [], owners = [];
for (const [id, g] of base) {
  const p = g.getAttribute("position"), idx = g.getIndex();
  for (let i = 0; i < idx.count; i++) { const v = idx.getX(i); merged.push(p.getX(v), p.getY(v), p.getZ(v)); }
  owners.push([id, idx.count / 3]);
}
const geometry = new BufferGeometry();
geometry.setAttribute("position", new BufferAttribute(new Float32Array(merged), 3));
const bvh = new MeshBVH(geometry);
const triangleOwner = []; for (const [id, n] of owners) for (let i = 0; i < n; i++) triangleOwner.push(id);

// Deterministic vertex samples per Z-Anatomy bone (up to 400 each).
const samples = [];
for (const [name, g] of raw) {
  const p = g.getAttribute("position"), every = Math.max(1, Math.floor(p.count / 400));
  for (let i = 0; i < p.count; i += every) samples.push({ bone: name, point: new Vector3().fromBufferAttribute(p, i) });
}
const apply = (r, p) => p.clone().multiplyScalar(r.scale).add(new Vector3(...r.translation));
function residuals(r) {
  return samples.map((s) => {
    const q = bvh.closestPointToPoint(apply(r, s.point));
    return { ...s, target: q.point.clone(), distance: q.distance, baseId: triangleOwner[q.faceIndex] };
  });
}
function solve(pairs) {
  const n = pairs.length, pm = new Vector3(), qm = new Vector3();
  for (const { point, target } of pairs) { pm.add(point); qm.add(target); }
  pm.multiplyScalar(1 / n); qm.multiplyScalar(1 / n);
  let num = 0, den = 0;
  for (const { point, target } of pairs) { const a = point.clone().sub(pm), b = target.clone().sub(qm); num += a.dot(b); den += a.lengthSq(); }
  const scale = num / den;
  return { scale, translation: qm.clone().sub(pm.multiplyScalar(scale)).toArray() };
}
const median = (values) => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
let fit = { scale: current.scale, translation: current.translation };
for (let iteration = 0; iteration < 60; iteration++) {
  const rows = residuals(fit), cut = Math.max(0.002, 3 * median(rows.map((r) => r.distance)));
  const next = solve(rows.filter((r) => r.distance <= cut));
  const moved = Math.abs(next.scale - fit.scale) * 2 + new Vector3(...next.translation).distanceTo(new Vector3(...fit.translation));
  fit = next;
  if (moved < 1e-9) break;
}
// Per-bone residuals before and after, grouped by body region.
function perBone(r) {
  const rows = residuals(r), byBone = new Map();
  for (const row of rows) { const list = byBone.get(row.bone) || []; list.push(row.distance * 1000); byBone.set(row.bone, list); }
  return byBone;
}
const before = perBone(current), after = perBone(fit);
const handFoot = (name) => /of hand|carp|metacarpal|scaphoid|lunate|triquetrum|pisiform|trapez|capitate|hamate/i.test(name) ? "hand"
  : /of foot|tars|metatarsal|calcaneus|talus|navicular|cuboid|cuneiform/i.test(name) ? "foot" : null;
const groups = {};
for (const [bone, list] of after) {
  const g = raw.get(bone); g.computeBoundingBox();
  const y = apply(fit, g.boundingBox.getCenter(new Vector3())).y;
  const region = handFoot(bone) ?? (y > 1.45 ? "head" : y > 0.9 ? "trunk and arm" : "leg");
  (groups[region] ||= { before: [], after: [] });
  groups[region].before.push(median(before.get(bone))); groups[region].after.push(median(list));
}
const summary = Object.fromEntries(Object.entries(groups).map(([region, v]) => [region, {
  bones: v.after.length, medianOfBoneMediansBeforeMm: +median(v.before).toFixed(2), medianOfBoneMediansAfterMm: +median(v.after).toFixed(2),
  worstBoneMedianBeforeMm: +Math.max(...v.before).toFixed(2), worstBoneMedianAfterMm: +Math.max(...v.after).toFixed(2),
}]));
const result = { previous: { scale: current.scale, translation: current.translation }, fit, samples: samples.length, bones: raw.size, skeletonSha256: SKELETON_SHA256, summary,
  files: ["public/models/bone.glb", "scripts/fit-male-skeleton-registration.mjs", "scripts/audit-male-hand-bones.mjs"].map((path) => ({ path, sha256: createHash("sha256").update(fs.readFileSync(path)).digest("hex") })) };
console.log(JSON.stringify(result, null, 2));
if (process.argv.includes("--write")) {
  const { heldOutResiduals } = await import("./audit-male-registration.mjs");
  const previous = stored.previous ?? { method: stored.method, scale: stored.scale, translation: stored.translation,
    replaced: "2026-10-03", reason: "Four neural centres in the head left the scale weakly constrained; hands sat ~8 mm and feet ~14 mm from their own bones." };
  const registration = {
    method: "Uniform scale and translation fitted by trimmed ICP of every Z-Anatomy male bone onto the BodyParts3D base bones (the same source bone geometry); neural centres and vascular pairs are held out",
    scale: fit.scale, translation: fit.translation,
    skeleton: { source: "Anatria-3D 4211d717b0b624604a8bda174ffcae31a76f4581 public/anatomy/skeletal_male.glb", sha256: SKELETON_SHA256, bones: raw.size, samples: samples.length,
      trim: "pairs farther than 3x the median distance (at least 2 mm) are excluded each iteration", medianOfBoneMediansMm: summary },
    previous, ...heldOutResiduals(fit.scale, fit.translation),
  };
  fs.writeFileSync("data/catalog/male-registration.json", JSON.stringify(registration, null, 2) + "\n");
}
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ ...result, perBone: [...after].map(([bone, list]) => ({ bone, beforeMedianMm: +median(before.get(bone)).toFixed(3), afterMedianMm: +median(list).toFixed(3) })) }, null, 2) + "\n");
