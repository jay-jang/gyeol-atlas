import fs from "node:fs/promises";
import { createHash } from "node:crypto";

const commit = "4211d717b0b624604a8bda174ffcae31a76f4581";
const root = `https://raw.githubusercontent.com/Nurkan1/Anatria-3D/${commit}/public/anatomy`;
const assets = {
  lymphatic_male: "b73830220fb9d67cbf9f30ebc448c88483c1b3bd1c014f49eb10aefa70dfbfbd",
  cardiovascular_female: "271dac2d304aca7ee9dd9a4d115010fb51d5cba2ddae5bf01748288803cec3eb",
  digestive_female: "88e0ab9481101fcf492a8573a54599159c5b700565ad5817726219660aad2800",
  integumentary_female: "f419dd4df08bb461422040f5e6ae39343108de68b94b32271a05967f0af1bb22",
  lymphatic_female: "fce4af6751324a1985c36970131d10cb78217173e253cd9ffdca4f9c6f389b3f",
  renal_female: "8e233626a0316ffa2e4131fe1d997724ca0c95c7856d9cc8686f4c55050afb80",
  reproductive_female: "894d3319a995a7238978ec1f4044ec6a6b5b3176d43c2d5ec51a9d5df01f9d37",
  skeletal_female: "be7a2d4866a9fe96a6870ed4e70faafaff963c4c2954891ff73002575c1b9747",
};
await fs.mkdir("public/models/reference", { recursive: true });
for (const [name, sha] of Object.entries(assets)) {
  const response = await fetch(`${root}/${name}.glb`);
  if (!response.ok) throw Error(`${name}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== sha)
    throw Error(`${name}: source hash changed`);
  await fs.writeFile(`public/models/reference/${name}.glb`, bytes);
}
const [male, female] = await Promise.all(["manifest.json", "manifest_female.json"].map(async (name) => {
  const response = await fetch(`${root}/${name}`);
  if (!response.ok) throw Error(`${name}: ${response.status}`);
  return response.json();
}));
const femaleLayers = {
  cardiovascular: "vessel", digestive: "organ", integumentary: "skin",
  lymphatic: "lymph", renal: "organ", reproductive: "organ", skeletal: "bone",
};
const exactKo = {
  Spleen: "비장", Thymus: "흉선", "Thoracic duct": "흉관", "Cisterna chyli": "유미조",
  "Bone marrow": "골수", "Lymph node": "림프절", "Lymphatic vessel": "림프관",
  Uterus: "자궁", Vagina: "질", Ovary: "난소", "Uterine tube": "자궁관",
  "Mammary gland": "유선", Breast: "유방", Kidney: "콩팥", Bladder: "방광",
  Liver: "간", Stomach: "위", Pancreas: "췌장", Heart: "심장",
};
const terms = [[/lymphatic vessels?/gi,"림프관"],[/lymph nodes?/gi,"림프절"],[/nodes?/gi,"림프절"],[/thymus/gi,"흉선"],[/spleen/gi,"비장"],[/artery/gi,"동맥"],[/vein/gi,"정맥"],[/left/gi,"왼쪽"],[/right/gi,"오른쪽"]];
function label(item) {
  const side = /\(left\)$/i.test(item.name_en) ? "왼쪽 " : /\(right\)$/i.test(item.name_en) ? "오른쪽 " : "";
  const base = item.name_en.replace(/ \((left|right)\)$/i, "");
  if (exactKo[base]) return side + exactKo[base];
  let value = base;
  for (const [pattern, replacement] of terms) value = value.replace(pattern, replacement);
  return value === base ? `${base}${side ? ` (${side.trim()})` : ""}` : side + value;
}
function bodyRegion(item) {
  const text = `${item.name_en} ${(item.path || []).join(" ")}`.toLowerCase();
  if (/upper limb|arm|brachial|axillar|cubital|forearm|hand|wrist/.test(text)) return "upper-limb";
  if (/lower limb|leg|femoral|inguinal|popliteal|tibial|foot|ankle/.test(text)) return "lower-limb";
  if (item.system === "reproductive") return "pelvis";
  if (item.system === "digestive") return /rect|anal/.test(text) ? "pelvis" : "abdomen";
  if (item.system === "renal") return /bladder|urethr|ureteric orifice/.test(text) ? "pelvis" : "abdomen";
  if (/neck|cervical/.test(text)) return "neck";
  if (/cranial|facial|skull|brain|eye|ear|parotid|submental/.test(text)) return "head";
  if (/thorax|thoracic|chest|mediastin|heart|lung/.test(text)) return "chest";
  if (/pelvi|uter|ovar|vagin|bladder|rect|prostat/.test(text)) return "pelvis";
  if (/abdomen|abdominal|gastric|liver|spleen|pancrea|kidney|renal|intestinal/.test(text)) return "abdomen";
  return "whole";
}
function description(item, sex) {
  const path = (item.path || []).join(" › ");
  const scope = item.system === "lymphatic"
    ? "림프액의 이동·여과와 면역 반응에 관여하는 림프계 구조입니다."
    : `${item.system} 계통의 ${sex === "female" ? "여성" : "남성"} 참조 구조입니다.`;
  return `${scope}${path ? ` 원본 분류: ${path}.` : ""}`;
}
const records = [
  ...male.organs.filter((item) => item.system === "lymphatic").map((item) => ({ item, sex: "male", layer: "lymph" })),
  ...female.organs.filter((item) => femaleLayers[item.system]).map((item) => ({ item, sex: "female", layer: femaleLayers[item.system] })),
].map(({ item, sex, layer }) => ({
  id: `${sex === "male" ? "ZA" : "HRA_F"}_${layer}_${item.organ_id}`,
  node: item.node,
  model: `${item.system}_${sex}.glb`,
  name: item.name_en,
  label: label(item),
  latin: item.ta2_latin || "",
  layer,
  sex,
  bodyRegion: bodyRegion(item),
  hierarchy: item.path || [],
  description: description(item, sex),
  source: sex === "female" ? "NIH Human Reference Atlas / Visible Human Female" : "Z-Anatomy / Anatria-3D",
}));
await fs.writeFile("data/sex-lymph-structures.json", JSON.stringify(records, null, 2) + "\n");
await fs.writeFile("data/catalog/sex-lymph-models.json", JSON.stringify({
  sourceRepository: "https://github.com/Nurkan1/Anatria-3D",
  sourceCommit: commit,
  assets: Object.entries(assets).map(([name, sha256]) => ({ path: `public/models/reference/${name}.glb`, sourceUrl: `${root}/${name}.glb`, sha256 })),
  femaleAttribution: female.attribution,
  femaleLicense: female.license,
}, null, 2) + "\n");
console.log(`Downloaded ${Object.keys(assets).length} reference models; cataloged ${records.filter(x => x.sex === "male").length} male lymph and ${records.filter(x => x.sex === "female").length} female structures.`);
