import type { Layer } from "./anatomy";
import type { Layers } from "./types";
import { dissectionLayers, quantizeDepth, stageDepth } from "./dissection.ts";
import { hasMixedReferenceFrames } from "./reference-source.ts";
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
  version: 4;
  pointId: string;
  sex: "male" | "female";
  anatomyRegion: "whole" | "head" | "upper-body" | "lower-body" | "upper-limb" | "lower-limb" | "chest" | "abdomen" | "pelvis";
  stage: number;
  dissection: number;
  displayMode: "dissection" | "layers";
  layers: Layers;
  alpha: Record<Layer, number>;
  markers: "hidden" | "selected" | "filtered";
  labels: boolean;
  selection: Selection | null;
  detail: { id: string; name: string; ids: string[]; layers: Layers } | null;
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
const keys: Layer[] = ["skin", "muscle", "bone", "organ", "vessel", "lymph", "nerve"];
const singleLayer = (index: number) =>
  Object.fromEntries(keys.map((layer, layerIndex) => [layer, layerIndex === index])) as Layers;
export function initialView(pointId = ""): ViewState {
  return {
    version: 4,
    pointId,
    sex: "male",
    anatomyRegion: "whole",
    stage: 0,
    dissection: 0,
    displayMode: "dissection",
    layers: {
      skin: true,
      muscle: false,
      bone: false,
      organ: false,
      vessel: false,
      lymph: false,
      nerve: false,
    },
    alpha: { skin: 1, muscle: 1, bone: 1, organ: 1, vessel: 1, lymph: 1, nerve: 1 },
    markers: "selected",
    labels: false,
    selection: null,
    detail: null,
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
  | { type: "sex"; value: ViewState["sex"] }
  | { type: "anatomy-region"; value: ViewState["anatomyRegion"] }
  | { type: "stage"; index: number }
  | { type: "dissection"; value: number }
  | { type: "layers"; layers: Layers }
  | { type: "alpha"; layer: Layer; value: number }
  | { type: "markers"; value: ViewState["markers"] }
  | { type: "labels"; value: boolean }
  | { type: "target"; value: ViewState["selectionTarget"] }
  | { type: "select"; selection: Selection; layer?: Layer; region?: ViewState["anatomyRegion"]; detail?: NonNullable<ViewState["detail"]> }
  | { type: "detail"; detail: NonNullable<ViewState["detail"]> }
  | { type: "detail-close" }
  | { type: "compare"; name: string; ids: string[]; layers?: Layers }
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
    case "sex":
      return a.value === s.sex ? s : { ...s, sex: a.value, stage: 0, dissection: 0, displayMode: "dissection", anatomyRegion: "whole", layers: singleLayer(0), alpha: initialView().alpha, selection: null, detail: null, comparison: null, isolated: false, cutaway: 0 };
    case "anatomy-region":
      return a.value === s.anatomyRegion ? s : { ...s, anatomyRegion: a.value, selection: null, detail: null, comparison: null, isolated: false };
    case "point":
      return a.id === s.pointId
        ? s
        : {
            ...s,
            pointId: a.id,
            selection: null,
            detail: null,
            comparison: null,
            isolated: false,
          };
    case "stage":
      return {
        ...s,
        detail: null,
        stage: a.index,
        dissection: stageDepth[a.index],
        displayMode: "layers",
        layers: singleLayer(a.index),
        selection: null,
        comparison: null,
        isolated: false,
        cutaway: 0,
        selectionTarget: "visible",
      };
    case "dissection": {
      const depth = quantizeDepth(a.value);
      const layers = dissectionLayers(depth);
      const stage = depth < 8 ? 0 : depth < 38 ? 1 : depth < 56 ? 2 : depth < 70 ? 3 : depth < 82 ? 4 : depth < 90 ? 5 : 6;
      return {
        ...s,
        dissection: depth,
        displayMode: "dissection",
        detail: null,
        stage,
        layers,
        selection: null,
        comparison: null,
        isolated: false,
        cutaway: 0,
        selectionTarget: "visible",
      };
    }
    case "layers":
      return {
        ...s,
        detail: null,
        layers: a.layers,
        displayMode: "layers",
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
      return {
        ...s,
        selectionTarget: a.value,
        ...(a.value === "skin" ? {
          stage: 0, dissection: 0, displayMode: "layers" as const,
          detail: null, selection: null, comparison: null, isolated: false,
        } : {}),
        layers: a.value === "skin" ? { ...s.layers, skin: true } : s.layers,
      };
    case "select": {
      const stage = a.layer ? keys.indexOf(a.layer) : -1;
      const scope = a.detail || s.detail;
      const detail = scope && a.selection.ids.every(id => scope.ids.includes(id)) ? scope : null;
      return {
        ...s,
        ...(stage >= 0
          ? {
              stage,
              dissection: stageDepth[stage],
              displayMode: "layers" as const,
              layers: singleLayer(stage),
              comparison: null,
              cutaway: 0,
              selectionTarget: "visible" as const,
              ...(a.region ? { anatomyRegion: a.region } : {}),
            }
          : {}),
        selection: a.selection,
        detail,
        isolated: Boolean(detail),
      };
    }
    case "detail": {
      const stage = a.detail.layers.organ ? 3 : Math.max(0, keys.findIndex(layer => a.detail.layers[layer]));
      return { ...s, detail: a.detail, selection: { kind: "bundle", ids: a.detail.ids, name: a.detail.name }, layers: a.detail.layers, stage, dissection: stageDepth[stage], displayMode: "layers", anatomyRegion: "whole", isolated: false, cutaway: 0, comparison: null, selectionTarget: "visible" };
    }
    case "detail-close":
      return { ...s, detail: null, selection: null, isolated: false, cutaway: 0, layers: s.detail?.layers || s.layers };
    case "compare":
      return {
        ...s,
        detail: null,
        stage: 0,
        dissection: 0,
        displayMode: "layers",
        layers: a.layers || {
          skin: true,
          muscle: false,
          bone: false,
          organ: true,
          vessel: false,
          lymph: false,
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
      return { ...s, selection: null, detail: null, isolated: false };
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
  assets: { id: string; layer: string; sex?: string }[],
): ViewState {
  const base = initialView();
  try {
    const parsed = JSON.parse(raw || "null") as Record<string, any> | null;
    const legacy = parsed?.version === 2 || parsed?.version === 3;
    const s = (legacy
      ? { ...parsed, version: 4 as const, sex: "male" as const, anatomyRegion: "whole" as const,
          stage: parsed.stage === 5 ? 6 : parsed.stage,
          dissection: parsed.dissection ?? [0, 20, 72, 68, 82, 96][parsed.stage] ?? 0,
          layers: { ...parsed.layers, lymph: false }, alpha: { ...parsed.alpha, lymph: 1 } }
      : parsed) as ViewState;
    if (
      !s ||
      s.version !== 4 ||
      (s.pointId !== "" && !pointIds.includes(s.pointId)) ||
      !Number.isInteger(s.stage) ||
      s.stage < 0 ||
      s.stage > 6 ||
      !["male", "female"].includes(s.sex) ||
      !["whole", "head", "upper-body", "lower-body", "upper-limb", "lower-limb", "chest", "abdomen", "pelvis"].includes(s.anatomyRegion)
    )
      return base;
    if (!Number.isFinite(s.dissection) || s.dissection < 0 || s.dissection > 100)
      return base;
    s.displayMode ??= "layers";
    s.detail ??= null;
    if (!["dissection", "layers"].includes(s.displayMode)) return base;
    s.dissection = quantizeDepth(s.dissection);
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
        !hasMixedReferenceFrames(s.sex, x.ids) &&
        x.ids.every((id) =>
          assets.some((a) => a.id === id && (!a.sex || a.sex === s.sex) && s.layers[a.layer as Layer]),
        ));
    if (
      !validSelection(s.selection) ||
      !validSelection(s.comparison) ||
      (s.comparison && s.comparison.pointId !== s.pointId) ||
      (s.isolated && !s.selection)
    )
      return base;
    if (s.detail && (!s.detail.ids?.length || typeof s.detail.name !== "string" || typeof s.detail.id !== "string" || !keys.every(key => typeof s.detail!.layers?.[key] === "boolean") || !s.detail.ids.every(id => assets.some(a => a.id === id && (!a.sex || a.sex === s.sex))))) return base;
    if (hasMixedReferenceFrames(s.sex, [...(s.selection?.ids || []), ...(s.detail?.ids || [])])) return base;
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
