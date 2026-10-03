import { MeshoptSimplifier } from "meshoptimizer";

// The whole-body skin is simplified ~35x. At that budget the thin fingers and
// toes lose ~1 mm of surface, enough for the digital vessels, nerves and joint
// capsules that sit just under the real skin to show through the simplified
// one. Hands and feet are therefore simplified first to a finer absolute
// error with the rest of the body locked, then the rest of the body is
// simplified to its previous budget with the hands and feet locked. Locking
// keeps the shared boundary identical in both passes, so no seam can open.
// `boxes` are axis-aligned [min, max] boxes in the source (mm) coordinates.
export function simplifyWithDetail(indices, positions, { boxes, detailErrorMm, bodyTarget, bodyError }) {
  const vertices = positions.length / 3, inDetail = new Uint8Array(vertices);
  for (let v = 0; v < vertices; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    inDetail[v] = boxes.some(([min, max]) => x >= min[0] && x <= max[0] && y >= min[1] && y <= max[1] && z >= min[2] && z <= max[2]) ? 1 : 0;
  }
  const none = new Float32Array(vertices);
  // Pass 1: only hand and foot vertices may move or collapse.
  const lockBody = new Uint8Array(vertices);
  for (let v = 0; v < vertices; v++) lockBody[v] = inDetail[v] ? 0 : 1;
  const [first, detailError] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, none, 1, [0], lockBody, 0, detailErrorMm, ["ErrorAbsolute", "Prune"]);
  // Pass 2: hands and feet are locked; the rest keeps its earlier budget.
  let detailIndices = 0;
  for (let i = 0; i < first.length; i += 3) if (inDetail[first[i]] || inDetail[first[i + 1]] || inDetail[first[i + 2]]) detailIndices += 3;
  const [second, error] = MeshoptSimplifier.simplifyWithAttributes(first, positions, 3, none, 1, [0], inDetail, bodyTarget + detailIndices, bodyError, ["Prune"]);
  return { indices: second, error, detailErrorMm: detailError };
}
