import { Matrix4, Mesh, MeshStandardMaterial, SphereGeometry } from "three";

// "성기 가리기": hide the external genital structures and lay a plain, smooth
// cover over that region of the skin. A display preference only; search still
// finds every structure and a structure chosen explicitly is shown.
const GENITAL_IDS = new Set([
  // BodyParts3D male: glans, corpus spongiosum, corpus cavernosum, testes,
  // epididymides, the deferent ducts that run down into the scrotum and the
  // urethra (one mesh, its penile part included)
  "FMA18247", "FMA19617nsn", "FMA19618", "FMA7211", "FMA7212", "FMA18256", "FMA18257", "FMA19235", "FMA19236", "FMA19667",
  // HRA female: vagina
  "HRAF0406",
]);
const GENITAL_NAME = /penis|penile|scrot|testi(s|cular)|glans|epididym|deferen|spermatic|cremaster|clitor|labia|vulva/i;
export const isGenitalStructure = (id: string, name = "") => GENITAL_IDS.has(id) || GENITAL_NAME.test(name);

// Ellipsoids around the external genitalia of each reference body (metres,
// scene frame), measured from the source meshes: the male penis and scrotal
// contents are enclosed; on the female the cap rises a few millimetres above
// the vulval skin below the pubic symphysis. Inside the body the skin hides
// the rest of the ellipsoid, so only a smooth outer cap shows.
export const COVER_REGIONS = {
  male: { center: [0, 0.752, 0.042], radii: [0.048, 0.064, 0.072] },
  female: { center: [0, 0.748, -0.022], radii: [0.042, 0.058, 0.068] },
} as const;
export const COVER_COLOR = "#3b4c58";
export const COVER_NAME = "modesty-cover";

// The cover is added under the skin mesh, so it follows the skin's visibility
// and opacity; it is expressed in that mesh's local frame.
export function buildCover(skin: Mesh, sex: keyof typeof COVER_REGIONS) {
  const region = COVER_REGIONS[sex];
  const mesh = new Mesh(new SphereGeometry(1, 48, 32), new MeshStandardMaterial({ color: COVER_COLOR, roughness: 0.9, metalness: 0 }));
  mesh.scale.set(region.radii[0], region.radii[1], region.radii[2]);
  mesh.position.set(region.center[0], region.center[1], region.center[2]);
  skin.updateWorldMatrix(true, false);
  mesh.applyMatrix4(new Matrix4().copy(skin.matrixWorld).invert());
  mesh.name = COVER_NAME;
  mesh.raycast = () => {};
  mesh.visible = false;
  return mesh;
}
