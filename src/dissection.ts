export type AnatomyLayerName = "skin" | "muscle" | "bone" | "organ" | "vessel" | "lymph" | "nerve";
export const stageDepth = [0, 25, 48, 66, 78, 88, 98] as const;
export const quantizeDepth = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 2) / 2;
const ramp = (value: number, start: number, end: number) => Math.max(0, Math.min(1, (value - start) / (end - start)));

// Ordered display sequence; organs, vessels and nerves occupy overlapping real depths.
// This changes visibility only. Coordinates are never altered by peeling.
export function dissectionLayerOpacity(layer: AnatomyLayerName, depth: number, progressive = true) {
  if (!progressive) return 1;
  switch (layer) {
    case "skin": return 1 - ramp(depth, 8, 20);
    // Per-mesh schedules finish by 64. An earlier whole-layer fade would
    // start fading a constrained deep muscle while its covering one remains.
    case "muscle": return ramp(depth, 8, 18) * (1 - ramp(depth, 64, 68));
    case "bone": return ramp(depth, 34, 44) * (1 - ramp(depth, 56, 70) * .92);
    case "organ": return ramp(depth, 52, 62) * (1 - ramp(depth, 72, 84));
    case "vessel": return ramp(depth, 68, 78) * (1 - ramp(depth, 84, 94) * .88);
    case "lymph": return ramp(depth, 80, 88) * (1 - ramp(depth, 92, 99) * .82);
    case "nerve": return ramp(depth, 88, 98);
  }
}

export function dissectionLayers(depth: number) {
  return Object.fromEntries((["skin", "muscle", "bone", "organ", "vessel", "lymph", "nerve"] as const)
    .map(layer => [layer, dissectionLayerOpacity(layer, depth) > 0])) as Record<AnatomyLayerName, boolean>;
}

export function musclePeelOpacity(depth: number, rank: number) {
  return 1 - ramp(depth, 24 + rank * 36, 28 + rank * 36);
}
