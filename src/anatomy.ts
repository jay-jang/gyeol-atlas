import labels from "../data/structure-labels.json";
import inputs from "../scripts/model-inputs.json";
import fullSystemStructures from "../data/full-system-structures.json";
export const layerNames = {
  skin: "체표",
  muscle: "근육",
  bone: "골격",
  organ: "장기",
  vessel: "혈관",
  nerve: "신경",
};
export type Layer = keyof typeof layerNames;
export const layerKeys = Object.keys(layerNames) as Layer[];
const baseStructures = inputs.assets.map((s) => ({
  ...s,
  label: (labels as Record<string, string>)[s.id] || s.name,
}));
export const structures = [...baseStructures, ...fullSystemStructures] as {
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
}[];
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
    layer: "nerve",
    description:
      "525개 좌우 전신 신경·감각기관 구성요소를 이름·TA2 라틴명·계통 경로로 검색하고 개별 선택할 수 있습니다.",
  },
];
