export interface ScreenSize { width: number; height: number }

// Screen placement for an acupoint label beside its marker. A fixed world
// offset grows with zoom, so a close comparison pushed the active label past
// the canvas edge on mobile. Keep the outward side when it fits, flip when it
// would clip, then clamp inside the canvas. A marker outside the canvas keeps
// its label outside too, so a pinned edge label never implies a location.
export function besideMarker(marker: readonly [number, number], outward: number, label: ScreenSize,
  canvas: ScreenSize, gap = 10, margin = 4): [number, number] {
  const half = label.width / 2, halfHeight = label.height / 2;
  const centre = (side: number) => marker[0] + side * (gap + half);
  const inside = (x: number) => x - half >= margin && x + half <= canvas.width - margin;
  const side = outward < 0 ? -1 : 1;
  const x = inside(centre(side)) || !inside(centre(-side)) ? centre(side) : centre(-side);
  const onCanvas = marker[0] >= 0 && marker[0] <= canvas.width && marker[1] >= 0 && marker[1] <= canvas.height;
  if (!onCanvas) return [x, marker[1]];
  const clamp = (value: number, low: number, high: number) => low > high ? (low + high) / 2 : Math.min(high, Math.max(low, value));
  return [clamp(x, margin + half, canvas.width - margin - half), clamp(marker[1], margin + halfHeight, canvas.height - margin - halfHeight)];
}
