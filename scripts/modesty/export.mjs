// Raw inputs for scripts/modesty/gen.py and check.py: the male skin node
// FMA7163 of public/models/skin.glb (positions, normals, indices as stored),
// the external genital organ meshes of public/models/organ.glb, and the
// triangles of every other drawn male mesh near the groin that the runtime does
// not hide in modesty mode (src/modesty.ts; check.py tests that they stay
// inside the closed skin), all in the scene frame. Written to
// .cache/modesty/in/ with the sha256 of each file read and the context box
// (source.json), so gen.py can tell a stale export from the current models.
// Needs Node 24 or later, which strips the types of the src/modesty.ts import.
//
// Usage: node scripts/modesty/export.mjs
import fs from "node:fs";
import { createHash } from "node:crypto";
import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import draco from "draco3dgltf";
import { isGenitalStructure } from "../../src/modesty.ts";
const OUT = ".cache/modesty/in";
const ORGANS = { FMA18247: "glans penis", FMA19617nsn: "corpus spongiosum", FMA19618: "corpus cavernosum", FMA19667: "urethra", FMA7211: "right testis", FMA7212: "left testis", FMA18256: "right epididymis", FMA18257: "left epididymis", FMA19235: "right deferent duct", FMA19236: "left deferent duct" };
fs.mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });
const write = (name, array) => fs.writeFileSync(`${OUT}/${name}`, Buffer.from(array.buffer, array.byteOffset, array.byteLength));
const world = (node, a) => {
  const m = node.getWorldMatrix(), p = new Float32Array(a.length);
  for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) p[i + k] = m[k] * a[i] + m[4 + k] * a[i + 1] + m[8 + k] * a[i + 2] + m[12 + k];
  return p;
};
const skin = (await io.read("public/models/skin.glb")).getRoot().listNodes().find((n) => n.getName() === "FMA7163");
if (skin.getWorldMatrix().some((v, i) => v !== (i % 5 === 0 ? 1 : 0))) throw new Error("FMA7163 no longer has an identity world matrix");
const prim = skin.getMesh().listPrimitives()[0];
write("skin-pos.f32", new Float32Array(prim.getAttribute("POSITION").getArray()));
write("skin-nrm.f32", new Float32Array(prim.getAttribute("NORMAL").getArray()));
write("skin-idx.u32", new Uint32Array(prim.getIndices().getArray()));
const found = {};
for (const n of (await io.read("public/models/organ.glb")).getRoot().listNodes()) {
  const id = n.getName();
  if (!ORGANS[id] || !n.getMesh()) continue;
  const p = n.getMesh().listPrimitives()[0];
  write(`organ-${id}-pos.f32`, world(n, p.getAttribute("POSITION").getArray()));
  write(`organ-${id}-idx.u32`, new Uint32Array(p.getIndices().getArray()));
  found[id] = ORGANS[id];
}
if (Object.keys(found).length !== Object.keys(ORGANS).length) throw new Error("missing organ meshes: " + Object.keys(ORGANS).filter((k) => !found[k]));
// Context: every triangle of the other drawn meshes with a vertex in BOX (gen.py CONTEXT_BOX), placed as
// src/Atlas.tsx draws them. The base models keep their GLB frame (names from the manifest). The Z-Anatomy
// supplements and the male lymph reference model are scaled and moved by the male registration, and only their
// catalogued nodes are drawn (SupplementModel, ReferenceModel).
const BOX = [[-0.09, 0.66, -0.06], [0.09, 0.86, 0.13]];
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const names = new Map(readJson("public/models/manifest.json").assets.map((a) => [a.id, a.name]));
const registration = readJson("data/catalog/male-registration.json");
const CATALOGUES = ["data/full-system-structures.json", "data/connective-structures.json", "data/sex-lymph-structures.json", "data/catalog/male-registration.json"];
const [full, connective, lymph] = CATALOGUES.map(readJson);
const sanitize = (s) => s.replace(/\s/g, "_").replace(/[\[\]\.:\/]/g, "");   // three's PropertyBinding.sanitizeNodeName
const catalogue = (entries) => new Map(entries.map((e) => [sanitize(e.node), e]));
const CONTEXT = {
  bone: null, muscle: null, organ: null, vessel: null, nerve: null,
  "ligament-full": catalogue(connective.filter((e) => e.model === "ligament-full.glb")),
  "tendon-full": catalogue(connective.filter((e) => e.model === "tendon-full.glb")),
  "vessel-full": catalogue(full.filter((e) => e.layer === "vessel")),
  "nerve-full": catalogue(full.filter((e) => e.layer === "nerve")),
  "reference/lymphatic_male": catalogue(lymph.filter((e) => e.sex === "male" && e.layer === "lymph" && e.model === "lymphatic_male.glb")),
};
const registered = (p) => p.map((v, i) => v * registration.scale + registration.translation[i % 3]);
const near = (...p) => p.every((v, k) => v > BOX[0][k] && v < BOX[1][k]);
const context = [], contextTris = [], contextNames = [];
for (const [glb, entries] of Object.entries(CONTEXT)) {
  for (const n of (await io.read(`public/models/${glb}.glb`)).getRoot().listNodes()) {
    if (!n.getMesh()) continue;
    const entry = entries?.get(sanitize(n.getName()));
    if (entries && !entry) continue;
    const id = entry ? entry.id : n.getName(), name = entry ? entry.name : names.get(id) || id;
    if (isGenitalStructure(id, name)) continue;
    let k = 0;
    for (const prim of n.getMesh().listPrimitives()) {
      const local = world(n, prim.getAttribute("POSITION").getArray()), p = entries ? registered(local) : local;
      const idx = prim.getIndices().getArray(), at = new Map();
      const vid = (i) => { if (!at.has(i)) { at.set(i, context.length / 4); context.push(p[3 * i], p[3 * i + 1], p[3 * i + 2], contextNames.length); } return at.get(i); };
      for (let t = 0; t < idx.length; t += 3) {
        const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
        if ([a, b, c].some((i) => near(p[3 * i], p[3 * i + 1], p[3 * i + 2]))) { contextTris.push(vid(a), vid(b), vid(c)); k++; }
      }
    }
    if (k) contextNames.push(`${glb}:${name}`);
  }
}
write("context.f32", new Float32Array(context));
write("context-idx.u32", new Uint32Array(contextTris));
const sha256 = (f) => createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const sources = [...Object.keys(CONTEXT).map((g) => `public/models/${g}.glb`), "public/models/manifest.json", ...CATALOGUES, "src/modesty.ts", "scripts/modesty/export.mjs"];
fs.writeFileSync(`${OUT}/source.json`, JSON.stringify({ "public/models/skin.glb": sha256("public/models/skin.glb"), "public/models/organ.glb": sha256("public/models/organ.glb"), organs: found, context: contextNames, box: BOX, contextSources: Object.fromEntries(sources.map((f) => [f, sha256(f)])) }, null, 1) + "\n");
console.log("exported FMA7163", prim.getIndices().getCount() / 3, "triangles,", Object.keys(found).length, "organs and", contextTris.length / 3, "context triangles of", contextNames.length, "meshes to", OUT);
