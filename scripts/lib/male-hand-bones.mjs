// Named hand-bone pairs between the Z-Anatomy (Anatria-3D) male skeleton and
// the BodyParts3D male skeleton used by the base model. Z-Anatomy numbers the
// fingers first (thumb) to fifth (little); BodyParts3D names them.
const fingers = [["first", "thumb"], ["second", "index finger"], ["third", "middle finger"], ["fourth", "ring finger"], ["fifth", "little finger"]];
const ordinals = ["first", "second", "third", "fourth", "fifth"];
const carpals = [["Scaphoid", "scaphoid"], ["Lunate", "lunate"], ["Triquetrum", "triquetral"], ["Pisiform", "pisiform"],
  ["Trapezium", "trapezium"], ["Trapezoid", "trapezoid"], ["Capitate", "capitate"], ["Hamate", "hamate"]];

export function handBonePairs(side) {
  const s = side === "right" ? "r" : "l", pairs = [];
  for (const [z, b] of carpals) pairs.push({ source: `${z} bone.${s}`, target: `${side} ${b}`, segment: "carpus" });
  for (const ordinal of ordinals) pairs.push({ source: `${ordinal[0].toUpperCase()}${ordinal.slice(1)} metacarpal bone.${s}`, target: `${side} ${ordinal} metacarpal bone`, segment: `metacarpal ${ordinal}` });
  for (const [ordinal, finger] of fingers) for (const phalanx of ["Proximal", "Middle", "Distal"]) {
    if (finger === "thumb" && phalanx === "Middle") continue;
    pairs.push({ source: `${phalanx} phalanx of ${ordinal} finger of hand.${s}`, target: `${phalanx.toLowerCase()} phalanx of ${side} ${finger}`, segment: `${phalanx.toLowerCase()} ${ordinal}` });
  }
  return pairs;
}
