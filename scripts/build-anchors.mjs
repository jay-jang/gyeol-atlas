import fs from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import {
  BufferGeometry,
  BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  DoubleSide,
  Vector3,
  Triangle,
} from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
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
// The bundled skin is a thick shell whose inner faces connect to the outer
// one, so neither connectivity nor crossing parity tells them apart (a ray can
// also run on into an arm or the other thigh). A marker belongs on a face the
// viewer can see: just outside it, or midway across the gap in front of it,
// some ray reaches open air. Otherwise it moves outward along its own
// direction to the first face leaving the skin that passes the same test,
// never sideways across the midline. Internal region references stay.
const outerRay = new Raycaster(), airRay = new Raycaster(), lifted = [], enclosed = [];
airRay.firstHitOnly = true;
const airGeometry = geometry.clone();
airGeometry.boundsTree = new MeshBVH(airGeometry);
const bothSides = new Mesh(airGeometry, new MeshBasicMaterial({ side: DoubleSide }));
bothSides.raycast = acceleratedRaycast;
bothSides.updateMatrixWorld(true);
const AIR_DIRECTIONS = Array.from({ length: 512 }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / 512, r = Math.sqrt(1 - y * y), t = Math.PI * (3 - Math.sqrt(5)) * i;
  return new Vector3(Math.cos(t) * r, y, Math.sin(t) * r);
});
function reachesOpenAir(point) {
  for (const d of AIR_DIRECTIONS) {
    airRay.set(point, d); airRay.far = 3;
    if (!airRay.intersectObject(bothSides).length) return true;
  }
  return false;
}
function outerSurface(key, point, outward, mode) {
  if (mode === "region-reference") return point;
  outerRay.set(point.clone().addScaledVector(outward, 0.0005), outward); outerRay.far = 0.3;
  const hits = outerRay.intersectObject(bothSides);
  const open = (at, next) => reachesOpenAir(at.clone().addScaledVector(outward, 0.0015))
    || Boolean(next && next.distance - at.distanceTo(point) > 0.003 && reachesOpenAir(at.clone().lerp(next.point, 0.5)));
  if (open(point, hits[0])) return point;
  const ahead = hits.filter((hit) => !(Math.abs(outward.x) > 0.7 && hit.point.x * point.x < 0));
  for (const [i, hit] of ahead.entries()) {
    if (hit.face.normal.dot(outward) <= 0 || !open(hit.point, ahead[i + 1])) continue;
    lifted.push(`${key} ${(hit.distance * 1000 + 0.5).toFixed(1)} mm`);
    return hit.point.clone();
  }
  // Touching parts (the arm on the chest wall, the thigh on the scrotum) close
  // the gap in front, so no ray escapes: the first face leaving the skin before
  // the midline, or the marker's own face when it already faces the contact.
  const exit = ahead.find((hit) => hit.face.normal.dot(outward) > 0);
  enclosed.push(`${key} ${exit ? `${(exit.distance * 1000 + 0.5).toFixed(1)} mm` : "kept"}`);
  return exit ? exit.point.clone() : point;
}
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
      const outward = new Vector3(...before.position).sub(new Vector3(...before.surfacePoint)).normalize();
      const kept = nearest.distance < 1e-9 ? new Vector3(...before.surfacePoint) : nearest.point.clone();
      const surfacePoint = outerSurface(key, kept, outward, p.markerMode);
      const onSkin = nearest.distance < 1e-9 && surfacePoint === kept;
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
    hit = { point: outerSurface(`${p.id}-${occurrence}-${sign}`, hit.point.clone(), direction.clone().negate(), p.markerMode) };
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
if (lifted.length) console.log(`Moved ${lifted.length} anchors out to the visible skin surface: ${lifted.join(", ")}`);
if (enclosed.length) console.log(`Placed ${enclosed.length} anchors facing a closed contact pocket: ${enclosed.join(", ")}`);
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
