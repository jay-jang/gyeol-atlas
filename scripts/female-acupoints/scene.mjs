// Shared geometry for the female acupoint landmarks, the marker build and its
// gates: the app's own world-space geometry as dumped into
// .cache/female-transport/{female,male}-scene (index.json + geometry.bin).
import fs from "node:fs";
import crypto from "node:crypto";
import { BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3, DoubleSide } from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
Mesh.prototype.raycast = acceleratedRaycast;

export const CACHE = ".cache/female-transport";
export const sceneDir = (sex) => `${CACHE}/${sex}-scene`;

export function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
export function sceneHashes(sex) {
  const dir = sceneDir(sex);
  return { "index.json": sha256(`${dir}/index.json`), "geometry.bin": sha256(`${dir}/geometry.bin`) };
}

const scenes = new Map();
export function loadScene(sex) {
  if (scenes.has(sex)) return scenes.get(sex);
  const dir = sceneDir(sex);
  const index = JSON.parse(fs.readFileSync(`${dir}/index.json`, "utf8")).parts, blob = fs.readFileSync(`${dir}/geometry.bin`);
  const parts = new Map();
  for (const p of index) {
    if (parts.has(p.name)) continue;   // a name dumped twice keeps its first mesh
    const pos = new Float32Array(blob.buffer.slice(blob.byteOffset + p.posOffset, blob.byteOffset + p.posOffset + p.posBytes));
    const idx = p.idxBytes ? new Uint32Array(blob.buffer.slice(blob.byteOffset + p.idxOffset, blob.byteOffset + p.idxOffset + p.idxBytes)) : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
    parts.set(p.name, { ...p, pos, idx });
  }
  const scene = { sex, parts, meshes: new Map() };
  scenes.set(sex, scene);
  return scene;
}
export function part(scene, name) {
  const p = scene.parts.get(name);
  if (!p) throw Error(`${scene.sex} scene has no part ${name}`);
  return p;
}
/** Vertices of one or more parts as [x, y, z] arrays. */
export function vertices(scene, names) {
  const out = [];
  for (const name of [names].flat()) {
    const { pos } = part(scene, name);
    for (let i = 0; i < pos.length; i += 3) out.push([pos[i], pos[i + 1], pos[i + 2]]);
  }
  return out;
}
/** A double-sided BVH mesh of the named parts (cached per scene). */
export function meshOf(scene, names) {
  const key = [names].flat().join("+");
  if (scene.meshes.has(key)) return scene.meshes.get(key);
  const list = [names].flat().map((n) => part(scene, n));
  const P = new Float32Array(list.reduce((n, p) => n + p.pos.length, 0)), I = new Uint32Array(list.reduce((n, p) => n + p.idx.length, 0));
  let po = 0, io = 0;
  for (const p of list) { P.set(p.pos, po); for (let k = 0; k < p.idx.length; k++) I[io + k] = p.idx[k] + po / 3; po += p.pos.length; io += p.idx.length; }
  const g = new BufferGeometry(); g.setAttribute("position", new BufferAttribute(P, 3)); g.setIndex(new BufferAttribute(I, 1)); g.boundsTree = new MeshBVH(g);
  const m = new Mesh(g, new MeshBasicMaterial({ side: DoubleSide })); m.updateMatrixWorld(true);
  scene.meshes.set(key, m);
  return m;
}

const FRONT = new Vector3(0, 0, -1), frontRay = new Raycaster();
/** Outermost crossing of `mesh` seen from the front at (x, y): the first hit of a ray travelling -z from z = +2. */
export function frontHit(mesh, x, y) {
  frontRay.set(new Vector3(x, y, 2), FRONT); frontRay.far = 4;
  return frontRay.intersectObject(mesh)[0] || null;
}

// The male rule of tests/data.test.mjs ("surface anchors sit on the skin the
// viewer sees"): just outside the face, or midway across the gap in front of
// it, some ray reaches open air. Crossing parity is not used: rays run on into
// the other limbs.
export const AIR_DIRECTIONS = Array.from({ length: 1024 }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / 1024, r = Math.sqrt(1 - y * y), t = Math.PI * (3 - Math.sqrt(5)) * i;
  return new Vector3(Math.cos(t) * r, y, Math.sin(t) * r);
});
const airRay = new Raycaster(), aheadRay = new Raycaster(); airRay.firstHitOnly = true;
export function reachesOpenAir(mesh, p) {
  for (const d of AIR_DIRECTIONS) { airRay.set(p, d); airRay.far = 5; if (!airRay.intersectObject(mesh).length) return true; }
  return false;
}
/** surface, outward: Vector3. Returns { open, next } where next is the first skin met ahead. */
export function openAir(mesh, surface, outward) {
  const out = outward.clone().normalize();
  aheadRay.set(surface.clone().addScaledVector(out, 0.0005), out); aheadRay.far = 0.3;
  const next = aheadRay.intersectObject(mesh)[0];
  const open = reachesOpenAir(mesh, surface.clone().addScaledVector(out, 0.0015))
    || Boolean(next && next.distance > 0.003 && reachesOpenAir(mesh, surface.clone().lerp(next.point, 0.5)));
  return { open, next };
}

/**
 * Cross-sections of a part by the plane x = X as ordered polylines of [y, z]
 * points, chained through the mesh edges they cross (each crossing is keyed by
 * its edge, so neighbouring triangles share it exactly). `closed` marks loops.
 */
export function planeContours(scene, name, X) {
  const { pos, idx } = part(scene, name), segs = [];
  for (let k = 0; k < idx.length; k += 3) {
    const e = [];
    for (let j = 0; j < 3; j++) {
      const a = idx[k + j], b = idx[k + ((j + 1) % 3)];
      if (pos[a * 3] - X < 0 === pos[b * 3] - X < 0) continue;
      const [p, q] = a < b ? [a, b] : [b, a], xp = pos[p * 3] - X, t = xp / (xp - (pos[q * 3] - X));
      e.push({ key: `${p}:${q}`, pt: [pos[p * 3 + 1] + t * (pos[q * 3 + 1] - pos[p * 3 + 1]), pos[p * 3 + 2] + t * (pos[q * 3 + 2] - pos[p * 3 + 2])] });
    }
    if (e.length === 2) segs.push(e);
  }
  const byKey = new Map();
  for (const [i, s] of segs.entries()) for (const e of s) { if (!byKey.has(e.key)) byKey.set(e.key, []); byKey.get(e.key).push(i); }
  const used = new Uint8Array(segs.length), loops = [];
  for (let i0 = 0; i0 < segs.length; i0++) {
    if (used[i0]) continue;
    used[i0] = 1;
    const line = [segs[i0][0], segs[i0][1]];
    for (const atEnd of [true, false]) for (;;) {
      const end = atEnd ? line[line.length - 1] : line[0], next = byKey.get(end.key).find((j) => !used[j]);
      if (next === undefined) break;
      used[next] = 1;
      const other = segs[next][0].key === end.key ? segs[next][1] : segs[next][0];
      if (atEnd) line.push(other); else line.unshift(other);
    }
    const closed = line.length > 2 && line[0].key === line[line.length - 1].key;
    loops.push({ closed, points: (closed ? line.slice(0, -1) : line).map((e) => e.pt) });
  }
  return loops;
}

/** Area-weighted mean winding (outward) normal of a part's faces whose centroid lies within r of p. */
export function meanNormal(scene, name, p, r) {
  const { pos, idx } = part(scene, name), n = new Vector3(), a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (let k = 0; k < idx.length; k += 3) {
    a.fromArray(pos, idx[k] * 3); b.fromArray(pos, idx[k + 1] * 3); c.fromArray(pos, idx[k + 2] * 3);
    const cx = (a.x + b.x + c.x) / 3 - p.x, cy = (a.y + b.y + c.y) / 3 - p.y, cz = (a.z + b.z + c.z) / 3 - p.z;
    if (cx * cx + cy * cy + cz * cz > r * r) continue;
    n.add(b.clone().sub(a).cross(c.clone().sub(a)));   // length = 2 x area
  }
  return n.normalize();
}

/** Closest distance from p to a mesh (BVH). */
export function closestDistance(mesh, p) {
  return mesh.geometry.boundsTree.closestPointToPoint(p).distance;
}
export { Vector3, Raycaster };
