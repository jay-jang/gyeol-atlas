import labels from "../data/structure-labels.json";
import inputs from "../scripts/model-inputs.json";
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
export const structures = inputs.assets.map((s) => ({
  ...s,
  label: (labels as Record<string, string>)[s.id] || s.name,
})) as {
  id: string;
  fmaId?: string;
  name: string;
  label?: string;
  layer: Layer;
}[];
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
    description: "129개 골격·치아 구조에서 뼈와 관절의 기준점을 확인합니다.",
  },
  {
    layer: "organ",
    description:
      "67개 장기·부속 구조의 실제 모델 위치를 비교합니다. 전통적 장부 대응은 압력 전달 경로가 아닙니다.",
  },
  {
    layer: "vessel",
    description:
      "56개 주요 혈관 구조를 봅니다. 미세혈관 전체를 포함하지 않습니다.",
  },
  {
    layer: "nerve",
    description:
      "340개 뇌·척수·뇌신경·상지 신경 및 관련 공간 구조를 봅니다. 말초신경은 원본에 수록된 부위만 표시하며 좌우와 전신을 모두 포함하지 않습니다.",
  },
];
