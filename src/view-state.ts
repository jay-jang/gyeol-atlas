import type { Layer } from "./anatomy";
import type { Layers } from "./types";
import { dissectionLayers, quantizeDepth, stageDepth } from "./dissection.ts";
import { hasMixedReferenceFrames } from "./reference-source.ts";
import { sourceOrganRegion } from "./anatomy-region.ts";
import femaleBrainBindings from "../data/catalog/female-brain-bindings.json" with {type:"json"};
import femalePelvicBindings from "../data/catalog/female-pelvic-bindings.json" with {type:"json"};
import maleDetailGroups from "../data/male-detail-groups.json" with {type:"json"};
export type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
};
export type Selection = {
  kind: "structure" | "bundle";
  ids: string[];
  name: string;
};
type ReturnView = Pick<ViewState, "anatomyRegion" | "stage" | "dissection" | "displayMode" | "layers" | "cutaway" | "selectionTarget"> & { camera?: CameraPose | null };
export type ViewState = {
  version: 4;
  brainBindingVersion?: string;
  pelvicBindingVersion?: string;
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
  detailReturn: ReturnView | null;
  selectionReturn: ReturnView | null;
  comparison: ({ pointId: string } & Selection) | null;
  isolated: boolean;
  cutaway: number;
  selectionTarget: "visible" | "internal" | "skin";
  fadeContext: boolean;
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
    brainBindingVersion: femaleBrainBindings.version,
    pelvicBindingVersion: femalePelvicBindings.version,
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
    detailReturn: null,
    selectionReturn: null,
    comparison: null,
    isolated: false,
    cutaway: 0,
    selectionTarget: "visible",
    fadeContext: true,
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
  | { type: "route-point"; id: string }
  | { type: "sex"; value: ViewState["sex"] }
  | { type: "anatomy-region"; value: ViewState["anatomyRegion"] }
  | { type: "stage"; index: number }
  | { type: "dissection"; value: number }
  | { type: "dissection-step"; amount: number }
  | { type: "layers"; layers: Layers }
  | { type: "alpha"; layer: Layer; value: number }
  | { type: "fade-context"; value: boolean }
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
const returnView = (s: ViewState): ReturnView => ({
  anatomyRegion: s.anatomyRegion, stage: s.stage, dissection: s.dissection,
  displayMode: s.displayMode, layers: { ...s.layers }, cutaway: s.cutaway,
  selectionTarget: s.selectionTarget, camera: s.camera,
});
const detailOrigin = (s: ViewState) => s.detailReturn
  ?? s.selectionReturn ?? returnView(s.detail ? initialView(s.pointId) : s);
function closeDetail(s: ViewState): ViewState {
  const previous = detailOrigin(s);
  return { ...s, ...previous, detail: null, detailReturn: null, selectionReturn: null, selection: null,
    comparison: null, isolated: false };
}
function leaveSelection(s: ViewState): ViewState {
  if (s.detail) return closeDetail(s);
  if (!s.selectionReturn) return s;
  return { ...s, ...s.selectionReturn, selection: null, selectionReturn: null,
    comparison: null, isolated: false };
}
export function viewReducer(s: ViewState, a: ViewAction): ViewState {
  switch (a.type) {
    case "route-point":
      // Returning from the wiki to the same URL must not reinterpret a route
      // sync as a new user selection and discard the saved atlas view.
      return a.id === s.pointId ? s : viewReducer(s, { type: "point", id: a.id });
    case "sex":
      return a.value === s.sex ? s : { ...s, sex: a.value, stage: 0, dissection: 0, displayMode: "dissection", anatomyRegion: "whole", layers: singleLayer(0), alpha: initialView().alpha, selection: null, detail: null, detailReturn: null, selectionReturn: null, comparison: null, isolated: false, cutaway: 0 };
    case "anatomy-region":
      return a.value === s.anatomyRegion && !s.detail ? s
        : { ...leaveSelection(s), anatomyRegion: a.value, selection: null,
            detail: null, detailReturn: null, selectionReturn: null, comparison: null, isolated: false };
    case "point":
      return a.id === s.pointId && !s.detail && !s.selection && !s.comparison && !s.selectionReturn
        ? s
        : {
            ...leaveSelection(s),
            pointId: a.id,
            selection: null,
            detail: null,
            detailReturn: null,
            selectionReturn: null,
            comparison: null,
            isolated: false,
          };
    case "stage":
      return {
        ...s,
        detail: null,
        detailReturn: null,
        selectionReturn: null,
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
    case "dissection-step": {
      if (!Number.isFinite(a.amount) || a.amount === 0) return s;
      const depth = quantizeDepth(s.dissection + a.amount);
      // A clamped depth can still be a real transition out of layer/detail
      // mode. Only an already progressive boundary is a no-op.
      return depth === s.dissection && s.displayMode === "dissection" ? s : viewReducer(s, { type: "dissection", value: depth });
    }
    case "dissection": {
      const depth = quantizeDepth(a.value);
      const layers = dissectionLayers(depth);
      const stage = depth < 8 ? 0 : depth < 38 ? 1 : depth < 56 ? 2 : depth < 70 ? 3 : depth < 82 ? 4 : depth < 90 ? 5 : 6;
      return {
        ...s,
        dissection: depth,
        displayMode: "dissection",
        detail: null,
        detailReturn: null,
        selectionReturn: null,
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
        detailReturn: null,
        selectionReturn: null,
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
    case "fade-context":
      return { ...s, fadeContext: a.value };
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
          detail: null, detailReturn: null, selectionReturn: null, selection: null, comparison: null, isolated: false,
        } : {}),
        layers: a.value === "skin" ? { ...s.layers, skin: true } : s.layers,
      };
    case "select": {
      const stage = a.layer ? keys.indexOf(a.layer) : -1;
      // A part may have a narrower default detail (e.g. CT back muscles).
      // Keep the containing scope the user explicitly opened while selecting it.
      const scope = s.detail && a.selection.ids.every(id => s.detail!.ids.includes(id)) ? s.detail : a.detail;
      const detail = scope && a.selection.ids.every(id => scope.ids.includes(id)) ? scope : null;
      // A normal part selection temporarily changes the layer, but leaving it
      // should reveal the same progressive scene. Carry its origin through a
      // chain of selections and through a later transition into detail.
      const selectionReturn = !detail && stage >= 0
        ? s.selectionReturn ?? s.detailReturn ?? (!s.comparison && s.displayMode === "dissection" ? { ...returnView(s), camera: s.camera } : null)
        : null;
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
        detailReturn: detail ? detailOrigin(s) : null,
        selectionReturn,
        isolated: Boolean(detail),
      };
    }
    case "detail": {
      const stage = a.detail.layers.organ ? 3 : Math.max(0, keys.findIndex(layer => a.detail.layers[layer]));
      return { ...s, detail: a.detail, detailReturn: detailOrigin(s), selectionReturn: null, selection: { kind: "bundle", ids: a.detail.ids, name: a.detail.name }, layers: a.detail.layers, stage, dissection: stageDepth[stage], displayMode: "layers", anatomyRegion: "whole", isolated: false, cutaway: 0, comparison: null, selectionTarget: "visible" };
    }
    case "detail-close":
      return s.detail ? closeDetail(s) : s;
    case "compare":
      return {
        ...s,
        detail: null,
        detailReturn: null,
        selectionReturn: null,
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
      return s.selection?.ids.length ? {
        ...s, isolated: !s.isolated,
        // Selecting a part activates its layer. Restoring its detail context
        // must also restore the other layers and remove the part's region filter.
        ...(s.isolated && s.detail ? { layers: s.detail.layers, anatomyRegion: "whole" as const } : {}),
      } : s;
    case "clear-selection":
      return s.detail ? closeDetail(s) : { ...s, ...(s.selectionReturn || {}), selection: null, detail: null, detailReturn: null, selectionReturn: null, comparison: null, isolated: false };
    case "cutaway":
      return { ...s, cutaway: Math.max(0, Math.min(1, a.value)) };
    case "camera":
      return { ...s, camera: a.value };
    case "filters":
      return { ...s, filters: { ...s.filters, ...a.value } };
    case "region-filter":
      return { ...leaveSelection(s), filters: { ...s.filters, bodyRegion: a.value, region: "전체" }, markers: "filtered", selection: null, selectionReturn: null, comparison: null, isolated: false };
    case "show-filtered":
      return { ...leaveSelection(s), markers: "filtered", selection: null, selectionReturn: null, comparison: null, isolated: false };
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
  assets: { id: string; layer: string; sex?: string; group?: string }[],
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
    s.detailReturn ??= null;
    s.selectionReturn ??= null;
    if (!s.detail) s.detailReturn = null;
    const validCamera = (pose: CameraPose | null | undefined) => pose == null ||
      ([pose.position, pose.target].every(a => Array.isArray(a) && a.length === 3
        && a.every(n => Number.isFinite(n) && Math.abs(n) <= 20))
        && Math.hypot(...pose.position.map((n, i) => n - pose.target[i])) >= 0.05);
    const validReturn = (r: ReturnView | null) => r === null || (
      typeof r === "object" && !Array.isArray(r)
        && Number.isInteger(r.stage) && r.stage >= 0 && r.stage <= 6
        && Number.isFinite(r.dissection) && r.dissection >= 0 && r.dissection <= 100
        && ["dissection", "layers"].includes(r.displayMode)
        && ["whole", "head", "upper-body", "lower-body", "upper-limb", "lower-limb", "chest", "abdomen", "pelvis"].includes(r.anatomyRegion)
        && keys.every(key => typeof r.layers?.[key] === "boolean")
        && Number.isFinite(r.cutaway) && r.cutaway >= 0 && r.cutaway <= 1
        && ["visible", "internal", "skin"].includes(r.selectionTarget)
        && validCamera(r.camera));
    if (!validReturn(s.detailReturn) || !validReturn(s.selectionReturn)) return base;
    if (s.detailReturn) s.detailReturn.dissection = quantizeDepth(s.detailReturn.dissection);
    if (s.selectionReturn) s.selectionReturn.dissection = quantizeDepth(s.selectionReturn.dissection);
    if (s.fadeContext === undefined) s.fadeContext = base.fadeContext;
    if (typeof s.fadeContext !== "boolean") return base;
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
    // Only migrate the exact historical 280-member lung scope. The old fine
    // branches remain a separate source view; retired fragments are not mapped
    // to a guessed replacement. Preserve camera, alpha and marker preferences.
    const branchGroup = maleDetailGroups.find(group => group.id === "lung-branches");
    const retiredLungIds = ["BP4_FJ2041", "BP4_FJ2044"];
    const legacyLungIds = branchGroup ? [...branchGroup.ids, ...retiredLungIds] : [];
    const isLegacyLung = (ids: unknown): boolean => Array.isArray(ids)
      && ids.length === 280 && new Set(ids).size === 280 && ids.every(id => legacyLungIds.includes(id));
    if (branchGroup && s.sex === "male" && s.detail?.id === "lung" && typeof s.detail.name === "string"
      && keys.every(key => typeof s.detail!.layers?.[key] === "boolean") && isLegacyLung(s.detail.ids)) {
      const layers = Object.fromEntries(keys.map(key => [key, assets.some(a => branchGroup.ids.includes(a.id) && a.layer === key)])) as Layers;
      s.detail = { id: branchGroup.id, name: branchGroup.name, ids: branchGroup.ids, layers };
      if (s.selection && ["structure","bundle"].includes(s.selection.kind) && typeof s.selection.name === "string"
        && (isLegacyLung(s.selection.ids) || (Array.isArray(s.selection.ids) && s.selection.ids.length === 1 && retiredLungIds.includes(s.selection.ids[0])))) {
        s.selection = { kind: "bundle", ids: branchGroup.ids, name: branchGroup.name };
        s.layers = layers;
        s.isolated = false;
      }
    }
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
    // Older explicit deselections could leave a comparison highlight without
    // its selection card. Keep valid selections within a comparison intact.
    if (!s.selection) s.comparison = null;
    if (!s.selection || s.detail || s.comparison) s.selectionReturn = null;
    if (s.detail && (!s.detail.ids?.length || typeof s.detail.name !== "string" || typeof s.detail.id !== "string" || !keys.every(key => typeof s.detail!.layers?.[key] === "boolean") || !s.detail.ids.every(id => assets.some(a => a.id === id && (!a.sex || a.sex === s.sex))))) return base;
    if (hasMixedReferenceFrames(s.sex, [...(s.selection?.ids || []), ...(s.detail?.ids || [])])) return base;
    const currentLungIds = maleDetailGroups.find(group => group.id === "lung")?.ids || [];
    const lungViewIds = [...(s.selection?.ids || []), ...(s.detail?.ids || [])];
    if (s.sex === "male" && lungViewIds.some(id => currentLungIds.includes(id))
      && lungViewIds.some(id => branchGroup?.ids.includes(id))) return base;
    const pancreasViews = maleDetailGroups.filter(group => group.id === "pancreas" || group.id === "pancreas-parenchyma");
    const pancreasViewIds = [...(s.selection?.ids || []), ...(s.detail?.ids || [])];
    if (s.sex === "male" && pancreasViews.length === 2
      && pancreasViews.every(group => pancreasViewIds.some(id => group.ids.includes(id)))) return base;
    if (!validCamera(s.camera)) return base;
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
    // A saved close-up may point to the pre-correction opposite hemisphere.
    // Refit only an affected selection on its first source-version migration.
    // Complete pair/bundle selections have unchanged bounds and keep the pose.
    if(s.brainBindingVersion!==femaleBrainBindings.version&&s.sex==="female"){
      const selected=new Set(s.selection?.ids||[]);
      if(femaleBrainBindings.records.some(r=>selected.has(r.id)!==selected.has(r.partnerId)))s.camera=null;
    }
    s.brainBindingVersion=femaleBrainBindings.version;
    if(s.pelvicBindingVersion!==femalePelvicBindings.version&&s.sex==="female"){
      const selected=new Set(s.selection?.ids||[]);
      if(femalePelvicBindings.records.some(r=>selected.has(r.id)!==selected.has(r.partnerId)))s.camera=null;
    }
    s.pelvicBindingVersion=femalePelvicBindings.version;
    // Repair an obsolete height-based scope only when it would hide one selected
    // source organ. Keep valid whole/parent views, detail frames and comparisons.
    if (!s.detail && !s.comparison && s.selection?.kind === "structure" && s.selection.ids.length === 1) {
      const asset = assets.find(a => a.id === s.selection!.ids[0]);
      const region = asset && sourceOrganRegion(asset);
      if (region && !["whole", region, region === "pelvis" ? "lower-body" : "upper-body"].includes(s.anatomyRegion))
        s.anatomyRegion = region;
    }
    return { ...s, filters: { ...base.filters, ...s.filters } };
  } catch {
    return base;
  }
}
