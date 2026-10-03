// How far are the Z-Anatomy male hand bones (with the uniform male
// registration the app applies to Z-Anatomy supplements) from the
// BodyParts3D hand bones of the base model? Each named pair gets its
// centroid offset, one-way surface distance and a rigid ICP fit.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco from "draco3dgltf";
import { BufferAttribute, BufferGeometry, Matrix4, Vector3 } from "three";
import { MeshBVH } from "three-mesh-bvh";
import { fitRigid } from "./lib/rigid-fit.mjs";
import { handBonePairs } from "./lib/male-hand-bones.mjs";

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const stored = read("data/catalog/male-registration.json");
const skeleton = ".cache/anatria-3d/skeletal_male.glb";
export const SKELETON_SHA256 = "b49d71788bfa0b4a3188e2954d59728a699b08ec280e70df1c2a95e13d4b81f8";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });

export async function meshes(file, registered, registration = stored) {
  const out = new Map(), doc = await io.read(file);
  for (const node of doc.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    const matrix = new Matrix4().fromArray(node.getWorldMatrix()), list = [];
    for (const primitive of node.getMesh().listPrimitives()) {
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(new Float32Array(primitive.getAttribute("POSITION").getArray()), 3));
      if (primitive.getIndices()) g.setIndex(new BufferAttribute(new Uint32Array(primitive.getIndices().getArray()), 1));
      g.applyMatrix4(matrix);
      if (registered) { g.scale(registration.scale, registration.scale, registration.scale); g.translate(...registration.translation); }
      list.push(g);
    }
    out.set(node.getName(), list.length === 1 ? list[0] : merge(list));
  }
  return out;
}
function merge(list) {
  const positions = [], index = []; let offset = 0;
  for (const g of list) {
    positions.push(...g.getAttribute("position").array);
    const idx = g.getIndex();
    if (idx) for (let i = 0; i < idx.count; i++) index.push(idx.getX(i) + offset);
    offset += g.getAttribute("position").count;
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  g.setIndex(index);
  return g;
}
const points = (g) => { const p = g.getAttribute("position"), out = []; for (let i = 0; i < p.count; i++) out.push(new Vector3().fromBufferAttribute(p, i)); return out; };
const centroid = (pts) => pts.reduce((s, p) => s.add(p), new Vector3()).multiplyScalar(1 / pts.length);
const percentile = (values, q) => { const s = [...values].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

// The pinned Anatria-3D export (same commit as the vessel, nerve, ligament and
// tendon supplements), cached outside the repository.
export async function ensureSkeleton() {
  if (!fs.existsSync(skeleton)) {
    const response = await fetch("https://raw.githubusercontent.com/Nurkan1/Anatria-3D/4211d717b0b624604a8bda174ffcae31a76f4581/public/anatomy/skeletal_male.glb");
    if (!response.ok) throw new Error(`skeletal_male.glb: ${response.status}`);
    fs.mkdirSync(".cache/anatria-3d", { recursive: true });
    fs.writeFileSync(skeleton, Buffer.from(await response.arrayBuffer()));
  }
  if (createHash("sha256").update(fs.readFileSync(skeleton)).digest("hex") !== SKELETON_SHA256) throw new Error("Z-Anatomy skeleton hash changed");
}
export async function compareHandBones(registration = stored) {
  await ensureSkeleton();
  const z = await meshes(skeleton, true, registration), bp = new Map();
  const manifest = read("public/models/manifest.json").assets;
  for (const [id, g] of await meshes("public/models/bone.glb", false)) {
    const entry = manifest.find((a) => a.id === id);
    if (entry) bp.set(entry.name, g);
  }
  const rows = [];
  for (const side of ["right", "left"]) for (const pair of handBonePairs(side)) {
    const from = z.get(pair.source), onto = bp.get(pair.target);
    if (!from || !onto) throw new Error(`Missing hand bone: ${!from ? pair.source : pair.target}`);
    const bvh = new MeshBVH(onto.clone()), src = points(from);
    const sample = src.filter((_, i) => i % Math.max(1, Math.floor(src.length / 600)) === 0);
    const distances = (pts) => pts.map((p) => bvh.closestPointToPoint(p).distance * 1000);
    const before = distances(sample);
    // Rigid ICP from the centroid-aligned start.
    let transform = new Matrix4().makeTranslation(centroid(points(onto)).sub(centroid(src)));
    for (let iteration = 0; iteration < 40; iteration++) {
      const moved = sample.map((p) => p.clone().applyMatrix4(transform));
      const targets = moved.map((p) => bvh.closestPointToPoint(p).point.clone());
      transform = fitRigid(sample, targets);
    }
    const after = distances(sample.map((p) => p.clone().applyMatrix4(transform)));
    const shift = centroid(src).applyMatrix4(transform).sub(centroid(src));
    const rotation = Math.acos(Math.min(1, Math.max(-1, (transform.elements[0] + transform.elements[5] + transform.elements[10] - 1) / 2))) * 180 / Math.PI;
    rows.push({ side, ...pair, centroidOffsetMm: +(centroid(points(onto)).distanceTo(centroid(src)) * 1000).toFixed(2),
      beforeMedianMm: +percentile(before, .5).toFixed(2), beforeP95Mm: +percentile(before, .95).toFixed(2),
      afterMedianMm: +percentile(after, .5).toFixed(2), afterP95Mm: +percentile(after, .95).toFixed(2),
      rigidShiftMm: +(shift.length() * 1000).toFixed(2), rigidRotationDeg: +rotation.toFixed(2), transform: transform.toArray() });
  }
  return rows;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  // The earlier neural-centre fit is kept in the file as `previous`.
  const summarise = (rows) => ({ bones: rows.length, rigidShiftMm: { median: percentile(rows.map((r) => r.rigidShiftMm), .5), max: Math.max(...rows.map((r) => r.rigidShiftMm)) },
    rigidRotationDegMax: Math.max(...rows.map((r) => r.rigidRotationDeg)), fittedSurfaceP95MmMax: Math.max(...rows.map((r) => r.afterP95Mm)) });
  const previous = stored.previous ? await compareHandBones(stored.previous) : null;
  const rows = await compareHandBones();
  const files = ["data/catalog/male-registration.json", "public/models/bone.glb", "scripts/audit-male-hand-bones.mjs", "scripts/lib/male-hand-bones.mjs"]
    .map((path) => ({ path, sha256: createHash("sha256").update(fs.readFileSync(path)).digest("hex") }));
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ skeletonSha256: SKELETON_SHA256, files,
    method: "Per named hand-bone pair: centroid offset, one-way surface distance and a 40-step rigid ICP fit of the registered Z-Anatomy bone onto the BodyParts3D bone",
    current: { registration: { scale: stored.scale, translation: stored.translation }, ...summarise(rows), rows: rows.map(({ transform, ...r }) => r) },
    previous: previous && { registration: { scale: stored.previous.scale, translation: stored.previous.translation }, ...summarise(previous), rows: previous.map(({ transform, ...r }) => r) } }, null, 2) + "\n");
  for (const r of rows) console.log(r.side.padEnd(5), r.target.padEnd(36), "centroid", String(r.centroidOffsetMm).padStart(6), "surface med/p95", `${r.beforeMedianMm}/${r.beforeP95Mm}`.padStart(12), "→ rigid", `${r.afterMedianMm}/${r.afterP95Mm}`.padStart(11), "shift", r.rigidShiftMm, "rot", r.rigidRotationDeg);
}
