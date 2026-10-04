// Write the female transport models from scripts/female-transport/warp.py.
//
//   public/models/female-transport/{nerve,vessel,muscle,ligament,tendon,lymph,bone}.glb
//     male-derived structures carried into the HRA female body by the fitted
//     registration field (one node per structure, Draco, female metres).
//   public/models/female-transport/borrowed.bin.gz + manifest.json
//     new vertex positions of the 180 borrowed bones, placed by the same field.
//   data/female-transport-structures.json
//     one row per carried structure (male source id, system, peel score,
//     skin tone); src/anatomy.ts builds the FT_ entries from the male catalogue
//     (English names, TA2 Latin, hierarchy, FMA IDs, Korean labels kept).
//
// Usage: node scripts/build-female-transport.mjs
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";

const CACHE = ".cache/female-transport/out", OUT = "public/models/female-transport";
const read = async (p) => JSON.parse(await fs.readFile(p, "utf8"));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const index = await read(`${CACHE}/index.json`);
const transport = await read("data/catalog/female-transport.json");
const fit = await read("data/catalog/female-transport-fit.json");
const labels = await read("data/structure-labels.json");
const inputs = (await read("scripts/model-inputs.json")).assets;
const sources = new Map([
  ...(await read("data/full-system-structures.json")).map((s) => [s.id, s]),
  ...(await read("data/connective-structures.json")).map((s) => [s.id, s]),
  ...(await read("data/sex-lymph-structures.json")).filter((s) => s.sex === "male").map((s) => [s.id, s]),
  ...inputs.filter((a) => a.layer === "muscle" || a.layer === "bone").map((a) => [a.id, { ...a, label: labels[a.id] || a.name, fmaId: a.id.startsWith("FMA") ? a.id : undefined, source: "BodyParts3D 3.0 (DBCLS)" }]),
]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});
// Smooth normals over coincident positions, so split source vertices do not show seams.
function normals(pos, idx) {
  const key = new Map(), group = new Uint32Array(pos.length / 3);
  for (let i = 0; i < group.length; i++) {
    const k = `${Math.round(pos[i * 3] * 1e6)},${Math.round(pos[i * 3 + 1] * 1e6)},${Math.round(pos[i * 3 + 2] * 1e6)}`;
    let g = key.get(k); if (g === undefined) { g = key.size; key.set(k, g); } group[i] = g;
  }
  const acc = new Float64Array(key.size * 3);
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { const g = group[v] * 3; acc[g] += nx; acc[g + 1] += ny; acc[g + 2] += nz; }
  }
  const out = new Float32Array(pos.length);
  for (let i = 0; i < group.length; i++) {
    const g = group[i] * 3, l = Math.hypot(acc[g], acc[g + 1], acc[g + 2]) || 1;
    out[i * 3] = acc[g] / l; out[i * 3 + 1] = acc[g + 1] / l; out[i * 3 + 2] = acc[g + 2] / l;
  }
  return out;
}
await fs.mkdir(OUT, { recursive: true });
const catalogue = [], files = [];
for (const system of ["nerve", "vessel", "muscle", "ligament", "tendon", "lymph", "bone"]) {
  const blob = await fs.readFile(`${CACHE}/${system}.bin`);
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene("female-transport");
  for (const item of index[system]) {
    const id = `FT_${item.id}`;
    const pos = new Float32Array(blob.buffer.slice(blob.byteOffset + item.posOffset, blob.byteOffset + item.posOffset + item.vertexCount * 12));
    const idx = new Uint32Array(blob.buffer.slice(blob.byteOffset + item.idxOffset, blob.byteOffset + item.idxOffset + item.indexCount * 4));
    const prim = doc.createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(pos).setBuffer(buffer))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(normals(pos, idx)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(item.vertexCount < 65536 ? Uint16Array.from(idx) : idx).setBuffer(buffer));
    scene.addChild(doc.createNode(id).setMesh(doc.createMesh(id).addPrimitive(prim)));
    if (!sources.get(item.id)) throw new Error(`No catalogue entry for ${item.id}`);
    // Names, Latin, hierarchy, labels and descriptions stay in the male
    // catalogues; src/anatomy.ts resolves them through \`transport\`.
    catalogue.push({
      transport: item.id, system,
      ...(item.peelScore !== undefined ? { peelScore: item.peelScore } : {}),
      // Within 1 mm of (or through) the male skin in the source: skin-toned while the skin is drawn.
      ...(item.sourceSkinDepthMm <= 1 ? { surfaceTone: true } : {}),
    });
  }
  doc.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({
    method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER, encodeSpeed: 5, decodeSpeed: 5,
    quantizationBits: { POSITION: 16, NORMAL: 10 },
  });
  const bytes = Buffer.from(await io.writeBinary(doc));
  await fs.writeFile(`${OUT}/${system}.glb`, bytes);
  files.push({ system, path: `models/female-transport/${system}.glb`, bytes: bytes.length, sha256: sha(bytes), structures: index[system].length });
  console.log(system, index[system].length, "structures", bytes.length, "bytes");
}
const borrowedRaw = await fs.readFile(`${CACHE}/borrowed.bin`), borrowedGz = gzipSync(borrowedRaw, { level: 9 });
await fs.writeFile(`${OUT}/borrowed.bin.gz`, borrowedGz);
await fs.writeFile(`${OUT}/manifest.json`, JSON.stringify({
  version: 1,
  field: { sha256: fit.field.sha256, report: "data/catalog/female-transport-fit.json" },
  files,
  borrowed: { url: "models/female-transport/borrowed.bin.gz", bytes: borrowedRaw.length, gzipBytes: borrowedGz.length, sha256: sha(borrowedRaw), parts: index.borrowed },
}, null, 1) + "\n");
await fs.writeFile("data/female-transport-structures.json", JSON.stringify(catalogue) + "\n");
console.log("borrowed", index.borrowed.length, "bones", borrowedGz.length, "bytes gz;", catalogue.length, "catalogue entries; selection", JSON.stringify(transport.selection.chosen));
