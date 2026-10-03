import fs from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import {
  BufferGeometry,
  BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
  Triangle,
} from "three";
import { MeshBVH } from "three-mesh-bvh";
const points = JSON.parse(await fs.readFile("data/points.json", "utf8"));
// A marker that already exists for the same seed keeps the surface it was
// placed on: after a skin rebuild it moves to the closest point of the new
// skin instead of being re-projected. The male skin is a shell with inner
// surfaces, so a fresh ray choice can jump to another surface centimetres
// away; projection is only for new seeds.
const previous = new Map(JSON.parse(await fs.readFile("data/anchors.json", "utf8").catch(() => "[]")).map((a) => [a.key, a]));
const KEEP_SURFACE_MAX_MM = 5;
const manifest = JSON.parse(
  await fs.readFile("public/models/manifest.json", "utf8"),
);
const structurePairs = Object.fromEntries(
  manifest.assets.map((a) => [
    a.id,
    manifest.assets.find((b) => b.name === a.name.replace(/\bright\b/, "left"))
      ?.id || a.id,
  ]),
);
await fs.writeFile(
  "data/structure-pairs.json",
  JSON.stringify(structurePairs, null, 2) + "\n",
);
const doc = await new NodeIO().read("public/models/skin.glb");
const primitive = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const geometry = new BufferGeometry()
  .setAttribute(
    "position",
    new BufferAttribute(primitive.getAttribute("POSITION").getArray(), 3),
  )
  .setIndex(new BufferAttribute(primitive.getIndices().getArray(), 1));
const skin = new Mesh(geometry, new MeshBasicMaterial());
const skinBvh = new MeshBVH(geometry.clone());
skin.updateMatrixWorld(true);
const ray = new Raycaster(),
  anchors = [],
  missing = [];
for (const p of points)
 for (const [occurrence, coordinates] of (p.occurrences || [p.position]).entries())
  for (const sign of p.bilateral ? [-1, 1] : [1]) {
    const seed = new Vector3(
      coordinates[0] * (p.bilateral ? sign : 1),
      coordinates[1],
      coordinates[2],
    );
    let direction = new Vector3(0, 0, -1);
    if (p.surface === "back") direction.set(0, 0, 1);
    if (p.surface === "top") direction.set(0, -1, 0);
    if (p.surface === "bottom") direction.set(0, 1, 0);
    if (p.surface === "lateral") direction.set(seed.x < 0 ? 1 : -1, 0, 0);
    if (p.surface === "medial") direction.set(seed.x < 0 ? -1 : 1, 0, 0);
    const origin =
      p.surface === "medial"
        ? new Vector3(0, seed.y, seed.z)
        : seed.clone().addScaledVector(direction, -0.5);
    const key = `${p.id}-${occurrence}-${sign}`, before = previous.get(key);
    if (before && before.seed.every((v, i) => v === seed.getComponent(i))) {
      const nearest = skinBvh.closestPointToPoint(new Vector3(...before.surfacePoint));
      if (nearest.distance * 1000 > KEEP_SURFACE_MAX_MM)
        throw Error(`${key}: its surface moved ${(nearest.distance * 1000).toFixed(1)} mm; review before re-projecting.`);
      // Already on this skin: keep the stored coordinates exactly.
      const onSkin = nearest.distance < 1e-9;
      const surfacePoint = onSkin ? new Vector3(...before.surfacePoint) : nearest.point.clone();
      const outward = new Vector3(...before.position).sub(new Vector3(...before.surfacePoint)).normalize();
      anchors.push({
        pointId: p.id, occurrence, key, mode: p.markerMode || "surface-illustration", method: before.method,
        side: seed.x < 0 ? "right" : seed.x > 0 ? "left" : "midline",
        position: onSkin ? before.position : surfacePoint.clone().addScaledVector(outward, 0.003).toArray(),
        surfacePoint: surfacePoint.toArray(), seed: seed.toArray(), seedDistance: surfacePoint.distanceTo(seed),
        displayOffset: 0.003, status: "illustrative-unreviewed",
      });
      continue;
    }
    ray.set(origin, direction);
    let hit = ray
      .intersectObject(skin)
      .sort((a, b) => a.point.distanceToSquared(seed) - b.point.distanceToSquared(seed))
      .find(
        (h) =>
          Math.abs(h.point.x - seed.x) < 0.06 &&
          Math.abs(h.point.y - seed.y) < 0.1 &&
          h.point.distanceTo(seed) < 0.075,
      );
    let method = "axis-ray";
    // Thin fingers/toes can fall between axial rays on the simplified mesh.
    // A bounded closest-triangle projection cannot jump to another body region.
    if (!hit) {
      const pos = geometry.attributes.position, idx = geometry.index;
      const tri = new Triangle(), candidate = new Vector3();
      let distance = 0.025, nearest = null, normal = null;
      for (let i = 0; i < idx.count; i += 3) {
        tri.a.fromBufferAttribute(pos, idx.getX(i));
        tri.b.fromBufferAttribute(pos, idx.getX(i + 1));
        tri.c.fromBufferAttribute(pos, idx.getX(i + 2));
        tri.closestPointToPoint(seed, candidate);
        const d = candidate.distanceTo(seed);
        if (d < distance) { distance = d; nearest = candidate.clone(); normal = tri.getNormal(new Vector3()); }
      }
      if (nearest) { hit = { point: nearest }; direction.copy(normal).negate(); method = "bounded-nearest-triangle"; }
    }
    if (!hit) {
      missing.push(`${p.id} ${sign}`);
      continue;
    }
    const position = hit.point.clone().addScaledVector(direction, -0.003);
    anchors.push({
      pointId: p.id,
      occurrence,
      key: `${p.id}-${occurrence}-${sign}`,
      mode: p.markerMode || "surface-illustration",
      method,
      side: seed.x < 0 ? "right" : seed.x > 0 ? "left" : "midline",
      position: position.toArray(),
      surfacePoint: hit.point.toArray(),
      seed: seed.toArray(),
      seedDistance: hit.point.distanceTo(seed),
      displayOffset: 0.003,
      status: "illustrative-unreviewed",
    });
  }
if (missing.length)
  throw Error(
    `No skin projection for ${missing.join(", ")}. Adjust seeds rather than placing floating markers.`,
  );
await fs.writeFile(
  "data/anchors.json",
  JSON.stringify(anchors, null, 2) + "\n",
);
await fs.writeFile(
  "public/models/acupoint-anchors.json",
  JSON.stringify(anchors, null, 2) + "\n",
);
console.log(
  `Projected ${anchors.length} anchors; largest seed adjustment ${(Math.max(...anchors.map((a) => a.seedDistance)) * 1000).toFixed(1)} mm (not a clinical accuracy measurement).`,
);
