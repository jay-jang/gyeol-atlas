import { MeshoptSimplifier } from "meshoptimizer";

// The whole-body skin is simplified ~35x. At that budget thin parts lose
// about 1 mm of surface, enough for structures that sit just under the real
// skin to show through the simplified one: digital vessels, nerves and joint
// capsules in the fingers and toes, scalp and facial muscles on the head.
// Each detail region is therefore simplified first to its own absolute error
// with everything else locked, then the rest of the body is simplified to its
// previous budget with every detail region locked. Locking keeps each shared
// boundary identical across passes, so no seam can open.
// `regions` are [{ boxes: [[min, max]...] in source mm, errorMm }].
export function simplifyWithDetail(indices, positions, { regions, bodyTarget, bodyError }) {
  const vertices = positions.length / 3, owner = new Int8Array(vertices).fill(-1);
  for (let v = 0; v < vertices; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    // A vertex belongs to the first region whose box holds it.
    owner[v] = regions.findIndex((r) => r.boxes.some(([min, max]) => x >= min[0] && x <= max[0] && y >= min[1] && y <= max[1] && z >= min[2] && z <= max[2]));
  }
  const none = new Float32Array(vertices), errors = [];
  let current = indices;
  regions.forEach((region, index) => {
    // Only this region's vertices may move or collapse.
    const lock = new Uint8Array(vertices);
    for (let v = 0; v < vertices; v++) lock[v] = owner[v] === index ? 0 : 1;
    const [next, error] = MeshoptSimplifier.simplifyWithAttributes(current, positions, 3, none, 1, [0], lock, 0, region.errorMm, ["ErrorAbsolute", "Prune"]);
    current = next; errors.push(error);
  });
  // The rest keeps its earlier budget; every detail region is locked.
  let detailIndices = 0;
  for (let i = 0; i < current.length; i += 3) if (owner[current[i]] >= 0 || owner[current[i + 1]] >= 0 || owner[current[i + 2]] >= 0) detailIndices += 3;
  const lockDetail = new Uint8Array(vertices);
  for (let v = 0; v < vertices; v++) lockDetail[v] = owner[v] >= 0 ? 1 : 0;
  const [result, error] = MeshoptSimplifier.simplifyWithAttributes(current, positions, 3, none, 1, [0], lockDetail, bodyTarget + detailIndices, bodyError, ["Prune"]);
  return { indices: result, error, regionErrorsMm: errors };
}
