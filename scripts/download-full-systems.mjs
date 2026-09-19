import fs from "node:fs/promises";
import { createHash } from "node:crypto";

const commit = "4211d717b0b624604a8bda174ffcae31a76f4581";
const root = `https://raw.githubusercontent.com/Nurkan1/Anatria-3D/${commit}/public/anatomy`;
const expected = {
  nervous_male: "e7a3a2de6c6f098152e3619dd75613531749235cfa9f687d971c8b334a08dcb8",
  cardiovascular_male: "05f373a294ab809b9a628bc1474a66028642997330fddc553a33d4ac6409b757",
};
await fs.mkdir("public/models", { recursive: true });
await fs.mkdir("public/draco", { recursive: true });
for (const [source, sha] of Object.entries(expected)) {
  const response = await fetch(`${root}/${source}.glb`);
  if (!response.ok) throw Error(`${source}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== sha)
    throw Error(`${source}: source hash changed`);
  await fs.writeFile(
    `public/models/${source === "nervous_male" ? "nerve" : "vessel"}-full.glb`,
    bytes,
  );
}
const manifestResponse = await fetch(`${root}/manifest.json`);
if (!manifestResponse.ok) throw Error(`manifest: ${manifestResponse.status}`);
const manifest = await manifestResponse.json();
const systems = { nervous: "nerve", cardiovascular: "vessel" };
const nodes = Object.fromEntries(Object.entries(systems).map(([system, layer]) => [
  layer,
  manifest.organs.filter((item) => item.system === system).map((item) => item.node),
]));
const exactKo = {
  "Abdominal aorta": "복부대동맥", "Ascending aorta": "오름대동맥", "Thoracic aorta": "가슴대동맥", "Aortic arch": "대동맥활",
  "Sciatic nerve": "좌골신경", "Tibial nerve": "경골신경", "Common fibular nerve": "총비골신경", "Median nerve": "정중신경",
  "Ulnar nerve": "척골신경", "Radial nerve": "요골신경", "Femoral nerve": "대퇴신경", "Obturator nerve": "폐쇄신경",
  "Optic nerve": "시신경", "Vagus nerve": "미주신경", "Facial nerve": "안면신경", "Trigeminal nerve": "삼차신경",
  "Spinal cord": "척수", "Cauda equina": "말총", "Corpus callosum": "뇌량", "Hippocampus": "해마", "Cerebellum": "소뇌",
};
const termKo = [[/artery/gi,"동맥"],[/vein/gi,"정맥"],[/nerve/gi,"신경"],[/plexus/gi,"신경얼기"],[/ganglion/gi,"신경절"],[/spinal cord/gi,"척수"],[/brain/gi,"뇌"],[/heart/gi,"심장"],[/left/gi,"왼쪽"],[/right/gi,"오른쪽"]];
const pathKo = {"Central nervous system":"중추신경계","Peripheral nervous system":"말초신경계","Autonomic nervous system":"자율신경계","Systemic arteries":"전신동맥","Systemic veins":"전신정맥","Cardiac vessels":"심장혈관","Arteries of heart":"심장동맥","Veins of heart":"심장정맥","Brain":"뇌","Brainstem":"뇌줄기","Cerebellum":"소뇌","Spinal cord":"척수","Cranial nerves":"뇌신경","Spinal nerves":"척수신경","Upper limb":"상지","Lower limb":"하지","Head and neck":"머리·목","Thorax":"가슴","Abdomen":"배","Pelvis":"골반","Aorta":"대동맥"};
Object.assign(pathKo, {"Brachial plexus":"팔신경얼기","Lumbosacral plexus":"허리엉치신경얼기","Sacral plexus":"엉치신경얼기","Lumbar plexus":"허리신경얼기","Sciatic nerve":"좌골신경","Median nerve":"정중신경","Radial nerve":"요골신경","Ulnar nerve":"척골신경","Femoral nerve":"대퇴신경","Tibial nerve":"경골신경","Common fibular nerve":"총비골신경","Cerebrum":"대뇌","Diencephalon":"사이뇌","Mesencephalon":"중간뇌","Medulla oblongata":"숨뇌","Pons":"다리뇌","Meninges":"뇌척수막","Sense organs":"감각기관","Eye*":"눈","Ear":"귀","Pulmonary vessels":"폐혈관","Pulmonary arteries":"폐동맥","Pulmonary veins":"폐정맥","Heart":"심장","Ventricular system":"뇌실계","Sympathetic trunk":"교감신경줄기"});
function koreanName(item) {
  const side = /\(left\)$/i.test(item.name_en) ? "왼쪽 " : /\(right\)$/i.test(item.name_en) ? "오른쪽 " : "";
  const base = item.name_en.replace(/ \((left|right)\)$/i, "");
  if (exactKo[base]) return side + exactKo[base];
  let translated = base;
  for (const [pattern, value] of termKo) translated = translated.replace(pattern, value);
  return translated === base ? `${base}${side ? ` (${side.trim()})` : ""}` : `${side}${translated}`;
}
function role(item) {
  const n = item.name_en.toLowerCase(), path = item.path.join(" ").toLowerCase();
  if (n.includes("artery") || path.includes("arteries")) return "심장에서 조직 쪽으로 혈액을 보내는 동맥계 가지입니다.";
  if (n.includes("vein") || path.includes("veins")) return "조직에서 심장 쪽으로 혈액을 되돌리는 정맥계 가지입니다.";
  if (n.includes("plexus")) return "여러 신경 섬유가 합쳐지고 갈라지는 신경얼기 범주의 구조입니다.";
  if (n.includes("ganglion")) return "신경세포체가 모인 신경절 범주의 구조입니다.";
  if (n.includes("nerve")) return "중추와 말초 사이의 감각·운동·자율신경 신호 경로에 속하는 신경입니다.";
  if (path.includes("brain")) return "뇌의 해부학적 구획 또는 연결 구조입니다.";
  if (path.includes("spinal")) return "척수 또는 척수에서 이어지는 신경계 구조입니다.";
  return item.system === "cardiovascular" ? "심혈관계의 명명된 구조입니다." : "신경계 또는 감각기관 계통의 명명된 구조입니다.";
}
const catalog = manifest.organs.filter((item) => systems[item.system]).map((item) => {
  const layer = systems[item.system];
  const hierarchy = item.path.map((part) => pathKo[part] || part);
  return {
    id: `ZA_${layer}_${item.organ_id}`,
    node: item.node,
    name: item.name_en,
    label: koreanName(item),
    latin: item.ta2_latin || "",
    layer,
    hierarchy,
    description: `${role(item)} 분류 경로: ${hierarchy.join(" › ")}.`,
    source: "Z-Anatomy / Anatria-3D",
  };
});
await fs.writeFile("data/full-system-nodes.json", JSON.stringify(nodes, null, 2) + "\n");
await fs.writeFile("data/full-system-structures.json", JSON.stringify(catalog, null, 2) + "\n");
for (const name of ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"])
  await fs.copyFile(`node_modules/three/examples/jsm/libs/draco/gltf/${name}`, `public/draco/${name}`);
console.log(`Downloaded whole-body supplements: nerve ${nodes.nerve.length}, vessel ${nodes.vessel.length}; searchable catalog ${catalog.length}`);
