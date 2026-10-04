// Ligaments, joint structures and tendons: pale steel, apart from ivory bone
// and red muscle, and from the cyan selection and gold comparison emphasis.
export const CONNECTIVE_COLOR = "#a9c3d1";
export const SKIN_COLOR = "#b9826f";
// BodyParts3D meshes that are themselves the outer surface of the face:
// the auricle and lips are skin-covered in the body, and the eye shows its
// white. While the skin is drawn they take that look instead of the organ
// colour; peeled or selected, they show their system colour again.
export const SURFACE_TONES: Record<string, string> = {
  FMA52780: SKIN_COLOR, // ear (auricle)
  FMA59815nsn: SKIN_COLOR, // labial part of mouth (lips)
  FMA12513: "#e2dbcf", // eyeball (visible sclera)
  // These meet the eyelid and nostril skin inside BodyParts3D itself: up to
  // ~0.9 mm through it even against the unsimplified source skin. They are not
  // moved; where they touch the surface they read as skin while it is drawn.
  FMA46782: SKIN_COLOR, // orbital part of right orbicularis oculi
  FMA46783: SKIN_COLOR, // orbital part of left orbicularis oculi
  FMA71704: SKIN_COLOR, // set of nasal cartilages
  // Female (HRA): the fibulae and the right fibular collateral ligament cross
  // the HRA skin in the source itself; the borrowed alar cartilages are the
  // nose's surface. Borrowed bones and carried structures that touch the male
  // skin in their source are listed by the transport manifest.
  HRAF0928: SKIN_COLOR, HRAF0955: SKIN_COLOR, HRAF0908: SKIN_COLOR, BM0000: SKIN_COLOR, BM0001: SKIN_COLOR,
};
// The Z-Anatomy nervous export carries its own eyeball parts. While the
// BodyParts3D eyeball is drawn they are a second eye in the same place (the
// two models differ by ~2 mm), so they stay hidden unless selected; once the
// organs are peeled they show the eye.
export const isSupplementEyePart = (name: string) =>
  /^(Cornea|Sclera|Iris|Lens|Retina|Vitreous body|Anterior chamber of eyeball|Suspensory ligament of eyeball|Anterior segment of eyeball|Posterior segment of eyeball) \((left|right)\)$/.test(name);
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
