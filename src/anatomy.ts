import labels from "../data/structure-labels.json";
import inputs from "../scripts/model-inputs.json";
import fullSystemStructures from "../data/full-system-structures.json";
import sexLymphStructures from "../data/sex-lymph-structures.json";
import femaleAtlasStructures from "../data/female-atlas-structures.json";
import femaleOrganGroups from "../data/female-organ-groups.json";
import maleOrganGroups from "../data/male-organ-groups.json";
import maleDetailGroups from "../data/male-detail-groups.json";
import maleDetailStructures from "../data/male-detail-structures.json";
import femaleDetailStructures from "../data/female-detail-structures.json";
import femaleDetailGroups from "../data/female-detail-groups.json";
export const organGroups = [...maleOrganGroups.map(group => maleDetailGroups.find(detail => detail.id === group.id) || group), ...femaleOrganGroups, ...femaleDetailGroups];
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
export const structures = [...baseStructures, ...fullSystemStructures.map(s => ({ ...s, sex: "male" as const })), ...sexLymphStructures.filter(s => s.sex === "male"), ...femaleAtlasStructures, ...maleDetailStructures, ...femaleDetailStructures] as {
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
}[];
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
  const group = organGroups.find(g => g.id === structure.group && g.sex === structure.sex);
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
      "437개 근육·힘줄·근막 구조를 회전하며 살펴봅니다. 필요한 레이어를 함께 켜서 비교하세요.",
  },
  {
    layer: "bone",
    description: "278개 골격·치아·연골 구조에서 손가락과 발가락 마디뼈까지 확인합니다.",
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
