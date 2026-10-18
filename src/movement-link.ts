// Links between the movement page and the 3D atlas (CONSENSUS §6).
// `#atlas/structure/<sex>/<id>+<id>/<name>` names real ids of one body; the atlas
// opens them once through view-state ("open-structures"), fits the camera
// once and replaces the address so a reload only restores the saved view.

export type Sex = "male" | "female";
type Catalogue = readonly { id: string; sex: Sex }[];

export const structureLink = (sex: Sex, ids: string[], name: string) =>
  `#atlas/structure/${sex}/${ids.map(encodeURIComponent).join("+")}/${encodeURIComponent(name)}`;

export function parseStructureLink(route: string): { sex: Sex; ids: string[]; name: string } | null {
  const match = /^atlas\/structure\/(male|female)\/([^/]+)(?:\/([^/]*))?$/.exec(route);
  if (!match) return null;
  try {
    const ids = match[2].split("+").map((id) => decodeURIComponent(id)).filter(Boolean);
    return ids.length ? { sex: match[1] as Sex, ids, name: decodeURIComponent(match[3] || "") } : null;
  } catch {
    return null;
  }
}

// The ids to open in one body: male source ids as they are; in the female
// body the carried copy (FT_<id>) or an explicit whole-structure match.
// Returns null when any part is missing, so nothing is silently replaced.
export function idsForSex(maleIds: string[], sex: Sex, catalogue: Catalogue, female?: string[]): string[] | null {
  const has = (id: string) => catalogue.some((s) => s.id === id && s.sex === sex);
  if (sex === "male") return maleIds.every(has) ? maleIds : null;
  if (female?.length) return female.every(has) ? female : null;
  const carried = maleIds.map((id) => `FT_${id}`);
  return carried.every(has) ? carried : null;
}

// One-shot camera request: set when a link is followed, taken by the atlas
// effect that frames a new selection.
let focusRequest = "";
export const requestFocus = (ids: string[]) => { focusRequest = ids.join("|"); };
export function takeFocus(selectionKey: string) {
  if (!focusRequest || focusRequest !== selectionKey) return false;
  focusRequest = "";
  return true;
}

// Where the viewer came from, so the atlas card can link back.
const ORIGIN_KEY = "gyeol-movement-origin";
export type MovementOrigin = { href: string; label: string; ids: string[]; scroll?: number };
export function saveOrigin(origin: MovementOrigin) {
  try { sessionStorage.setItem(ORIGIN_KEY, JSON.stringify(origin)); } catch {}
}
export function readOrigin(): MovementOrigin | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(ORIGIN_KEY) || "null");
    return value && typeof value.href === "string" && value.href.startsWith("#movement")
      && typeof value.label === "string" && Array.isArray(value.ids) ? value : null;
  } catch {
    return null;
  }
}
