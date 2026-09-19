import fs from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
const commit = "5bb5713aab18d7fe9380c3339eb09f173491ea06";
const root = `https://raw.githubusercontent.com/slorksmo/Human-Atlas/${commit}/public/models/`;
const cache = ".cache/male-details";
await fs.mkdir(cache, { recursive: true });
await fs.mkdir("public/models/male-detail", { recursive: true });
async function get(file) {
  try { return await fs.readFile(`${cache}/${file}`); } catch {}
  const response = await fetch(root + file);
  if (!response.ok) throw Error(`${file}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(`${cache}/${file}`, bytes);
  return bytes;
}
const manifestBytes = await get("atlas.json");
const manifest = JSON.parse(manifestBytes.toString());
const definitions = [["heart", "심장", ["FMA7088"]], ["liver", "간", ["FMA7197"]], ["lung", "폐", ["FMA7309", "FMA7310"]]];
const groups = definitions.map(([id, name, sourceConcepts]) => ({
  id, name, sex: "male", sourceConcepts,
  ids: [...new Set(sourceConcepts.flatMap(id => {
    const concept = manifest.concepts.find(c => c.id === id);
    if (!concept) throw Error(`Missing male concept ${id}`);
    return concept.elements.map(id => `BP4_${id}`);
  }))],
}));
const ids = new Set(groups.flatMap(g => g.ids));
const parts = manifest.parts.filter(part => ids.has(`BP4_${part.id}`));
const buffers = new Map();
const sources = [{ url: root + "atlas.json", sha256: createHash("sha256").update(manifestBytes).digest("hex") }];
for (const chunkIndex of new Set(parts.map(p => p.chunk))) {
  const chunk = manifest.chunks[chunkIndex];
  const file = chunk.gzip.split("/").pop();
  const zipped = await get(file);
  const bytes = gunzipSync(zipped);
  if (bytes.length !== chunk.bytes) throw Error(`Invalid chunk ${file}`);
  buffers.set(chunkIndex, bytes);
  sources.push({ url: root + file, sha256: createHash("sha256").update(zipped).digest("hex") });
}
let cursor = 0;
const segments = [];
function append(bytes) {
  const start = cursor;
  segments.push(bytes); cursor += bytes.length;
  const padding = (4 - cursor % 4) % 4;
  if (padding) { segments.push(Buffer.alloc(padding)); cursor += padding; }
  return start;
}
const packedParts = parts.map(part => {
  const bytes = buffers.get(part.chunk);
  return { ...part, id: `BP4_${part.id}`, chunk: 0,
    positions: append(bytes.subarray(part.positions, part.positions + part.vertexCount * 12)),
    normals: append(bytes.subarray(part.normals, part.normals + part.vertexCount * 6)),
    indices: append(bytes.subarray(part.indices, part.indices + part.indexCount * 4)),
  };
});
const binary = Buffer.concat(segments), gzip = gzipSync(binary, { level: 9 });
await fs.writeFile("public/models/male-detail/organs.bin.gz", gzip);
const atlas = { version: manifest.version, sex: "male", parts: packedParts, chunks: [{ url: "/models/male-detail/organs.bin", gzip: "/models/male-detail/organs.bin.gz", bytes: binary.length, gzipBytes: gzip.length }] };
await fs.writeFile("public/models/male-detail/atlas.json", JSON.stringify(atlas) + "\n");
const layers = { arterial: "vessel", venous: "vessel", cardiac: "organ", digestive: "organ", respiratory: "organ", connective: "organ", nervous: "nerve", lymphatic: "lymph", muscular: "muscle" };
const catalog = packedParts.map(part => {
  const layer = layers[part.system];
  if (!layer) throw Error(`Unknown detail system ${part.system}`);
  const group = groups.find(g => g.ids.includes(part.id));
  return { id: part.id, name: part.name, label: part.name, layer, sex: "male", group: group.id, detailOnly: true,
    fmaId: part.conceptId, hierarchy: [group.name, part.system], source: "BodyParts3D 4.0 · 기관 상세 참조",
    description: `${group.name}의 ${part.name} · 원본 기관 하위 관계에 포함된 구조입니다.` };
});
await fs.writeFile("data/male-detail-structures.json", JSON.stringify(catalog, null, 2) + "\n");
await fs.writeFile("data/male-detail-groups.json", JSON.stringify(groups, null, 2) + "\n");
const files = await Promise.all(["public/models/male-detail/atlas.json", "public/models/male-detail/organs.bin.gz"].map(async path => ({ path, sha256: createHash("sha256").update(await fs.readFile(path)).digest("hex") })));
await fs.writeFile("data/catalog/male-detail-source.json", JSON.stringify({ commit, license: "CC-BY-4.0", sources, files, structures: catalog.length, bytes: gzip.length }, null, 2) + "\n");
console.log(`Packed ${parts.length} male detail structures: ${gzip.length} bytes.`);
