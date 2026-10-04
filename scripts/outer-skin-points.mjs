// Outer surface points of a drawn skin: the first hit of rays coming from
// outside the body (Fibonacci directions, dense parallel grids), thinned to
// one point per 4 mm voxel, with the hit triangle's outward normal. The male
// BodyParts3D skin is a two-shelled mesh, so its own normals cannot tell the
// outer shell apart. Input: a scripts/dump-drawn-geometry.mjs directory.
// Usage: node scripts/outer-skin-points.mjs <dump dir> <mesh name> <out.bin> [spacing mm] [directions]
import fs from "node:fs";
import { BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3, DoubleSide } from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
Mesh.prototype.raycast = acceleratedRaycast;
const [dir, name, outFile, spacingMm = "3", dirCount = "300"] = process.argv.slice(2);
const index = JSON.parse(fs.readFileSync(`${dir}/index.json`, "utf8")).parts;
const blob = fs.readFileSync(`${dir}/geometry.bin`);
const part = index.find(p => p.name === name);
const pos = new Float32Array(blob.buffer.slice(blob.byteOffset + part.posOffset, blob.byteOffset + part.posOffset + part.posBytes));
const idx = new Uint32Array(blob.buffer.slice(blob.byteOffset + part.idxOffset, blob.byteOffset + part.idxOffset + part.idxBytes));
const g = new BufferGeometry(); g.setAttribute("position", new BufferAttribute(pos, 3)); g.setIndex(new BufferAttribute(idx, 1));
g.boundsTree = new MeshBVH(g); g.computeBoundingSphere();
const mesh = new Mesh(g, new MeshBasicMaterial({ side: DoubleSide }));
const ray = new Raycaster(); ray.firstHitOnly = true;
const center = g.boundingSphere.center, radius = g.boundingSphere.radius + 0.05;
const N = Number(dirCount), step = Number(spacingMm) / 1000, cell = 0.004, voxel = new Map();
const d = new Vector3(), u = new Vector3(), v = new Vector3(), o = new Vector3();
for (let k = 0; k < N; k++) {
  const y = 1 - (k + .5) / N * 2, r = Math.sqrt(1 - y * y), phi = k * Math.PI * (3 - Math.sqrt(5));
  d.set(Math.cos(phi) * r, y, Math.sin(phi) * r).normalize();
  u.set(Math.abs(d.y) < .9 ? 0 : 1, Math.abs(d.y) < .9 ? 1 : 0, 0).cross(d).normalize(); v.copy(d).cross(u);
  for (let a = -radius; a <= radius; a += step) for (let b = -radius; b <= radius; b += step) {
    o.copy(center).addScaledVector(u, a).addScaledVector(v, b).addScaledVector(d, -radius);
    ray.set(o, d); ray.far = 2 * radius;
    const h = ray.intersectObject(mesh)[0];
    if (!h) continue;
    const key = `${Math.floor(h.point.x / cell)},${Math.floor(h.point.y / cell)},${Math.floor(h.point.z / cell)}`;
    if (voxel.has(key)) continue;
    const n = h.face.normal.clone(); if (n.dot(d) > 0) n.negate();
    voxel.set(key, [h.point.x, h.point.y, h.point.z, n.x, n.y, n.z]);
  }
}
fs.writeFileSync(outFile, Buffer.from(Float32Array.from([...voxel.values()].flat()).buffer));
console.log(name, "outer points", voxel.size, "->", outFile);
