// A source frame is a rendering boundary, not just a display label. Never
// superimpose CT detail geometry on the independently sourced HRA overview.
export function referenceSourceFor(sex: "male" | "female", ids: readonly string[]) {
  if (sex === "female") return ids.some(id => id.startsWith("CTF_")) ? "female-detail" : "female";
  return ids.some(id => id.startsWith("BP4_")) ? "male-detail" : "male";
}

export function hasMixedReferenceFrames(sex: "male" | "female", ids: readonly string[]) {
  return new Set(ids.map(id => referenceSourceFor(sex, [id]))).size > 1;
}
