import { BufferAttribute, BufferGeometry, Matrix4, Mesh } from "three";
import maleSkin from "../data/modesty-male-skin.json" with { type: "json" };

// "성기 가리기" on the male skin: the penis and scrotum are left out of the
// skin's triangles and a smooth surface closes the groin in their place
// (scripts/modesty/, docs/anatomy-alignment/MODESTY_DEFAULT.md). Only the
// 3D scene imports this module.
export const PATCH_NAME = "modesty-patch";
type ModestSkin = { full: BufferGeometry; modest: BufferGeometry; patch: Mesh };
type Anchor = { key: string; position: number[]; surfacePoint?: number[] };

// Markers that sat on the removed skin, carried onto the closed surface along
// their own placement ray.
const moved = new Map(((maleSkin as { anchors?: Anchor[] }).anchors ?? []).map((a) => [a.key, a]));
export const modestAnchors = <T extends Anchor>(list: T[]): T[] =>
  list.map((a) => { const m = moved.get(a.key); return m ? { ...a, position: m.position, surfacePoint: m.surfacePoint } : a; });

// Called once per loaded skin mesh, after its material is set: the patch shares
// that material, so it takes the skin's colour, opacity and clipping.
export function prepareModestSkin(skin: Mesh) {
  const full = skin.geometry as BufferGeometry, index = full.getIndex();
  if (!index || index.count / 3 !== maleSkin.source.triangles) throw new Error("male skin does not match data/modesty-male-skin.json");
  const hidden = new Uint8Array(index.count / 3);
  for (const t of maleSkin.hiddenTriangles) hidden[t] = 1;
  const kept = new Uint32Array(index.count - maleSkin.hiddenTriangles.length * 3);
  for (let t = 0, k = 0; t < hidden.length; t++) if (!hidden[t]) for (let j = 0; j < 3; j++) kept[k++] = index.getX(3 * t + j);
  const modest = new BufferGeometry();
  modest.setAttribute("position", full.getAttribute("position"));
  modest.setAttribute("normal", full.getAttribute("normal"));
  modest.setIndex(new BufferAttribute(kept, 1));
  modest.boundingBox = full.boundingBox;
  modest.boundingSphere = full.boundingSphere;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(maleSkin.patch.positions), 3));
  geometry.setAttribute("normal", new BufferAttribute(new Float32Array(maleSkin.patch.normals), 3));
  geometry.setIndex(maleSkin.patch.indices);
  // The data is in the scene frame; the patch hangs under the skin mesh.
  skin.updateWorldMatrix(true, false);
  geometry.applyMatrix4(new Matrix4().copy(skin.matrixWorld).invert());
  const patch = new Mesh(geometry, skin.material);
  patch.name = PATCH_NAME;
  patch.visible = false;
  skin.add(patch);
  skin.userData.modestSkin = { full, modest, patch } satisfies ModestSkin;
}

// Swap the skin's triangles and show the patch with the skin. Returns whether
// the closed groin is drawn.
export function applyModestSkin(skin: Mesh, hidden: boolean) {
  const modestSkin = skin.userData.modestSkin as ModestSkin | undefined;
  if (!modestSkin) return false;
  skin.geometry = hidden ? modestSkin.modest : modestSkin.full;
  modestSkin.patch.visible = hidden && skin.visible;
  return modestSkin.patch.visible;
}
