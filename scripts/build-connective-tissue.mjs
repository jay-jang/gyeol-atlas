// Ligaments, joint structures and separately modelled tendons for the male
// reference, from the same pinned Anatria-3D (Z-Anatomy) export as the whole-body
// vessel/nerve supplements. Existing base meshes of the same structures are kept
// and tagged instead of being duplicated. Korean names are editorial.
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";

const commit = "4211d717b0b624604a8bda174ffcae31a76f4581";
const root = `https://raw.githubusercontent.com/Nurkan1/Anatria-3D/${commit}/public/anatomy`;
const pinned = {
  "manifest.json": "628983219020d9b9b0f14dfbc394c29952cab974fd18871469f6776917755662",
  "articular_male.glb": "894533f99658c1428dce59e5225f6b1099aaf4720b3cdd7b39ac76cfbb0aec98",
  "muscular_male.glb": "53a004c7b8af38fcbb88d5d1a7ab9dc3f6db2f5bb52188d81c5ddbfb4fb30243",
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cache = ".cache/anatria-3d";
await fs.mkdir(cache, { recursive: true });
async function source(name) {
  const path = `${cache}/${name}`;
  let bytes = await fs.readFile(path).catch(() => null);
  if (!bytes || sha(bytes) !== pinned[name]) {
    const response = await fetch(`${root}/${name}`);
    if (!response.ok) throw Error(`${name}: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (sha(bytes) !== pinned[name]) throw Error(`${name}: source hash changed`);
    await fs.writeFile(path, bytes);
  }
  return bytes;
}
const manifest = JSON.parse(await source("manifest.json"));
const articularBytes = await source("articular_male.glb");
const muscularBytes = await source("muscular_male.glb");

const baseName = (name) => name.replace(/ \((left|right)\)$/i, "");
const sideOf = (name) => /\(left\)$/i.test(name) ? "left" : /\(right\)$/i.test(name) ? "right" : "";
// Same structure already in the base BodyParts3D model: keep that mesh.
const baseDuplicates = new Set(["Calcaneal tendon", "Intermediate tendon of digastric muscle", "Epicranial aponeurosis",
  "Iliotibial tract", "Inguinal ligament", "Flexor retinaculum of wrist", "Long plantar ligament",
  "Interosseous membrane of forearm", "Interosseous membrane of leg"]);
const articular = manifest.organs.filter((o) => o.system === "articular");
// Vertebral ligaments are listed under the skeletal system but exported in the
// articular file too; intervertebral discs are already base meshes.
const spinal = manifest.organs.filter((o) => o.system === "skeletal" && o.path.join("/") === "Vertebral column"
  && /ligament|ligamenta/i.test(o.name_en));
// Attachment-site patches ("Muscular insertions"), bursae and intermuscular
// septa are not tendons or ligaments.
const tendons = manifest.organs.filter((o) => o.system === "muscular" && o.path[0] !== "Muscular insertions"
  && !/bursa|septum/i.test(o.name_en) && (o.path[0] === "Tendon sheaths" || /tendon|aponeuros|retinacul|ligament/i.test(o.name_en)));
const excluded = [...articular, ...spinal, ...tendons].filter((o) => baseDuplicates.has(baseName(o.name_en)));
const ligamentItems = [...articular, ...spinal].filter((o) => !excluded.includes(o));
const tendonItems = tendons.filter((o) => !excluded.includes(o));

function kindOf(name) {
  const n = name.toLowerCase();
  if (/sheath/.test(n)) return "sheath";
  if (/aponeurosis/.test(n)) return "aponeurosis";
  if (/retinaculum/.test(n)) return "retinaculum";
  if (/^tendon of|tendon$/.test(n)) return "tendon";
  if (/capsule/.test(n)) return "capsule";
  if (/ligament|ligamenta|oblique cord|zona orbicularis/.test(n)) return "ligament";
  if (/disc/.test(n)) return "disc";
  if (/labrum/.test(n)) return "labrum";
  if (/meniscus/.test(n)) return "meniscus";
  if (/membrane/.test(n)) return "membrane";
  if (/cartilage/.test(n)) return "cartilage";
  if (/fat pad/.test(n)) return "fatpad";
  if (/symphysis/.test(n)) return "symphysis";
  if (/tract/.test(n)) return "tract";
  throw Error(`No tissue kind for ${name}`);
}
const kindText = {
  ligament: "뼈와 뼈를 잇는 치밀결합조직 인대입니다.",
  capsule: "관절을 감싸는 섬유성 관절주머니입니다.",
  meniscus: "무릎관절 안의 반달 모양 섬유연골입니다.",
  disc: "관절 안에서 두 뼈 사이에 끼인 섬유연골 관절원반입니다.",
  labrum: "관절오목 가장자리를 두르는 섬유연골 테두리입니다.",
  membrane: "뼈나 연골 사이에 펼쳐진 섬유성 막입니다.",
  cartilage: "관절 부위의 연골 구조입니다.",
  fatpad: "관절 주위의 지방체입니다. 인대가 아니라 원본 관절계에 함께 수록된 구조입니다.",
  symphysis: "두 뼈를 섬유연골로 잇는 결합입니다.",
  tendon: "근육을 뼈에 잇는 힘줄입니다. 원본에서 근육과 따로 모델링된 부분만 표시합니다.",
  aponeurosis: "넓게 펼쳐진 널힘줄(건막)입니다.",
  retinaculum: "힘줄을 제자리에 붙잡는 띠 모양 근막(지지띠)입니다.",
  sheath: "힘줄을 감싸는 윤활 힘줄집입니다. 힘줄 자체가 아니라 힘줄이 지나는 길을 보여 줍니다.",
  tract: "넓적다리 가쪽을 따라 내려가는 두꺼운 근막띠입니다.",
};
const ko = new Map((await fs.readFile("data/catalog/connective-ko.tsv", "utf8")).trim().split("\n").map((line) => line.split("\t")));
const pathKo = {
  "Joints": "관절", "Joints of lower limb": "다리 관절", "Joints of free lower limb": "자유다리 관절", "Joints of upper limb": "팔 관절",
  "Joints of free upper limb": "자유팔 관절", "Joints of pectoral girdle": "팔이음뼈 관절", "Joints of pelvic girdle": "다리이음뼈 관절",
  "Joints of skull": "머리뼈 관절", "Joints of vertebral column": "척주 관절", "Joints of foot": "발 관절", "Joints of hand": "손 관절",
  "Thoracic joints": "가슴 관절", "Laryngeal joints": "후두 관절", "Vertebral column": "척주",
  "Synovial joints of free lower limb": "자유다리 윤활관절", "Synovial joints of free upper limb": "자유팔 윤활관절",
  "Synovial joints of pectoral girdle": "팔이음뼈 윤활관절", "Synovial joints of pelvic girdle": "다리이음뼈 윤활관절",
  "Synovial joints of thorax": "가슴 윤활관절", "Synovial joints of larynx": "후두 윤활관절", "Cranial synovial joints": "머리뼈 윤활관절",
  "Fibrous joints of free lower limb": "자유다리 섬유관절", "Fibrous joints of free upper limb": "자유팔 섬유관절",
  "Fibrous joints of pectoral girdle": "팔이음뼈 섬유관절", "Fibrous joints of pelvic girdle": "다리이음뼈 섬유관절",
  "Fibrous joints of thorax": "가슴 섬유관절", "Fibrous joints of vertebral column": "척주 섬유관절", "Fibrous joints of larynx": "후두 섬유관절",
  "Cranial fibrous joints": "머리뼈 섬유관절", "Cranial syndesmosis": "머리뼈 인대결합", "Cartilaginous joints of pelvic girdle": "다리이음뼈 연골관절",
  "Radio-ulnar syndesmoses": "노자 인대결합", "Tibiofibular syndesmosis": "정강종아리 인대결합",
  "Acromioclavicular joint": "봉우리빗장관절", "Sternoclavicular joint": "복장빗장관절", "Glenohumeral joint": "오목위팔관절(어깨관절)",
  "Elbow joint": "팔꿉관절", "Distal radio-ulnar joint": "먼쪽노자관절", "Radiocarpal joint": "노손목관절", "Intercarpal joints": "손목뼈사이관절",
  "Pisiform joint": "콩알뼈관절", "Carpometacarpal joints": "손목손허리관절", "Intermetacarpal joints": "손허리뼈사이관절",
  "Metacarpophalangeal joints": "손허리손가락관절", "Interphalangeal joints of hand": "손가락뼈사이관절",
  "Hip joint": "엉덩관절", "Knee joint": "무릎관절", "Superior tibiofibular joint": "위정강종아리관절", "Ankle joint": "발목관절",
  "Subtalar joint": "목말밑관절", "Talocalcaneonavicular joint": "목말발꿈치발배관절", "Transverse tarsal joint": "가로발목뼈관절",
  "Calcaneocuboid joint": "발꿈치입방관절", "Cuboidonavicular joint": "입방발배관절", "Cuneonavicular joint": "쐐기발배관절",
  "Cuneocuboid joint": "쐐기입방관절", "Intercuneiform joints": "쐐기뼈사이관절", "Intertarsal joints": "발목뼈사이관절",
  "Tarsometatarsal joints": "발목발허리관절", "Intermetatarsal joints": "발허리뼈사이관절", "Metatarsophalangeal joints": "발허리발가락관절",
  "Interphalangeal joints of foot": "발가락뼈사이관절", "Sacro-iliac joint": "엉치엉덩관절", "Pubic symphysis": "두덩결합",
  "Temporomandibular joint": "턱관절", "Costovertebral joints": "갈비척추관절", "Costotransverse joint": "갈비가로돌기관절",
  "Crico-arythenoid joint": "반지모뿔관절", "Thyrohyoid membrane": "방패목뿔막", "Fibro-elastic membrane of larynx": "후두 섬유탄력막",
  "Quadrangular membrane": "네모막", "Obturator membrane": "폐쇄막", "Glenohumeral ligaments": "오목위팔인대",
  "Coracoclavicular ligament": "부리빗장인대", "Iliofemoral ligament": "엉덩넙다리인대", "Sacrotuberous ligament": "엉치결절인대",
  "Bifurcate ligament": "두갈래인대", "Tibial collateral ligament": "정강쪽곁인대", "Medial collateral ligament": "안쪽곁인대",
  "Lateral collateral ligament": "가쪽곁인대", "Lateral meniscus": "가쪽반달", "Medial meniscus": "안쪽반달",
  "Dorsal intercarpal ligaments": "등쪽손목뼈사이인대", "Palmar intercarpal ligaments": "손바닥쪽손목뼈사이인대",
  "Interosseus intercarpal ligaments": "뼈사이 손목뼈사이인대", "Palmar radiocarpal ligament": "손바닥쪽노손목인대",
  "Palmar ulnocarpal ligament": "손바닥쪽자손목인대",
  "Tendon sheaths": "힘줄집", "Fascia": "근막", "Fascia of upper limb": "팔 근막", "Muscular system of lower limb": "다리 근육계",
  "Muscular system of upper limb": "팔 근육계", "Muscles of lower limb": "다리 근육", "Muscles of abdomen": "배 근육", "Muscles of head": "머리 근육",
  "Muscles of neck": "목 근육", "Abdominal part of muscular system": "근육계 배 부분", "Cervical part of muscular system": "근육계 목 부분",
  "Cranial part of muscular system": "근육계 머리 부분", "Anterior compartment of leg": "종아리 앞칸", "Anterior compartment of thigh": "넓적다리 앞칸",
  "Posterior compartment of leg": "종아리 뒤칸",
};
function entry(item, model) {
  const base = baseName(item.name_en), side = sideOf(item.name_en);
  const label = ko.get(base);
  if (!label) throw Error(`No Korean name for ${base}`);
  const kind = kindOf(base);
  const hierarchy = item.path.map((part) => pathKo[part] || part);
  return {
    id: `ZA_${model === "ligament-full.glb" ? "ligament" : "tendon"}_${item.organ_id}`,
    node: item.node,
    name: item.name_en,
    label: `${side === "left" ? "왼쪽 " : side === "right" ? "오른쪽 " : ""}${label}`,
    latin: item.ta2_latin || "",
    // Layer follows the source system: joint structures peel with the skeleton,
    // muscular-system bands (including its ligaments) with the muscles.
    layer: model === "ligament-full.glb" ? "bone" : "muscle",
    kind,
    model,
    hierarchy,
    description: `${kindText[kind]} 분류 경로: ${hierarchy.join(" › ")}.`,
    source: "Z-Anatomy / Anatria-3D",
  };
}
const catalog = [...ligamentItems.map((o) => entry(o, "ligament-full.glb")), ...tendonItems.map((o) => entry(o, "tendon-full.glb"))];
if (new Set(catalog.map((e) => e.id)).size !== catalog.length) throw Error("Duplicate connective ids");

// The articular export is used unchanged. The muscular export is 12MB, so only
// the selected tendon nodes are written to a smaller file.
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "draco3d.encoder": await draco3d.createEncoderModule(),
});
const articularDoc = await io.readBinary(new Uint8Array(articularBytes));
const articularNames = new Set(articularDoc.getRoot().listNodes().map((n) => n.getName()));
for (const item of ligamentItems) if (!articularNames.has(item.node)) throw Error(`Missing articular node ${item.node}`);
const bounds = (doc, names) => {
  const out = new Map();
  for (const node of doc.getRoot().listNodes()) {
    if (!names.has(node.getName())) continue;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], v = [0, 0, 0];
    for (const primitive of node.getMesh().listPrimitives()) {
      const position = primitive.getAttribute("POSITION");
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, v);
        for (let axis = 0; axis < 3; axis++) { min[axis] = Math.min(min[axis], v[axis]); max[axis] = Math.max(max[axis], v[axis]); }
      }
    }
    out.set(node.getName(), [min, max]);
  }
  return out;
};
const tendonNodes = new Set(tendonItems.map((o) => o.node));
const muscularDoc = await io.readBinary(new Uint8Array(muscularBytes));
const before = bounds(muscularDoc, tendonNodes);
if (before.size !== tendonNodes.size) throw Error("Missing tendon nodes in the muscular export");
for (const node of muscularDoc.getRoot().listNodes()) {
  if (node.listChildren().length) throw Error("Unexpected nested node in the muscular export");
  if (!tendonNodes.has(node.getName())) node.dispose();
}
for (const mesh of muscularDoc.getRoot().listMeshes()) if (!mesh.listParents().some((p) => p.propertyType === "Node")) {
  for (const primitive of mesh.listPrimitives()) primitive.dispose();
  mesh.dispose();
}
for (const accessor of muscularDoc.getRoot().listAccessors()) if (accessor.listParents().length <= 1) accessor.dispose();
muscularDoc.getRoot().listExtensionsUsed().find((e) => e.extensionName === KHRDracoMeshCompression.EXTENSION_NAME)
  .setRequired(true).setEncoderOptions({ method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER, encodeSpeed: 5, decodeSpeed: 5,
    quantizationBits: { POSITION: 16, NORMAL: 12, TEX_COORD: 12, COLOR: 8, GENERIC: 12 } });
const tendonBytes = Buffer.from(await io.writeBinary(muscularDoc));
const after = bounds(await io.readBinary(new Uint8Array(tendonBytes)), tendonNodes);
if (after.size !== tendonNodes.size) throw Error("Tendon subset lost nodes");
let reencodeError = 0;
for (const [name, [min, max]] of before) for (let axis = 0; axis < 3; axis++)
  reencodeError = Math.max(reencodeError, Math.abs(min[axis] - after.get(name)[0][axis]), Math.abs(max[axis] - after.get(name)[1][axis]));
if (reencodeError > 1e-4) throw Error(`Tendon subset moved geometry by ${reencodeError} m`);

// Existing base meshes of the same tissue kinds, tagged for display only.
const inputs = JSON.parse(await fs.readFile("scripts/model-inputs.json", "utf8")).assets;
const female = JSON.parse(await fs.readFile("data/female-atlas-structures.json", "utf8"));
const maleTags = Object.fromEntries(inputs.filter((s) => (s.layer === "muscle" || s.layer === "bone")
  && /ligament|tendon|retinaculum|aponeurosis|iliotibial tract|interosseous membrane/i.test(s.name))
  .map((s) => [s.id, /iliotibial tract/i.test(s.name) ? "tract" : /interosseous membrane/i.test(s.name) ? "membrane" : kindOf(s.name.replace(/^(right|left) /i, "").replace(/ of (right|left) /i, " of "))]));
// HRA "connective" also holds discs, entheses (attachment sites) and cartilage
// surfaces; as in the male reference, only ligaments, menisci and tendons.
const femaleTags = Object.fromEntries(female.filter((s) => s.model === "HRA female whole-body atlas"
  && ((s.layer === "bone" && s.hierarchy[0] === "connective" && /ligament|meniscus/i.test(s.name)) || (s.layer === "muscle" && /tendon/i.test(s.name))))
  .map((s) => [s.id, kindOf(s.name.replace(/ \((left|right)\)$/i, "").replace(/^(right|left) /i, ""))]));
if (Object.keys(maleTags).length !== 17 || Object.keys(femaleTags).length !== 16)
  throw Error(`Unexpected base tags: male ${Object.keys(maleTags).length}, female ${Object.keys(femaleTags).length}`);

await fs.writeFile("public/models/ligament-full.glb", articularBytes);
await fs.writeFile("public/models/tendon-full.glb", tendonBytes);
await fs.writeFile("data/connective-structures.json", JSON.stringify(catalog, null, 2) + "\n");
await fs.writeFile("data/connective-tags.json", JSON.stringify({ male: maleTags, female: femaleTags }, null, 2) + "\n");
const count = (items, key) => items.reduce((acc, item) => ({ ...acc, [item[key]]: (acc[item[key]] || 0) + 1 }), {});
await fs.writeFile("data/catalog/connective-supplement.json", JSON.stringify({
  sourceRepository: "https://github.com/Nurkan1/Anatria-3D",
  sourceCommit: commit,
  upstreamModel: "https://github.com/Z-Anatomy/Models-of-human-anatomy",
  license: "CC-BY-SA-4.0",
  attribution: "Z-Anatomy contributors; BodyParts3D / DBCLS",
  modifications: "ligament-full.glb is the unmodified articular export. tendon-full.glb keeps only the selected muscular-system nodes and re-encodes them with Draco (16-bit positions). Both are placed with the male registration used for the vessel/nerve supplements; no per-structure registration.",
  sources: Object.entries(pinned).map(([name, hash]) => ({ url: `${root}/${name}`, sha256: hash })),
  assets: [
    { path: "public/models/ligament-full.glb", sha256: sha(articularBytes), structures: ligamentItems.length },
    { path: "public/models/tendon-full.glb", sha256: sha(tendonBytes), structures: tendonItems.length, maxBoundsChangeMeters: +reencodeError.toExponential(2) },
  ],
  selection: {
    ligament: "All articular-system nodes plus vertebral-column ligaments listed under the skeletal system; intervertebral discs excluded (base meshes).",
    tendon: "Muscular-system nodes named tendon, aponeurosis, retinaculum or ligament, plus tendon sheaths. Excluded: muscular insertions (attachment patches), bursae, intermuscular septa. Most tendons remain part of their muscle meshes in the source.",
  },
  excludedBaseDuplicates: excluded.map((o) => o.name_en).sort(),
  kinds: count(catalog, "kind"),
  baseTags: { male: Object.keys(maleTags).length, female: Object.keys(femaleTags).length },
  naming: "Korean names are editorial (data/catalog/connective-ko.tsv), not expert-reviewed; English, TA2 Latin and source hierarchy are kept.",
}, null, 2) + "\n");
console.log(`Connective tissue: ${ligamentItems.length} ligament/joint + ${tendonItems.length} tendon structures (excluded ${excluded.length} base duplicates); tendon subset ${(tendonBytes.length / 1e6).toFixed(2)}MB, max bounds change ${reencodeError.toExponential(2)} m; base tags male ${Object.keys(maleTags).length}, female ${Object.keys(femaleTags).length}`);
