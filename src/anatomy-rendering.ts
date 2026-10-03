// Ligaments, joint structures and tendons: pale steel, apart from ivory bone
// and red muscle, and from the cyan selection and gold comparison emphasis.
export const CONNECTIVE_COLOR = "#a9c3d1";
import { Mesh, MeshStandardMaterial, Plane, Vector3, type Intersection } from "three";
import type { AtlasProps } from "./Atlas";
import type { Layer } from "./anatomy";
import { releasedDragPress } from "./marker-picking.ts";

// Releasing an orbit drag over the body is not a pick (see marker-picking.ts).
export type SceneClick = { stopPropagation: () => void; object: Mesh; point: Vector3; intersections: Intersection[]; delta: number; nativeEvent: MouseEvent };
export const releasedDrag = (event: SceneClick) => releasedDragPress(event.delta, (event.nativeEvent as PointerEvent).pointerType);

export function clippingPlanes(layer: Layer, props: AtlasProps) {
  const planes: Plane[] = [];
  if (props.cutaway > 0) planes.push(new Plane(new Vector3(0, 0, -1), .22 - props.cutaway * .44));
  if (layer === "skin" && props.displayMode === "dissection" && props.dissection > 8 && props.dissection < 20) {
    // A front-to-back cut removes the surface progressively without moving organs.
    planes.push(new Plane(new Vector3(0, 0, -1), .24 - ((props.dissection - 8) / 12) * .5));
  }
  return planes;
}

export function configurePicking(mesh: Mesh, layer: Layer, target: AtlasProps["selectionTarget"]) {
  mesh.raycast = (raycaster, intersections) => {
    const material = mesh.material as MeshStandardMaterial;
    if (!mesh.visible || material.opacity < .05 || (target === "internal" && layer === "skin") || (target === "skin" && layer !== "skin")) return;
    const hits: Intersection[] = [];
    Mesh.prototype.raycast.call(mesh, raycaster, hits);
    intersections.push(...hits.filter(hit => !material.clippingPlanes?.some(plane => plane.distanceToPoint(hit.point) < 0)));
  };
}
