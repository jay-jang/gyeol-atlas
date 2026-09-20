import fs from "node:fs/promises";
import { createHash } from "node:crypto";

const input = process.argv[2] || ".cache/female-ct/s0255";
const sourceInput = process.argv[3] || input;
const candidate = JSON.parse(await fs.readFile(`${input}/candidate.json`, "utf8"));
if (candidate.source.subject.image_id !== "s0255" || candidate.source.subject.gender !== "f" || candidate.source.license !== "CC-BY-4.0") throw Error("Unexpected source");
if (candidate.alignment.acceptedForOverlay !== false) throw Error("CT must remain source-isolated");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const sourceDir = "data/female-ct/s0255";
const modelDir = "public/models/female-detail";
await fs.mkdir(sourceDir, { recursive: true });
await fs.mkdir(modelDir, { recursive: true });
const sourceFiles = [];
for (const file of candidate.source.files) {
  const data = await fs.readFile(`${sourceInput}/${file.mask}.nii.gz`);
  if (sha(data) !== file.sha256) throw Error(`Source hash mismatch: ${file.mask}`);
  const path = `${sourceDir}/${file.mask}.nii.gz`;
  await fs.writeFile(path, data);
  sourceFiles.push({ ...file, path });
}
await fs.writeFile(`${sourceDir}/source.json`, JSON.stringify(candidate.source, null, 2) + "\n");
await fs.copyFile(`${input}/ct-supplement.bin.gz`, `${modelDir}/ct-supplement.bin.gz`);
const atlas = { sex: "female", version: "TotalSegmentator 2.0.1 / s0255", parts: candidate.parts, chunks: candidate.chunks,
  coordinatePolicy: candidate.coordinatePolicy, stageTranslationMeters: candidate.stageTranslationMeters };
await fs.writeFile(`${modelDir}/atlas.json`, JSON.stringify(atlas) + "\n");
const definitions = [
  ["stomach-ct", "위 (여성 CT)", ["stomach"]],
  ["adrenal-ct", "부신 (여성 CT)", ["adrenal_gland_left", "adrenal_gland_right"]],
  ["esophagus-ct", "식도 (CT 수록 구간)", ["esophagus"]],
  ["back-muscles-ct", "등 근육군 (CT 수록 구간)", ["autochthon_left", "autochthon_right"]],
  ["abdomen-ct", "여성 CT 주변 기관", candidate.parts.map(p => p.sourceMask)],
];
const groups = definitions.map(([id, name, masks]) => ({ id, name, sex: "female", sourceConcepts: masks.map(mask => `CTF:${mask}`), ids: masks.map(mask => `CTF_${mask}`) }));
const catalog = candidate.parts.map(part => {
  const partial = part.scanBoundary.some(Boolean);
  if (!partial && !part.voxels) throw Error(`Empty mask: ${part.id}`);
  const group = groups.find(g => g.ids.includes(part.id));
  return { id: part.id, name: part.name, label: `${part.label}${partial ? "" : " (여성 CT)"}`,
    layer: part.system === "muscular" ? "muscle" : part.system === "lymphatic" ? "lymph" : "organ",
    sex: "female", group: group.id, detailOnly: true, bodyRegion: "abdomen", model: "TotalSegmentator female CT s0255",
    hierarchy: ["여성 CT 보완 상세", group.name, part.sourceMask],
    source: "Jakob Wasserthal · 바젤대학병원 · TotalSegmentator 2.0.1 · CC BY 4.0",
    description: `${part.label}. 별도 여성 CT의 공개 분할 마스크를 표면 모형으로 변환했습니다. HRA 전신과 다른 사람의 자료이며 전신에 겹치지 않습니다. ${partial ? "촬영 경계에서 잘린 부분 자료로, 전체 길이나 개별 근육의 완전한 모형이 아닙니다." : "기관 전체 외형의 단일 분할이며 내부 세부 구획은 없습니다."} 진단·시술용이 아닙니다.` };
});
await fs.writeFile("data/female-detail-structures.json", JSON.stringify(catalog, null, 2) + "\n");
await fs.writeFile("data/female-detail-groups.json", JSON.stringify(groups, null, 2) + "\n");
const files = await Promise.all(["atlas.json", "ct-supplement.bin.gz"].map(async file => {
  const path = `${modelDir}/${file}`; return { path, sha256: sha(await fs.readFile(path)) };
}));
await fs.writeFile("data/catalog/female-detail-source.json", JSON.stringify({ ...candidate.source, files: sourceFiles,
  outputFiles: files, rejectedAlignment: candidate.alignment, coordinatePolicy: candidate.coordinatePolicy,
  stageTranslationMeters: candidate.stageTranslationMeters, structures: catalog.length, gzipBytes: candidate.chunks[0].gzipBytes,
}, null, 2) + "\n");
console.log(`Imported ${catalog.length} female CT detail structures (${candidate.chunks[0].gzipBytes} gzip bytes), separate from HRA.`);
