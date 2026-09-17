import type { Layer } from "./anatomy";
import type { Layers } from "./types";
export type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
};
export type Selection = {
  kind: "structure" | "bundle";
  ids: string[];
  name: string;
};
export type ViewState = {
  version: 2;
  pointId: string;
  stage: number;
  layers: Layers;
  alpha: Record<Layer, number>;
  markers: "hidden" | "selected" | "filtered";
  labels: boolean;
  selection: Selection | null;
  comparison: ({ pointId: string } & Selection) | null;
  isolated: boolean;
  cutaway: number;
  selectionTarget: "visible" | "internal" | "skin";
  camera: CameraPose | null;
  filters: {
    query: string;
    region: string;
    meridian: string;
    concept: string;
    onlySaved: boolean;
    bodyRegion: string;
    catalogue: string;
  };
};
const keys: Layer[] = ["skin", "muscle", "bone", "organ", "vessel", "nerve"];
export function initialView(pointId = ""): ViewState {
  return {
    version: 2,
    pointId,
    stage: 0,
    layers: {
      skin: true,
      muscle: false,
      bone: false,
      organ: false,
      vessel: false,
      nerve: false,
    },
    alpha: { skin: 1, muscle: 1, bone: 1, organ: 1, vessel: 1, nerve: 1 },
    markers: "selected",
    labels: false,
    selection: null,
    comparison: null,
    isolated: false,
    cutaway: 0,
    selectionTarget: "visible",
    camera: null,
    filters: {
      query: "",
      region: "전체",
      meridian: "all",
      concept: "all",
      onlySaved: false,
      bodyRegion: "전체",
      catalogue: "all",
    },
  };
}
export type ViewAction =
  | { type: "point"; id: string }
  | { type: "stage"; index: number }
  | { type: "layers"; layers: Layers }
  | { type: "alpha"; layer: Layer; value: number }
  | { type: "markers"; value: ViewState["markers"] }
  | { type: "labels"; value: boolean }
  | { type: "target"; value: ViewState["selectionTarget"] }
  | { type: "select"; selection: Selection; layer?: Layer }
  | { type: "compare"; name: string; ids: string[] }
  | { type: "isolate" }
  | { type: "clear-selection" }
  | { type: "cutaway"; value: number }
  | { type: "camera"; value: CameraPose }
  | { type: "filters"; value: Partial<ViewState["filters"]> }
  | { type: "reset-filters" }
  | { type: "region-filter"; value: string }
  | { type: "show-filtered" }
  | { type: "reset" };
export function viewReducer(s: ViewState, a: ViewAction): ViewState {
  switch (a.type) {
    case "point":
      return a.id === s.pointId
        ? s
        : {
            ...s,
            pointId: a.id,
            selection: null,
            comparison: null,
            isolated: false,
          };
    case "stage":
      return {
        ...s,
        stage: a.index,
        layers: Object.fromEntries(
          keys.map((l, i) => [l, i === a.index]),
        ) as Layers,
        selection: null,
        comparison: null,
        isolated: false,
        cutaway: 0,
        selectionTarget: "visible",
      };
    case "layers":
      return {
        ...s,
        layers: a.layers,
        selection: null,
        comparison: null,
        isolated: false,
        selectionTarget: "visible",
      };
    case "alpha":
      return {
        ...s,
        alpha: { ...s.alpha, [a.layer]: Math.max(0.05, Math.min(1, a.value)) },
      };
    case "markers":
      return { ...s, markers: a.value };
    case "labels":
      return { ...s, labels: a.value };
    case "target":
      return { ...s, selectionTarget: a.value };
    case "select":
      return {
        ...s,
        layers: a.layer ? { ...s.layers, [a.layer]: true } : s.layers,
        selection: a.selection,
        isolated: false,
      };
    case "compare":
      return {
        ...s,
        stage: 3,
        layers: {
          skin: true,
          muscle: false,
          bone: false,
          organ: true,
          vessel: false,
          nerve: false,
        },
        alpha: { ...s.alpha, skin: 0.12 },
        selection: { kind: "bundle", ids: a.ids, name: a.name },
        comparison: {
          kind: "bundle",
          pointId: s.pointId,
          ids: a.ids,
          name: a.name,
        },
        isolated: false,
        selectionTarget: "internal",
        cutaway: 0,
      };
    case "isolate":
      return s.selection?.ids.length ? { ...s, isolated: !s.isolated } : s;
    case "clear-selection":
      return { ...s, selection: null, isolated: false };
    case "cutaway":
      return { ...s, cutaway: Math.max(0, Math.min(1, a.value)) };
    case "camera":
      return { ...s, camera: a.value };
    case "filters":
      return { ...s, filters: { ...s.filters, ...a.value } };
    case "region-filter":
      return { ...s, filters: { ...s.filters, bodyRegion: a.value, region: "전체" }, markers: "filtered", selection: null, comparison: null, isolated: false };
    case "show-filtered":
      return { ...s, markers: "filtered", selection: null, comparison: null, isolated: false };
    case "reset-filters":
      return { ...s, filters: initialView().filters };
    case "reset":
      return initialView(s.pointId);
  }
}
// Saved state is untrusted, versioned and catalog-checked. Unknown snapshots reset safely.
export function restoreView(
  raw: string | null,
  pointIds: string[],
  assets: { id: string; layer: string }[],
): ViewState {
  const base = initialView();
  try {
    const s = JSON.parse(raw || "null") as ViewState;
    if (
      !s ||
      s.version !== 2 ||
      (s.pointId !== "" && !pointIds.includes(s.pointId)) ||
      !Number.isInteger(s.stage) ||
      s.stage < 0 ||
      s.stage > 5
    )
      return base;
    if (
      !keys.every(
        (k) =>
          typeof s.layers?.[k] === "boolean" &&
          Number.isFinite(s.alpha?.[k]) &&
          s.alpha[k] >= 0.05 &&
          s.alpha[k] <= 1,
      )
    )
      return base;
    if (
      !["hidden", "selected", "filtered"].includes(s.markers) ||
      !["visible", "internal", "skin"].includes(s.selectionTarget) ||
      typeof s.labels !== "boolean" ||
      typeof s.isolated !== "boolean" ||
      !Number.isFinite(s.cutaway) ||
      s.cutaway < 0 ||
      s.cutaway > 1
    )
      return base;
    const validSelection = (x: Selection | null) =>
      x === null ||
      (["structure", "bundle"].includes(x.kind) &&
        typeof x.name === "string" &&
        Array.isArray(x.ids) &&
        x.ids.length > 0 &&
        x.ids.every((id) =>
          assets.some((a) => a.id === id && s.layers[a.layer as Layer]),
        ));
    if (
      !validSelection(s.selection) ||
      !validSelection(s.comparison) ||
      (s.comparison && s.comparison.pointId !== s.pointId) ||
      (s.isolated && !s.selection)
    )
      return base;
    if (
      s.camera &&
      ![s.camera.position, s.camera.target].every(
        (a) =>
          Array.isArray(a) &&
          a.length === 3 &&
          a.every((n) => Number.isFinite(n) && Math.abs(n) <= 20),
      )
    )
      return base;
    if (
      s.camera &&
      Math.hypot(...s.camera.position.map((n, i) => n - s.camera!.target[i])) <
        0.05
    )
      return base;
    if (
      !s.filters ||
      !["query", "region", "meridian", "concept"].every(
        (k) => typeof s.filters[k as keyof typeof s.filters] === "string",
      ) ||
      typeof s.filters.onlySaved !== "boolean"
    )
      return base;
    if (
      !["전체", "머리·목", "몸통", "팔·손", "다리·발"].includes(
        s.filters.region,
      ) ||
      !["all", "yuan", "mu", "five-shu", "luo"].includes(s.filters.concept) ||
      ![
        "all",
        "LU",
        "LI",
        "ST",
        "SP",
        "HT",
        "SI",
        "BL",
        "KI",
        "PC",
        "TE",
        "GB",
        "LR",
        "CV",
        "GV",
        "EX",
      ].includes(s.filters.meridian)
    )
      return base;
    const bodyRegions = ["전체", "머리·얼굴", "목", "가슴", "배·골반", "등·허리", "어깨·위팔", "팔꿈치·아래팔", "손목·손", "넓적다리", "무릎·종아리", "발목·발"];
    if (s.filters.bodyRegion !== undefined && !bodyRegions.includes(s.filters.bodyRegion)) return base;
    if (s.filters.catalogue !== undefined && !["all", "classical", "extra"].includes(s.filters.catalogue)) return base;
    return { ...s, filters: { ...base.filters, ...s.filters } };
  } catch {
    return base;
  }
}
