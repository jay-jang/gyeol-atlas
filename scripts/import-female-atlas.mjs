import fs from "node:fs";
import { createHash } from "node:crypto";
import { limbSkeletonRegion } from "../src/anatomy-region.ts";
import { femaleSpinalLabel } from "./lib/female-spinal-labels.mjs";

const manifest = JSON.parse(fs.readFileSync("public/models/female/atlas-female.json", "utf8"));
const layerForSystem = {
  integumentary: "skin",
  muscular: "muscle",
  "donor-muscle": "muscle",
  skeletal: "bone",
  borrowed: "bone",
  connective: "bone",
  digestive: "organ",
  respiratory: "organ",
  urinary: "organ",
  reproductive: "organ",
  pregnancy: "organ",
  cardiac: "organ",
  arterial: "vessel",
  venous: "vessel",
  lymphatic: "lymph",
  brain: "nerve",
  nervous: "nerve",
  sensory: "nerve",
};
// Membership is taken from source concepts, never from substring guesses
// (e.g. "gastric surface of spleen" is not a stomach).
const definitions = [
  ["brain", "뇌", ["HRA:brain"]], ["heart", "심장", ["HRA:heart"]],
  ["lung", "폐", ["HRA:lungs"]], ["liver", "간", ["HRA:liver"]],
  ["kidney", "콩팥", ["HRA:kidney"]], ["uterus", "자궁", ["HRA:uterus"]],
  ["ovary", "난소", ["HRA:ovary"]], ["breast", "유방", ["HRA:mammary_gland"]],
  ["pancreas", "췌장", ["HRA:pancreas", "HRA:ducts_of_pancreas"]],
  ["spleen", "비장", ["HRA:spleen"]], ["intestine", "장", ["HRA:small_intestine", "HRA:colon"]],
  ["bladder", "방광", ["HRA:urinary_bladder"]],
];
const makeGroups = definitions => definitions.map(([id, name, concepts]) => ({
  id, name, sex: "female", sourceConcepts: concepts,
  ids: [...new Set(concepts.flatMap(id => {
    const concept = manifest.concepts.find(c => c.id === id);
    if (!concept) throw new Error(`Missing source concept ${id}`);
    return concept.elements;
  }))],
}));
const groups = makeGroups(definitions);
const compositeGroups = makeGroups([
  ["femur-left", "왼쪽 대퇴골", ["HRA:femur_L"]],
  ["femur-right", "오른쪽 대퇴골", ["HRA:femur_R"]],
]).map(group => ({...group, sourceSummary: `원본 ${group.ids.length}조각 · 관절연골 포함`, description: `HRA 원본 계층의 대퇴골 본체·무릎 관절연골·부착면 등 ${group.ids.length}개 표면 묶음입니다. 순수 뼈 조직만의 분할이나 폐쇄된 하나의 표면을 뜻하지 않습니다.`}));
const spinalGroup=makeGroups([["spinal-cord", "척수 수록 분절", ["HRA:spinal_cord"]]])[0];
const spinalPart=id=>manifest.parts.find(p=>p.id===id);
spinalGroup.ids.sort((a,b)=>femaleSpinalLabel(spinalPart(a).conceptId).order-femaleSpinalLabel(spinalPart(b).conceptId).order);
compositeGroups.push({...spinalGroup, sourceSummary: "원본 29분절 · 수록 범위·위치 주의",
  description: "HRA 여성 전신 원본의 경수 C1–C8·흉수 T1–T12·요수 L1–L5·천수 S1–S4, 29개 척수 분절입니다. S5·미수 분절과 신경뿌리는 이 묶음에 없습니다. 원본 척추와 표면 교차 7쌍이 남아 있으며 위치 교정이 완료된 모델이 아닙니다. 한국어 명칭은 검색용 편집 표기이며 전문가 미검수입니다."});
const exactLabels = {
  Skin: "여성 전신 피부", "Body of uterus": "자궁몸통", "Fundus of uterus": "자궁바닥",
  Cervix: "자궁목", "Left ovary": "왼쪽 난소", "Right ovary": "오른쪽 난소",
  "Anterior wall of uterus": "자궁 앞벽", "Posterior wall of uterus": "자궁 뒤벽",
  "Femur (left)": "왼쪽 대퇴골 본체", "Femur (right)": "오른쪽 대퇴골 본체",
};
const structures = manifest.parts.map((part) => {
  const layer = layerForSystem[part.system];
  if (!layer) throw new Error(`Unmapped female atlas system: ${part.system}`);
  const group = [...groups, ...compositeGroups].find(group => group.ids.includes(part.id));
  const spinal = group?.id === "spinal-cord" ? femaleSpinalLabel(part.conceptId) : null;
  return {
    id: part.id,
    name: part.name,
    label: spinal?.label || exactLabels[part.name] || part.name,
    layer,
    sex: "female",
    model: "HRA female whole-body atlas",
    bodyRegion: limbSkeletonRegion({ layer, name: part.name }) || (part.bounds[1][1] > 1.42 ? "head" : part.bounds[0][1] < .55 ? "lower-limb" : part.bounds[0][1] < .82 ? "pelvis" : part.bounds[0][1] < 1.08 ? "abdomen" : "chest"),
    hierarchy: [part.system, ...(group ? [group.name, group.id] : [])],
    group: group?.id,
    source: part.system === "brain" ? "HRA · Allen 기반 여성 신체용 참조 뇌" : part.system === "donor-muscle" ? "Andreassen et al. · 여성 기증자 하체 근육" : part.system === "borrowed" ? "BodyParts3D · 남성 유래 보완 골격" : "NIH Human Reference Atlas",
    description: part.system === "brain" ? `${part.name} · Allen 참조 뇌를 여성 신체에 맞춘 세부 구조. 여성 기증자 뇌 스캔이 아닙니다.` : `${part.name} · 여성 참조 아틀라스의 ${part.system} 세부 구조`,
  };
});
fs.writeFileSync("data/female-atlas-structures.json", JSON.stringify(structures, null, 2) + "\n");
fs.writeFileSync("data/female-organ-groups.json", JSON.stringify(groups, null, 2) + "\n");
fs.writeFileSync("data/female-composite-groups.json", JSON.stringify(compositeGroups, null, 2) + "\n");
const files = ["atlas-female.json", ...manifest.chunks.map(chunk => chunk.gzip.split("/").pop())];
fs.writeFileSync("data/catalog/female-atlas-source.json", JSON.stringify({
  repository: "https://github.com/slorksmo/Human-Atlas",
  commit: "5bb5713aab18d7fe9380c3339eb09f173491ea06",
  license: "CC-BY-4.0",
  reference: "Human Reference Atlas female v1.10 + pelvis v1.5",
  femaleParts: 964, femaleDonorMuscles: 76, borrowedMaleBones: 180,
  files: files.map(file => ({ path: `public/models/female/${file}`, sha256: createHash("sha256").update(fs.readFileSync(`public/models/female/${file}`)).digest("hex") })),
}, null, 2) + "\n");
console.log(`Built ${structures.length} female atlas structures.`);
