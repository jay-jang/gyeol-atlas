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
// First stage of `npm run models:male-details`. The 4.3 lung cohort split and
// non-overlapping pancreas views are finalized by import-lung-details.py.
const definitions = [["heart", "심장", ["FMA7088"]], ["liver", "간", ["FMA7197"]],
  ["kidney", "콩팥 · 요관·신장혈관", ["FMA7203", "FMA9704", "FMA14751", "FMA70494", "FMA70485", "FMA70488", "FMA14334"]],
  ["stomach", "위 · 위동맥·위정맥", ["FMA7148", "FMA14768", "FMA14776", "FMA15399", "FMA15400", "FMA14796", "FMA14781", "FMA15390", "FMA15397"]],
  ["pancreas", "췌장", ["FMA7198"]], ["lung", "폐", ["FMA7309", "FMA7310"]]];
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
const layers = { arterial: "vessel", venous: "vessel", cardiac: "organ", digestive: "organ", respiratory: "organ", urinary: "organ", connective: "organ", nervous: "nerve", lymphatic: "lymph", muscular: "muscle" };
const kidneyLabels = {
  FJ3145: "왼쪽 콩팥", FJ3147: "오른쪽 콩팥", FJ3144: "왼쪽 요관", FJ3146: "오른쪽 요관",
  FJ2038: "오른쪽 신장동맥", FJ2046: "왼쪽 신장동맥",
  FJ2042: "오른쪽 신장동맥 위구역가지", FJ2043: "오른쪽 신장동맥 아래구역가지", FJ2045: "오른쪽 신장동맥 뒤구역가지",
  FJ2052: "왼쪽 신장동맥 위구역가지", FJ2049: "왼쪽 신장동맥 아래구역가지",
  FJ2053: "왼쪽 신장동맥 뒤구역가지 · 원본 1", FJ2054: "왼쪽 신장동맥 뒤구역가지 · 원본 2",
  ...Object.fromEntries(Array.from({length:6},(_,i)=>[`FJ${3458+i}`,`왼쪽 신장동맥 앞가지 · 원본 ${i+1}`])),
  ...Object.fromEntries(Array.from({length:6},(_,i)=>[`FJ${3558+i}`,`오른쪽 신장동맥 앞가지 · 원본 ${i+1}`])),
  ...Object.fromEntries(Array.from({length:3},(_,i)=>[`FJ${3473+i}`,`왼쪽 신장동맥 뒤가지 · 원본 ${i+1}`])),
  ...Object.fromEntries(Array.from({length:3},(_,i)=>[`FJ${3573+i}`,`오른쪽 신장동맥 뒤가지 · 원본 ${i+1}`])),
  FJ3477: "왼쪽 신정맥 · 원본 1", FJ3478: "왼쪽 신정맥 · 원본 2",
  FJ3577: "오른쪽 신정맥 · 원본 1", FJ3578: "오른쪽 신정맥 · 원본 2",
};
const stomachLabels = {
  FJ2564: "위", FJ3499: "왼쪽 위동맥", FJ3594: "오른쪽 위동맥",
  FJ3500: "왼쪽 위정맥", FJ3595: "오른쪽 위정맥",
  FJ3501: "왼쪽 위그물막동맥", FJ3596: "오른쪽 위그물막동맥",
  FJ3502: "왼쪽 위그물막정맥", FJ3597: "오른쪽 위그물막정맥",
};
const catalog = packedParts.map(part => {
  const layer = layers[part.system];
  if (!layer) throw Error(`Unknown detail system ${part.system}`);
  const group = groups.find(g => g.ids.includes(part.id));
  const label = group.id === "kidney" ? kidneyLabels[part.id.slice(4)]
    : group.id === "stomach" ? stomachLabels[part.id.slice(4)] : part.name;
  if (!label) throw Error(`Missing editorial detail label ${part.id}`);
  return { id: part.id, name: part.name, label, layer, sex: "male", group: group.id, detailOnly: true,
    fmaId: part.conceptId, hierarchy: [group.name, part.system], source: "BodyParts3D 4.0 · 기관 상세 참조",
    description: group.id === "kidney"
      ? `${part.name} · 같은 BodyParts3D 4.0 좌표계의 콩팥·요관·신장혈관 관련 모형입니다. 한국어 이름은 편집 표기이며 혈관 분절의 연결·콩팥 내부 구조·임상 위치를 검증한 것은 아닙니다.`
      : group.id === "stomach"
      ? `${part.name} · 같은 BodyParts3D 4.0 좌표계의 위와 이름으로 구분된 관련 혈관 모형입니다. 위벽의 독립 분할이나 혈관 연결·관류·전신 3.0 정합을 검증한 것은 아닙니다. 한국어 이름은 편집 표기입니다.`
      : `${group.name}의 ${part.name} · 원본 기관 하위 관계에 포함된 구조입니다.` };
});
await fs.writeFile("data/male-detail-structures.json", JSON.stringify(catalog, null, 2) + "\n");
await fs.writeFile("data/male-detail-groups.json", JSON.stringify(groups, null, 2) + "\n");
const files = await Promise.all(["public/models/male-detail/atlas.json", "public/models/male-detail/organs.bin.gz"].map(async path => ({ path, sha256: createHash("sha256").update(await fs.readFile(path)).digest("hex") })));
await fs.writeFile("data/catalog/male-detail-source.json", JSON.stringify({ commit, license: "CC-BY-4.0", sources, files, structures: catalog.length, bytes: gzip.length }, null, 2) + "\n");
console.log(`Packed ${parts.length} preliminary 4.0 structures; run import-lung-details.py to finalize source views.`);
