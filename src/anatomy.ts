import labels from "../data/structure-labels.json";
import { limbSkeletonRegion, sourceOrganRegion } from "./anatomy-region";
import inputs from "../scripts/model-inputs.json";
import fullSystemStructures from "../data/full-system-structures.json";
import connectiveStructures from "../data/connective-structures.json";
import connectiveTags from "../data/connective-tags.json";
import sexLymphStructures from "../data/sex-lymph-structures.json";
import femaleAtlasStructures from "../data/female-atlas-structures.json";
import femaleOrganGroups from "../data/female-organ-groups.json";
import femaleAirwayGroups from "../data/female-airway-groups.json";
import {femaleBiliaryGroups,femaleBiliaryDisplay} from "./female-biliary-navigation";
import femaleAdditionalOrganGroups from "../data/female-additional-organ-groups.json";
import femaleCompositeGroups from "../data/female-composite-groups.json";
import maleOrganGroups from "../data/male-organ-groups.json";
import maleDetailGroups from "../data/male-detail-groups.json";
import maleDetailStructures from "../data/male-detail-structures.json";
import femaleDetailStructures from "../data/female-detail-structures.json";
import femaleDetailGroups from "../data/female-detail-groups.json";
import {pelvicStructureDisplay} from "./female-pelvic-bindings";
export const organGroups = [...maleOrganGroups.map(group => maleDetailGroups.find(detail => detail.id === group.id) || group), ...femaleOrganGroups, ...femaleAirwayGroups, ...femaleBiliaryGroups, ...femaleAdditionalOrganGroups, ...femaleDetailGroups];
// Source-defined composite structures are available from their selection card,
// without changing the featured major-organ navigation or comparison bundles.
export const compositeGroups = femaleCompositeGroups;
const lung = maleDetailGroups.find(group => group.id === "lung")!;
const kidney = maleDetailGroups.find(group => group.id === "kidney")!;
export const maleKidneyViews = [kidney, ...(["left", "right"] as const).map(side => ({
  ...kidney, id: `kidney-${side}`, name: side === "left" ? "왼쪽 콩팥 · 혈관 확대" : "오른쪽 콩팥 · 혈관 확대",
  ids: kidney.ids.filter(id => {
    const name = maleDetailStructures.find(part => part.id === id)?.name;
    return Boolean(name && (name.startsWith(side === "left" ? "Left " : "Right ")
      || name.toLowerCase().includes(`of ${side} renal artery`)) && !name.toLowerCase().includes("ureter"));
  }),
}))];
export const maleLungViews = [lung, {
  ...lung, id: "lung-internal", name: "폐 · 혈관·기관지",
  ids: lung.ids.filter(id => !maleDetailStructures.find(s => s.id === id)?.name.startsWith("Parenchyma of ")),
}, maleDetailGroups.find(group => group.id === "lung-branches")!];
export const malePancreasViews = [maleDetailGroups.find(group => group.id === "pancreas")!,
  maleDetailGroups.find(group => group.id === "pancreas-parenchyma")!];
export const structureGroups = [...organGroups, ...compositeGroups, ...maleKidneyViews.slice(1), ...maleLungViews.slice(1), ...malePancreasViews.slice(1)];
export const layerNames = {
  skin: "체표",
  muscle: "근육",
  bone: "골격",
  organ: "장기",
  vessel: "혈관",
  lymph: "림프",
  nerve: "신경",
};
export type Layer = keyof typeof layerNames;
export const layerKeys = Object.keys(layerNames) as Layer[];
export { dissectionLayerOpacity } from "./dissection";
export const anatomyRegionNames = {
  whole: "전신", head: "머리", "upper-body": "상체", "lower-body": "하체",
  "upper-limb": "팔·손", "lower-limb": "다리·발", chest: "가슴", abdomen: "배", pelvis: "골반",
} as const;
const baseStructures = inputs.assets.map((s) => ({
  ...s,
  group: maleOrganGroups.find(group => group.ids.includes(s.id))?.id,
  sex: "male" as const,
  label: (labels as Record<string, string>)[s.id] || s.name,
}));
// Preserve the pinned source catalogue and its audit hashes. These navigation
// scopes only annotate existing source-defined female meshes at runtime.
const additionalFemaleGroupById = new Map(femaleAdditionalOrganGroups.flatMap(group => group.ids.map(id => [id, group] as const)));
const featuredFemaleGroupById = new Map(femaleAirwayGroups.flatMap(group => group.ids.map(id => [id, group] as const)));
export const structures = [...baseStructures, ...fullSystemStructures.map(s => ({ ...s, sex: "male" as const })), ...connectiveStructures.map(s => ({ ...s, sex: "male" as const })), ...sexLymphStructures.filter(s => s.sex === "male"), ...femaleAtlasStructures, ...maleDetailStructures, ...femaleDetailStructures].map(s => {
  const additional = s.sex === "female" && !("group" in s && s.group) ? additionalFemaleGroupById.get(s.id) : undefined;
  const featured = s.sex === "female" && !("group" in s && s.group) ? featuredFemaleGroupById.get(s.id) : undefined;
  const grouped = additional ? { ...s, group: additional.id, hierarchy: ["reproductive", additional.name, additional.id] }
    : featured ? { ...s, group: featured.id, hierarchy: [...("hierarchy" in s && Array.isArray(s.hierarchy) ? s.hierarchy : []), featured.name, featured.id] } : s;
  const displayed=femaleBiliaryDisplay(grouped);
  const region = limbSkeletonRegion(displayed) || sourceOrganRegion(displayed);
  return { ...pelvicStructureDisplay(displayed), ...(region ? { bodyRegion: region } : {}) };
}) as {
  id: string;
  fmaId?: string;
  name: string;
  label?: string;
  layer: Layer;
  node?: string;
  latin?: string;
  hierarchy?: string[];
  description?: string;
  source?: string;
  sex: "male" | "female";
  bodyRegion?: string;
  model?: string;
  group?: string;
  detailOnly?: boolean;
  kind?: string;
}[];
// Ligaments, joint structures and separately modelled tendons. Supplement
// meshes carry their kind; existing base meshes of these kinds are tagged.
export const connectiveKindNames: Record<string, string> = {
  ligament: "인대", capsule: "관절주머니", meniscus: "반달연골", disc: "관절원반", labrum: "관절테두리", membrane: "섬유막",
  cartilage: "연골", fatpad: "지방체", symphysis: "섬유연골결합", tendon: "힘줄", aponeurosis: "널힘줄", retinaculum: "지지띠",
  sheath: "힘줄집", tract: "근막띠",
};
const connectiveKindById = new Map<string, string>([
  ...connectiveStructures.map((s) => [s.id, s.kind] as [string, string]),
  ...Object.entries(connectiveTags.male), ...Object.entries(connectiveTags.female),
]);
export const connectiveKindOf = (id: string) => connectiveKindById.get(id);
export const connectiveIdsForSex = (sex: "male" | "female") =>
  sex === "male" ? [...connectiveStructures.map((s) => s.id), ...Object.keys(connectiveTags.male)] : Object.keys(connectiveTags.female);
export const maleOnlyStructureIds = new Set([
  "FMA18247", "FMA18256", "FMA18257", "FMA19235", "FMA19236", "FMA19387",
  "FMA19388", "FMA19617nsn", "FMA19618", "FMA7211", "FMA7212", "FMA9600",
]);
export const structuresForSex = (sex: "male" | "female") =>
  structures.filter((structure) => structure.sex === sex);
// Detail-only references use a separate source coordinate frame. Enter a named
// scope even when reached from search so isolation/return controls remain honest.
export function detailForStructure(structure: (typeof structures)[number]) {
  if (!structure.detailOnly) return undefined;
  const group = structureGroups.find(g => g.id === structure.group && g.sex === structure.sex);
  if (!group) return undefined;
  return { id: group.id, name: group.name, ids: group.ids,
    layers: Object.fromEntries(layerKeys.map(layer => [layer, structures.some(s => s.layer === layer && group.ids.includes(s.id))])) as Record<Layer, boolean> };
}
export const searchableStructureCount = baseStructures.length;
export const stages: { layer: Layer; description: string }[] = [
  {
    layer: "skin",
    description:
      "체표의 경혈 표식을 확인합니다. 표식은 학습용 근사 위치입니다.",
  },
  {
    layer: "muscle",
    description:
      "437개 근육·힘줄·근막 구조와 따로 모델링된 힘줄·널힘줄·지지띠·힘줄집 58개를 살펴봅니다. 대부분의 힘줄은 원본에서 근육 모형에 포함되어 있습니다.",
  },
  {
    layer: "bone",
    description: "278개 골격·치아·연골 구조와 인대·관절주머니·반달연골 등 관절 구조 358개를 확인합니다. 근육을 걷어 내면 뼈에 붙은 인대가 드러납니다.",
  },
  {
    layer: "organ",
    description:
      "67개 장기·부속 구조의 실제 모델 위치를 비교합니다. 전통적 장부 대응은 압력 전달 경로가 아닙니다.",
  },
  {
    layer: "vessel",
    description:
      "640개 전신 심혈관 구성요소를 이름·TA2 라틴명·계통 경로로 검색하고 개별 선택할 수 있습니다. 미세혈관 전체를 뜻하지 않습니다.",
  },
  {
    layer: "lymph",
    description:
      "림프절·림프관·비장·흉선 등 원본에 명명된 림프 구조를 살펴봅니다. 남녀 참조 자료의 수록 범위가 서로 다릅니다.",
  },
  {
    layer: "nerve",
    description:
      "525개 좌우 전신 신경·감각기관 구성요소를 이름·TA2 라틴명·계통 경로로 검색하고 개별 선택할 수 있습니다.",
  },
];

export function stageDescription(stage: number, sex: "male" | "female") {
  if (sex === "male") return stages[stage].description;
  const layer = stages[stage].layer;
  const count = structuresForSex(sex).filter(s => s.layer === layer && !s.detailOnly).length;
  const limitations: Record<Layer, string> = {
    skin: "여성 표면의 경혈 좌표는 검수 전이므로 표식을 표시하지 않습니다.",
    muscle: "별도 제작된 Visible Human Female 하체 근육을 포함하며 일부는 피부 밖으로 벗어나는 정렬 문제가 남아 있습니다. 상체 근육 전체는 수록되어 있지 않습니다.",
    bone: "남성 유래 보완 골격 180개를 회청색과 출처로 구분합니다. 팔·손뼈 60개와 발가락뼈 20개의 위치를 부분 교정했고, 그중 양쪽 약지·새끼손가락과 다섯째 손허리뼈 14개를 추가 조정했습니다. 엄지·검지, 새끼발가락·뒤꿈치 등 정렬은 아직 미완료입니다. 여성 고유 골격으로 해석하지 마세요. 인대는 원본에 있는 무릎 인대·반달연골만 수록되어 있습니다.",
    organ: "여성 CT 자료는 전신에 합쳐지지 않은 별도 상세입니다. 전통적 장부 대응은 압력 전달 경로가 아닙니다.",
    vessel: "여성 원본에 수록된 혈관을 검색·선택합니다. 전신 미세혈관 전체를 뜻하지 않습니다.",
    lymph: "여성 원본에 명명된 림프 구조입니다. 남성 자료와 수록 범위가 다릅니다.",
    nerve: "뇌 묶음은 Allen 참조 282개와 Visible Human 시신경교차 1개입니다. 현재 뇌 모형 35개가 남성 유래 차용 머리뼈와 표면 교차합니다. 위치·신경 연결 검증은 미완료이며, 전신 말초신경 전체를 포함하지 않습니다.",
  };
  return `여성 전신 참조의 ${layerNames[layer]} 모형 ${count}개. ${limitations[layer]}`;
}
