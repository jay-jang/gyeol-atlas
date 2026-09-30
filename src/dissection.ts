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

// The outermost layer still present at this depth.
export function depthStage(depth: number) {
  return peelOrder.findIndex(layer => dissectionLayerOpacity(layer, depth) > 0);
}

export function musclePeelOpacity(depth: number, rank: number) {
  return 1 - ramp(depth, 24 + rank * 36, 28 + rank * 36);
}
