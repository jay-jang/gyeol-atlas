import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { NodeIO } from "@gltf-transform/core";
import { BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, DoubleSide, Vector3, Triangle } from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import { MODEST_MOVED_POINTS } from "../src/modesty.ts";

// The closed male groin drawn while "성기 가리기" is on (data/modesty-male-skin.json,
// scripts/modesty/): it must belong to the bundled skin, close the hole it opens
// exactly, face outwards, and carry the markers that sat on the removed skin.
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const modest = read("data/modesty-male-skin.json");
const doc = await new NodeIO().read("public/models/skin.glb");
const prim = doc.getRoot().listNodes().find((n) => n.getName() === modest.source.node).getMesh().listPrimitives()[0];
const P = prim.getAttribute("POSITION").getArray(), I = prim.getIndices().getArray();
const { positions: Q, normals: QN, indices: J } = modest.patch;
const hidden = new Set(modest.hiddenTriangles);
const key = (a, i) => `${Math.fround(a[3 * i])},${Math.fround(a[3 * i + 1])},${Math.fround(a[3 * i + 2])}`;
const edge = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

test("the closure belongs to the bundled male skin and is well formed", () => {
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(modest.source.file)).digest("hex"), modest.source.sha256);
  assert.equal(I.length / 3, modest.source.triangles);
  const h = modest.hiddenTriangles;
  assert.ok(h.length > 100 && h.length < 2000, `${h.length} hidden`);
  assert.ok(h.every((t, i) => Number.isInteger(t) && t >= 0 && t < I.length / 3 && (i === 0 || t > h[i - 1])), "sorted, unique, in range");
  assert.equal(Q.length, QN.length);
  assert.equal(J.length % 3, 0);
  assert.ok(J.every((v) => Number.isInteger(v) && v >= 0 && v < Q.length / 3));
  for (let i = 0; i < QN.length; i += 3) assert.ok(Math.abs(Math.hypot(QN[i], QN[i + 1], QN[i + 2]) - 1) < 1e-3, `normal ${i / 3}`);
  assert.ok(fs.statSync("data/modesty-male-skin.json").size < 150_000);
});

test("the closure meets the kept skin edge for edge and is wound outwards", () => {
  // Kept skin edges by exact float32 position.
  const kept = new Set();
  for (let t = 0; t < I.length / 3; t++) if (!hidden.has(t)) for (let j = 0; j < 3; j++) kept.add(edge(key(P, I[3 * t + j]), key(P, I[3 * t + (j + 1) % 3])));
  const uses = new Map();
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), n = new Vector3();
  for (let t = 0; t < J.length; t += 3) {
    for (let j = 0; j < 3; j++) {
      const from = key(Q, J[t + j]), to = key(Q, J[t + (j + 1) % 3]), e = edge(from, to);
      const u = uses.get(e) || { count: 0, forward: 0 };
      u.count++; if (from < to) u.forward++;
      uses.set(e, u);
    }
    a.fromArray(Q, 3 * J[t]); b.fromArray(Q, 3 * J[t + 1]); c.fromArray(Q, 3 * J[t + 2]);
    new Triangle(a, b, c).getNormal(n);
    const vn = new Vector3().fromArray(QN, 3 * J[t]).add(new Vector3().fromArray(QN, 3 * J[t + 1])).add(new Vector3().fromArray(QN, 3 * J[t + 2]));
    assert.ok(n.dot(vn) > 0, `patch triangle ${t / 3} faces against its normals`);
  }
  let seam = 0;
  for (const [e, u] of uses) {
    if (u.count === 1) { assert.ok(kept.has(e), `open patch edge ${e} is not a kept skin edge`); seam++; }
    else { assert.equal(u.count, 2, `non-manifold patch edge ${e}`); assert.equal(u.forward, 1, `inconsistent winding at ${e}`); }
  }
  assert.ok(seam >= 10, `${seam} seam edges`);
});

// Kept skin + closure as one ray target.
const merged = (() => {
  const keptIdx = [];
  for (let t = 0; t < I.length / 3; t++) if (!hidden.has(t)) keptIdx.push(I[3 * t], I[3 * t + 1], I[3 * t + 2]);
  const base = P.length / 3, pos = new Float32Array(P.length + Q.length);
  pos.set(P); pos.set(Q, P.length);
  const geometry = new BufferGeometry().setAttribute("position", new BufferAttribute(pos, 3)).setIndex(new BufferAttribute(new Uint32Array([...keptIdx, ...J.map((v) => v + base)]), 1));
  geometry.boundsTree = new MeshBVH(geometry);
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
  mesh.raycast = acceleratedRaycast; mesh.updateMatrixWorld(true);
  return mesh;
})();
const ray = new Raycaster(); ray.firstHitOnly = true;
const firstHit = (from, dir) => { ray.set(from, dir); ray.far = 5; return ray.intersectObject(merged)[0]; };

test("rays at the closed groin from the front, below and the sides meet the outside of the skin", () => {
  const target = new Vector3(0, 0.755, 0.03);
  let hits = 0;
  for (let i = 0; i < 1500; i++) {
    const y = 1 - (2 * (i + 0.5)) / 1500, r = Math.sqrt(1 - y * y), t = Math.PI * (3 - Math.sqrt(5)) * i;
    const dir = new Vector3(Math.cos(t) * r, y, Math.sin(t) * r);
    if (dir.y > 0.3 || dir.z < -0.6) continue; // the groin is seen from the front, the sides and below
    const from = target.clone().addScaledVector(dir, 2.5), toward = dir.clone().negate();
    for (const dx of [-0.02, 0, 0.02]) for (const dy of [-0.015, 0, 0.015]) {
      const hit = firstHit(from.clone().add(new Vector3(dx, dy, 0)), toward);
      if (!hit) continue;
      hits++;
      assert.ok(hit.face.normal.dot(toward) < 0, `back face seen at ${hit.point.toArray().map((v) => v.toFixed(3))}`);
    }
  }
  assert.ok(hits > 3000, `${hits} hits`);
});

test("markers on the removed skin are carried onto the closed surface in open air", () => {
  const anchors = read("data/anchors.json");
  const moved = new Map((modest.anchors ?? []).map((a) => [a.key, a]));
  const tri = new Triangle(), closest = new Vector3();
  const nearestHidden = (p) => {
    let best = Infinity;
    for (const t of hidden) {
      tri.a.fromArray(P, 3 * I[3 * t]); tri.b.fromArray(P, 3 * I[3 * t + 1]); tri.c.fromArray(P, 3 * I[3 * t + 2]);
      best = Math.min(best, tri.closestPointToPoint(p, closest).distanceTo(p));
    }
    return best;
  };
  const keptTriangles = I.length / 3 - hidden.size;
  for (const a of anchors) {
    if (moved.has(a.key) || a.mode === "region-reference") continue;
    const surface = new Vector3(...a.surfacePoint), out = new Vector3(...a.position).sub(surface).normalize();
    assert.ok(nearestHidden(surface) > 1e-6, `${a.key} sits on removed skin without a new place`);
    // Nor is it shut in behind the closure (the pocket the scrotum filled).
    const ahead = firstHit(surface.clone().addScaledVector(out, 0.0005), out);
    assert.ok(!ahead || ahead.faceIndex < keptTriangles, `${a.key} is behind the closure`);
  }
  for (const [k, m] of moved) {
    assert.ok(anchors.some((a) => a.key === k), k);
    const surface = new Vector3(...m.surfacePoint), position = new Vector3(...m.position);
    assert.ok(Math.abs(position.distanceTo(surface) - 0.003) < 1e-6, `${k} display offset`);
    const out = position.clone().sub(surface).normalize();
    // On the drawn surface: a ray back from the display point lands on it.
    const back = firstHit(position, out.clone().negate());
    assert.ok(back && back.point.distanceTo(surface) < 2e-4, `${k} is off the closed surface`);
    // In open air: nothing closes in front of it within the thigh gap.
    const ahead = firstHit(surface.clone().addScaledVector(out, 0.0005), out);
    assert.ok(!ahead || ahead.distance > 0.01, `${k} faces a surface ${ahead?.distance} m away`);
  }
});

test("the point cards name the points whose markers the closure moves by centimetres", () => {
  const byKey = new Map(read("data/anchors.json").map((a) => [a.key, a]));
  const far = modest.anchors.filter((m) => new Vector3(...m.surfacePoint).distanceTo(new Vector3(...byKey.get(m.key).surfacePoint)) > 0.005);
  assert.deepEqual([...new Set(far.map((m) => byKey.get(m.key).pointId))].sort(), [...MODEST_MOVED_POINTS].sort());
});
