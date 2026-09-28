// Editorial region labels for the named limb skeleton, not a segmentation or
// registration algorithm. Limit these terms to the bone layer: a radial nerve
// or the head of a nucleus must not be classified from a bone-name substring.
export function limbSkeletonRegion(structure: { layer: string; name: string }) {
  if (structure.layer !== "bone") return undefined;
  if (/\b(finger|thumb|metacarpal|carpal|humerus|radius|ulna|clavicle|scapula|capitate|hamate|lunate|pisiform|scaphoid|trapezium|trapezoid|triquetral|forearm)\b/i.test(structure.name)) return "upper-limb" as const;
  if (/\b(toe|foot|metatarsal|tarsal|femur|tibia|fibula|patella|talus|calcaneus|cuboid|cuneiform|navicular|leg|plantar)\b/i.test(structure.name)) return "lower-limb" as const;
  return undefined;
}

export type AnatomyRegion = "whole" | "head" | "upper-body" | "lower-body" | "upper-limb" | "lower-limb" | "chest" | "abdomen" | "pelvis";
export type RegionBounds = [ArrayLike<number>, ArrayLike<number>];

// UI organ scopes, keyed by audited source membership (not name substrings).
// An organ can project beneath the ribs without belonging to the chest scope.
// Transregional groups (intestine, spinal cord, CT collections) are not mapped.
// Sources and limitations: docs/anatomy-alignment/ORGAN_REGIONS.md.
export const sourceOrganRegions = {
  brain: "head", heart: "chest", lung: "chest", "lung-branches": "chest", "lung-internal": "chest", "tracheobronchial-tree": "chest", breast: "chest",
  liver: "abdomen", kidney: "abdomen", stomach: "abdomen", pancreas: "abdomen", "pancreas-parenchyma": "abdomen", gallbladder: "abdomen", spleen: "abdomen",
  uterus: "pelvis", ovary: "pelvis", "uterine-tube": "pelvis", vagina: "pelvis", bladder: "pelvis",
} as const satisfies Record<string, AnatomyRegion>;
export function sourceOrganRegion(structure: { layer: string; group?: string }) {
  return structure.group && Object.hasOwn(sourceOrganRegions, structure.group)
    ? sourceOrganRegions[structure.group as keyof typeof sourceOrganRegions] : undefined;
}

export function anatomyRegionMatches(bounds: RegionBounds, region: AnatomyRegion, structure?: { layer: string; name: string; group?: string }) {
  if (region === "whole") return true;
  const limb = structure && limbSkeletonRegion(structure);
  // Hanging hands are still upper limbs, regardless of their height or pose.
  // Shoulder girdles belong to this UI's arm/hand scope too.
  if (limb) return region === limb || region === (limb === "upper-limb" ? "upper-body" : "lower-body");
  const organ = structure && sourceOrganRegion(structure);
  if (organ) return region === organ || region === (organ === "pelvis" ? "lower-body" : "upper-body");
  // Unreviewed structures retain the existing geometric overlap heuristic.
  // In particular this is not a clinically validated organ/nerve region map.
  const [min, max] = bounds;
  if (region === "head") return max[1] >= 1.42;
  if (region === "upper-body") return max[1] >= .82;
  if (region === "lower-body") return min[1] < .92;
  if (region === "upper-limb") return (max[0] >= .18 || min[0] <= -.18) && max[1] >= .72;
  if (region === "lower-limb") return (max[0] >= .07 || min[0] <= -.07) && min[1] < .82;
  if (region === "chest") return max[1] >= 1.05 && min[1] < 1.42;
  if (region === "abdomen") return max[1] >= .78 && min[1] < 1.08;
  return max[1] >= .55 && min[1] < .82;
}
