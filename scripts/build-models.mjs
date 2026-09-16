import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { createHash } from "node:crypto";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { BufferGeometry, BufferAttribute } from "three";
import { MeshoptSimplifier } from "meshoptimizer";
import { Document, NodeIO } from "@gltf-transform/core";
const inputs = JSON.parse(
  await fs.readFile("scripts/model-inputs.json", "utf8"),
);
const base = `https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/${inputs.commit}/`;
await fs.mkdir(".cache/models", { recursive: true });
await fs.mkdir("public/models", { recursive: true });
try {
  await fs.copyFile("/tmp/skin.stl", ".cache/models/FMA7163.stl");
} catch {}
for (const a of inputs.assets.filter(a => a.format === 'obj')) {
  try { await fs.access(`.cache/models/${a.id}.obj`); }
  catch { execFileSync('python3', ['scripts/download-supplement.py'], {stdio:'inherit'}); break; }
}
let cursor = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (cursor < inputs.assets.length) {
      const a = inputs.assets[cursor++];
      if (a.format === "obj") continue;
      const p = `.cache/models/${a.id}.stl`;
      try {
        await fs.access(p);
      } catch {
        const r = await fetch(base + a.path);
        if (!r.ok) throw Error(`${a.id}: ${r.status}`);
        await fs.writeFile(p, Buffer.from(await r.arrayBuffer()));
      }
    }
  }),
);
await MeshoptSimplifier.ready;
const manifest = {
  source: "BodyParts3D / Anatomography v3.0 (20110915), with version-stamped 4.3 supplement",
  mirror: "Kevin-Mattheus-Moerman/BodyParts3D",
  commit: inputs.commit,
  license: "CC-BY-SA-2.1-JP",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/2.1/jp/",
  attribution:
    "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan",
  transform:
    "x=X/1000; y=(Z+13.5175)/1000; z=(-Y-96.5107)/1000. Original unit mm; scene unit m.",
  modifications:
    "STL to GLB, welded positions, meshoptimizer topology-aware simplification, smooth normals, coordinate transform; no clinical registration.",
  assets: [],
};
for (const layer of ["skin", "bone", "muscle", "organ", "vessel", "nerve"]) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(layer);
  let total = 0;
  for (const a of inputs.assets.filter((a) => a.layer === layer)) {
    const bytes = await fs.readFile(`.cache/models/${a.id}.${a.format || "stl"}`);
    if (a.sourceSha256 && createHash('sha256').update(bytes).digest('hex') !== a.sourceSha256)
      throw Error(`${a.id}: source content differs from pinned supplement hash`);
    let raw;
    if (a.format === 'obj') {
      const obj = new OBJLoader().parse(bytes.toString('utf8'));
      const arrays = [];
      obj.traverse(o => { if(o.isMesh) arrays.push(o.geometry.attributes.position.array); });
      const positions = new Float32Array(arrays.reduce((sum,a)=>sum+a.length,0));
      let offset=0; for(const array of arrays) { positions.set(array,offset); offset+=array.length; }
      raw = new BufferGeometry().setAttribute('position', new BufferAttribute(positions,3));
    } else raw = new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const sourcePositions = raw.attributes.position.array;
    const welded = MeshoptSimplifier.generatePositionRemap(sourcePositions, 3);
    // Remove unused duplicate STL vertices before simplification. Keeping these
    // makes the simplifier treat coincident unused vertices as topological seams.
    const inputMap = new Map(),
      packed = [];
    let indices = new Uint32Array(welded.length);
    for (let k = 0; k < welded.length; k++) {
      const old = welded[k];
      if (!inputMap.has(old)) {
        inputMap.set(old, inputMap.size);
        packed.push(
          sourcePositions[old * 3],
          sourcePositions[old * 3 + 1],
          sourcePositions[old * 3 + 2],
        );
      }
      indices[k] = inputMap.get(old);
    }
    const pos = new Float32Array(packed);
    const original = indices.length / 3;
    const target = Math.min(
      indices.length,
      layer === "skin" ? 135000 : layer === "bone" ? 4500 : 6000,
    );
    const [simple, error] = MeshoptSimplifier.simplify(
      indices,
      pos,
      3,
      target,
      0.003,
      ["Prune"],
    );
    const remap = new Map();
    const compact = [];
    const idx = new Uint32Array(simple.length);
    for (let k = 0; k < simple.length; k++) {
      const old = simple[k];
      if (!remap.has(old)) {
        remap.set(old, remap.size);
        compact.push(
          pos[old * 3] / 1000,
          (pos[old * 3 + 2] + 13.5175) / 1000,
          (-pos[old * 3 + 1] - 96.5107) / 1000,
        );
      }
      idx[k] = remap.get(old);
    }
    const geom = new BufferGeometry();
    geom.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(compact), 3),
    );
    geom.setIndex(new BufferAttribute(idx, 1));
    geom.computeVertexNormals();
    const prim = doc
      .createPrimitive()
      .setAttribute(
        "POSITION",
        doc
          .createAccessor()
          .setType("VEC3")
          .setArray(geom.attributes.position.array)
          .setBuffer(buffer),
      )
      .setAttribute(
        "NORMAL",
        doc
          .createAccessor()
          .setType("VEC3")
          .setArray(geom.attributes.normal.array)
          .setBuffer(buffer),
      )
      .setIndices(
        doc.createAccessor().setType("SCALAR").setArray(idx).setBuffer(buffer),
      );
    const mesh = doc.createMesh(a.id).addPrimitive(prim);
    scene.addChild(
      doc.createNode(a.id).setMesh(mesh).setExtras({ name: a.name, layer }),
    );
    total += idx.length / 3;
    manifest.assets.push({
      ...a,
      sourceUrl: a.sourceUrl || base + a.path,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      originalTriangles: original,
      triangles: idx.length / 3,
      simplificationError: error,
    });
    raw.dispose();
    geom.dispose();
  }
  await new NodeIO().write(`public/models/${layer}.glb`, doc);
  console.log(layer, total, (await fs.stat(`public/models/${layer}.glb`)).size);
}
await fs.writeFile(
  "public/models/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
