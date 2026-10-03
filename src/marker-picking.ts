// Acupoint markers are drawn only a few pixels wide, so their pointer target is
// a larger circle on screen: a near miss must not fall through to the skin or
// organ underneath. A hovered marker keeps a still larger circle while the
// pointer wobbles, and in a crowded spot the marker nearest the pointer on
// screen wins, not the one nearest the camera. Once the skin is peeled away
// the markers float over muscles and organs, which are then click targets
// too, so the circles shrink ("over tissue").
export const MARKER_HIT_PX = { fine: 14, coarse: 22, hovered: 22 } as const;
export const MARKER_HIT_OVER_TISSUE_PX = { fine: 9, coarse: 14, hovered: 14 } as const;
// A press that travelled further than this was a camera drag, not a pick.
export const CLICK_SLOP_PX = { fine: 6, coarse: 12 } as const;

type Vec = { x: number; y: number; z: number };
export type MarkerHit = { index: number; depth: number; pixels: number };

export const coarsePointer = (pointerType: string | undefined) => pointerType === "touch" || pointerType === "pen";

export function hitRadius(pointerType: string | undefined, hovered: boolean, overTissue = false) {
  const px = overTissue ? MARKER_HIT_OVER_TISSUE_PX : MARKER_HIT_PX;
  return Math.max(coarsePointer(pointerType) ? px.coarse : px.fine, hovered ? px.hovered : 0);
}

// Drawn dot radius in pixels: easy to see when zoomed in without crowding the
// whole-body view, where hundreds of markers are on screen.
export function markerDotPx(distance: number) {
  return Math.min(6.5, Math.max(3.6, 2.8 + 1.8 / Math.max(distance, 0.05)));
}

export function isDragRelease(delta: number | undefined, pointerType: string | undefined) {
  return (delta ?? 0) > (coarsePointer(pointerType) ? CLICK_SLOP_PX.coarse : CLICK_SLOP_PX.fine);
}

// The 3D click's own `delta` only compares where a press began and ended, so
// an orbit drag that came back near its start would still count as a click.
// The canvas reports the furthest the pointer travelled during the press.
const press = { x: 0, y: 0, travel: 0, id: -1 };
export function trackPresses(target: HTMLElement) {
  const down = (e: PointerEvent) => Object.assign(press, { x: e.clientX, y: e.clientY, travel: 0, id: e.pointerId });
  const move = (e: PointerEvent) => {
    if (e.pointerId === press.id && e.buttons) press.travel = Math.max(press.travel, Math.hypot(e.clientX - press.x, e.clientY - press.y));
  };
  target.addEventListener("pointerdown", down, true);
  target.addEventListener("pointermove", move, true);
  return () => { target.removeEventListener("pointerdown", down, true); target.removeEventListener("pointermove", move, true); };
}
export const releasedDragPress = (delta: number | undefined, pointerType: string | undefined) =>
  isDragRelease(Math.max(delta ?? 0, press.travel), pointerType);

// `direction` is normalised; `pixelAtUnitDepth` is the world size of one
// screen pixel one unit in front of the camera (the marker sizing uses it too).
export function nearestMarker(origin: Vec, direction: Vec, positions: readonly Vec[], shown: readonly boolean[],
  pixelAtUnitDepth: number, radius: (index: number) => number): MarkerHit | null {
  let best: MarkerHit | null = null;
  for (let index = 0; index < positions.length; index++) {
    if (!shown[index]) continue;
    const p = positions[index];
    const dx = p.x - origin.x, dy = p.y - origin.y, dz = p.z - origin.z;
    const depth = dx * direction.x + dy * direction.y + dz * direction.z;
    if (depth <= 0) continue;
    const pixels = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - depth * depth)) / (depth * pixelAtUnitDepth);
    if (pixels > radius(index)) continue;
    // Bilateral and stacked points can coincide on screen; then the front one.
    if (!best || pixels < best.pixels - .5 || (pixels <= best.pixels + .5 && depth < best.depth)) best = { index, depth, pixels };
  }
  return best;
}

// Markers are drawn above the body, so a hit on one wins over tissue that is
// in front of or behind it along the same ray.
export function markersFirst<T extends { object: { userData: Record<string, unknown> } }>(hits: T[]): T[] {
  const markers = hits.filter((hit) => hit.object.userData.acupointMarkers);
  return markers.length ? [...markers, ...hits.filter((hit) => !hit.object.userData.acupointMarkers)] : hits;
}
