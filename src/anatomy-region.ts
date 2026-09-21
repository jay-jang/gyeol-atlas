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

export function anatomyRegionMatches(bounds: RegionBounds, region: AnatomyRegion, structure?: { layer: string; name: string }) {
  if (region === "whole") return true;
  const limb = structure && limbSkeletonRegion(structure);
  // Hanging hands are still upper limbs, regardless of their height or pose.
  // Shoulder girdles belong to this UI's arm/hand scope too.
  if (limb) return region === limb || region === (limb === "upper-limb" ? "upper-body" : "lower-body");
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
