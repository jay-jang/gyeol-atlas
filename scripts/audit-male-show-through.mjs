// Which male structures show through the opaque skin at 0%? Rays are cast on
// a grid from 14 directions around each hand and foot; a ray whose first hit
// inside the region is not the skin marks tissue lying in front of the skin
// there. This measures what the viewer sees; it does not register anything.
// The current registration and the earlier one kept as `previous` are both run.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import draco from "draco3dgltf";
import { Box3, BufferAttribute, BufferGeometry, DoubleSide, Matrix4, Ray, Vector3 } from "three";
import { MeshBVH } from "three-mesh-bvh";

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const stored = read("data/catalog/male-registration.json");
const base = read("public/models/manifest.json").assets;
const full = read("data/full-system-structures.json");
const connective = read("data/connective-structures.json");
const lymph = read("data/sex-lymph-structures.json").filter((s) => s.sex === "male" && s.layer === "lymph");
const io = new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });
const step = Number(process.env.STEP_MM || 1) / 1000;

async function glb(file, entries, registration) {
  const doc = await io.read(file), parts = [], byNode = new Map(entries.map((e) => [e.node || e.id, e]));
  for (const node of doc.getRoot().listNodes()) {
    const entry = node.getMesh() && byNode.get(node.getName());
    if (!entry) continue;
    const matrix = new Matrix4().fromArray(node.getWorldMatrix());
    for (const primitive of node.getMesh().listPrimitives()) {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(new Float32Array(primitive.getAttribute("POSITION").getArray()), 3));
      if (primitive.getIndices()) geometry.setIndex(new BufferAttribute(new Uint32Array(primitive.getIndices().getArray()), 1));
      geometry.applyMatrix4(matrix);
      if (registration) { geometry.scale(registration.scale, registration.scale, registration.scale); geometry.translate(...registration.translation); }
      parts.push({ ...entry, geometry, source: file.split("/").pop() });
    }
  }
  return parts;
}
const baseParts = [
  ...await glb("public/models/skin.glb", base), ...await glb("public/models/muscle.glb", base),
  ...await glb("public/models/bone.glb", base), ...await glb("public/models/organ.glb", base),
];
const skin = baseParts.find((p) => p.id === "FMA7163");
// Diagnostics: SKIN_GLB swaps in a candidate skin; SKIN_STL the unsimplified
// source skin, placed as the build places it.
if (process.env.SKIN_GLB) skin.geometry = (await glb(process.env.SKIN_GLB, [{ id: "FMA7163" }]))[0].geometry;
if (process.env.SKIN_STL) {
  const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
  const bytes = fs.readFileSync(process.env.SKIN_STL), raw = new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const p = raw.getAttribute("position"), out = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { out[i * 3] = p.getX(i) / 1000; out[i * 3 + 1] = (p.getZ(i) + 13.5175) / 1000; out[i * 3 + 2] = (-p.getY(i) - 96.5107) / 1000; }
  skin.geometry = new BufferGeometry().setAttribute("position", new BufferAttribute(out, 3));
}
const handBone = /phalanx of .*(finger|thumb)|metacarpal|scaphoid|lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate/i;
const footBone = /phalanx of .*toe|metatarsal|calcaneus|talus|navicular|cuboid|cuneiform/i;
const region = (test, side) => {
  const box = new Box3();
  for (const p of baseParts) if (p.layer === "bone" && test.test(p.name) && new RegExp(`\\b${side}\\b`, "i").test(p.name)) {
    p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox);
  }
  return box.expandByScalar(0.03);
};
// REGIONS=body screens the whole body instead (coarser STEP_MM recommended).
const regions = process.env.REGIONS === "body"
  ? { "whole body": (skin.geometry.computeBoundingBox(), skin.geometry.boundingBox.clone().expandByScalar(0.01)) }
  : { "right hand": region(handBone, "right"), "left hand": region(handBone, "left"), "right foot": region(footBone, "right"), "left foot": region(footBone, "left") };
const directions = [];
for (const v of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) directions.push(new Vector3(...v));
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) directions.push(new Vector3(x, y, z).normalize());

async function audit(registration, skinGeometry = skin.geometry) {
  const previousSkin = skin.geometry; skin.geometry = skinGeometry;
  const parts = [...baseParts,
    ...await glb("public/models/nerve-full.glb", full.filter((s) => s.layer === "nerve"), registration),
    ...await glb("public/models/vessel-full.glb", full.filter((s) => s.layer === "vessel"), registration),
    ...await glb("public/models/ligament-full.glb", connective.filter((s) => s.model === "ligament-full.glb"), registration),
    ...await glb("public/models/tendon-full.glb", connective.filter((s) => s.model === "tendon-full.glb"), registration),
    ...await glb("public/models/reference/lymphatic_male.glb", lymph, registration),
  ];
  const out = {};
  for (const [name, box] of Object.entries(regions)) {
    // One BVH over the triangles near this region, tagged with their part.
    const positions = [], owner = [];
    const near = box.clone().expandByScalar(0.01), a = new Vector3(), b = new Vector3(), c = new Vector3();
    parts.forEach((p, index) => {
      const pos = p.geometry.getAttribute("position"), idx = p.geometry.getIndex();
      const count = idx ? idx.count : pos.count;
      for (let t = 0; t < count; t += 3) {
        const i = idx ? idx.getX(t) : t, j = idx ? idx.getX(t + 1) : t + 1, k = idx ? idx.getX(t + 2) : t + 2;
        a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, j); c.fromBufferAttribute(pos, k);
        if (!near.containsPoint(a) && !near.containsPoint(b) && !near.containsPoint(c)) continue;
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); owner.push(index);
      }
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    // The BVH reorders whole triangles, so a hit's first vertex / 3 is its source triangle.
    const bvh = new MeshBVH(geometry);
    const counts = new Map(); let rays = 0, skinFirst = 0;
    const centre = box.getCenter(new Vector3()), radius = box.getSize(new Vector3()).length() / 2 + 0.02;
    for (const direction of directions) {
      const u = new Vector3(1, 0, 0); if (Math.abs(direction.x) > .9) u.set(0, 1, 0);
      const right = u.clone().cross(direction).normalize(), up = direction.clone().cross(right).normalize();
      for (let s = -radius; s <= radius; s += step) for (let t = -radius; t <= radius; t += step) {
        const origin = centre.clone().addScaledVector(right, s).addScaledVector(up, t).addScaledVector(direction, -radius - 0.05);
        const hit = bvh.raycastFirst(new Ray(origin, direction), DoubleSide);
        if (!hit || !box.containsPoint(hit.point)) continue;
        rays++;
        const part = parts[owner[hit.face.a / 3]];
        if (part === skin) { skinFirst++; continue; }
        const row = counts.get(part.id) || { id: part.id, name: part.name, layer: part.layer, source: part.source, kind: part.kind, rays: 0 };
        row.rays++; counts.set(part.id, row);
      }
    }
    const rows = [...counts.values()].sort((x, y) => y.rays - x.rays), bySource = {};
    for (const r of rows) bySource[r.source] = (bySource[r.source] || 0) + r.rays;
    const supplement = rows.filter((r) => !["muscle.glb", "bone.glb", "organ.glb"].includes(r.source)).reduce((n, r) => n + r.rays, 0);
    out[name] = { rays, skinFirst, showThroughRays: rays - skinFirst, supplementRays: supplement, showThroughStructures: rows.length, bySource, top: rows.slice(0, Number(process.env.TOP || 30)) };
    console.log(name, JSON.stringify({ rays, showThrough: rays - skinFirst, supplement }));
  }
  skin.geometry = previousSkin;
  return out;
}
// BASELINE_SKIN: the skin before the finer hands and feet (e.g. from git), so
// the record separates the registration fix from the skin detail.
const baselineSkin = process.env.BASELINE_SKIN ? (await glb(process.env.BASELINE_SKIN, [{ id: "FMA7163" }]))[0].geometry : null;
const report = { method: "First ray hit inside each hand/foot box (bones + 30 mm) on a grid from 14 directions; a non-skin first hit is tissue in front of the skin. Supplement rays exclude the base BodyParts3D muscle, bone and organ meshes.",
  stepMm: step * 1000, skinTriangles: skin.geometry.getIndex().count / 3, states: {} };
const states = [["final", stored, null]];
if (baselineSkin) states.push(["registrationOnly", stored, baselineSkin]);
if (baselineSkin && stored.previous) states.push(["original", stored.previous, baselineSkin]);
for (const [name, registration, skinGeometry] of states) {
  console.log(`== ${name}`);
  report.states[name] = { registration: { scale: registration.scale, translation: registration.translation },
    skin: skinGeometry ? process.env.BASELINE_SKIN_LABEL || process.env.BASELINE_SKIN : "public/models/skin.glb",
    skinTriangles: (skinGeometry || skin.geometry).getIndex().count / 3, regions: await audit(registration, skinGeometry || skin.geometry) };
}
report.files = ["data/catalog/male-registration.json", "public/models/skin.glb", "public/models/muscle.glb", "public/models/bone.glb", "public/models/organ.glb",
  "public/models/nerve-full.glb", "public/models/vessel-full.glb", "public/models/ligament-full.glb", "public/models/tendon-full.glb",
  "public/models/reference/lymphatic_male.glb", "scripts/audit-male-show-through.mjs"].map((path) => ({ path, sha256: createHash("sha256").update(fs.readFileSync(path)).digest("hex") }));
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(report, null, 2) + "\n");
