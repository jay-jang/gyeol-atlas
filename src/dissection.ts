export type AnatomyLayerName = "skin" | "muscle" | "bone" | "organ" | "vessel" | "lymph" | "nerve";
export const peelOrder = ["skin", "muscle", "bone", "organ", "vessel", "lymph", "nerve"] as const;
// Depth at which each layer becomes the outermost one still present.
export const stageDepth = [0, 20, 68, 76, 84, 90, 95] as const;
export const quantizeDepth = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 2) / 2;
const ramp = (value: number, start: number, end: number) => Math.max(0, Math.min(1, (value - start) / (end - start)));

// Every system is present from 0%; peeling removes the outermost remaining
// one, so a deeper system never appears late. Skin, then each muscle mesh by
// its source-backed rank (24–64), then bone, organs, vessels and lymph; nerves
// remain. This is an educational display order and changes visibility only.
// Coordinates are never altered by peeling.
export function dissectionLayerOpacity(layer: AnatomyLayerName, depth: number, progressive = true) {
  if (!progressive) return 1;
  switch (layer) {
    case "skin": return 1 - ramp(depth, 8, 20);
    // Per-mesh schedules finish by 64. An earlier whole-layer fade would
    // start fading a constrained deep muscle while its covering one remains.
    case "muscle": return 1 - ramp(depth, 64, 68);
    case "bone": return 1 - ramp(depth, 68, 76);
    case "organ": return 1 - ramp(depth, 76, 84);
    case "vessel": return 1 - ramp(depth, 84, 90);
    case "lymph": return 1 - ramp(depth, 90, 95);
    case "nerve": return 1;
  }
}

export function dissectionLayers(depth: number) {
  return Object.fromEntries(peelOrder
    .map(layer => [layer, dissectionLayerOpacity(layer, depth) > 0])) as Record<AnatomyLayerName, boolean>;
}

// "계통 빼기": systems left out of the peel are not drawn at any depth. The
// order and depths of the others stay, and the peel stops where the innermost
// included system would begin to go, so the scene is never empty. Display
// choice only, like the peel itself.
// Muscles: 56 is the latest start of the last ranked muscle in the emptiest
// body region (male arm, measured 2026-10-22; every region of both bodies
// keeps a muscle there). The arm has no organs, so there the next included
// system outside them sets the stop (tests/browser/system-exclusion.spec.ts).
const peelEnd: Record<AnatomyLayerName, number> = { skin: 8, muscle: 56, bone: 68, organ: 76, vessel: 84, lymph: 90, nerve: 100 };
const absentIn: Partial<Record<AnatomyLayerName, readonly string[]>> = { organ: ["upper-limb"] };
export function peelLimit(excluded: readonly AnatomyLayerName[] = [], region = "whole") {
  const innermost = [...peelOrder].reverse().find(layer => !excluded.includes(layer) && !absentIn[layer]?.includes(region))
    ?? [...peelOrder].reverse().find(layer => !excluded.includes(layer));
  return innermost ? peelEnd[innermost] : 100;
}
export function peelLayers(depth: number, excluded: readonly AnatomyLayerName[] = []) {
  const layers = dissectionLayers(depth);
  for (const layer of excluded) layers[layer] = false;
  return layers;
}

// The outermost layer still present (and not left out) at this depth.
export function depthStage(depth: number, excluded: readonly AnatomyLayerName[] = []) {
  return peelOrder.findIndex(layer => !excluded.includes(layer) && dissectionLayerOpacity(layer, depth) > 0);
}

export function musclePeelOpacity(depth: number, rank: number) {
  return 1 - ramp(depth, 24 + rank * 36, 28 + rank * 36);
}

// Within the organ window (76–84) the progressive peel lifts what covers the
// pelvic viscera first. This is an editorial order for observation, not a
// verified dissection sequence for every organ; it follows the relations the
// source gives: the greater omentum "obscures the other viscera" and coils of
// small intestine and the sigmoid colon rest on the uterus (rank 0: omentum,
// jejunum, ileum, colon without the rectum, 76–78); the female peritoneum over
// the uterus, tubes and ovaries — the broad ligament's folds and the lining of
// the uterovesical pouch (rank 1, 78–79); then every other organ (rank 2,
// 79–84). Gray's Anatomy, 20th ed. (1918), pp. 1149 and 1259;
// data/female-organ-display.json lists the members. At 76 every organ is still opaque, so the stop and the peel
// limit stay; selected or isolated organs are drawn as before.
export function organPeelOpacity(depth: number, rank: 0 | 1 | 2) {
  return rank === 0 ? 1 - ramp(depth, 76, 78) : rank === 1 ? 1 - ramp(depth, 78, 79) : 1 - ramp(depth, 79, 84);
}
