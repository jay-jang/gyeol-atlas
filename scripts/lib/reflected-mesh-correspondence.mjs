import assert from 'node:assert/strict';

function validate(mesh) {
  assert.ok(mesh.positions.length > 0 && mesh.positions.length % 3 === 0);
  assert.ok(mesh.positions.every(Number.isFinite));
  assert.ok(mesh.indices.length > 0 && mesh.indices.length % 3 === 0);
  assert.ok(mesh.indices.every(i => Number.isInteger(i) && i >= 0 && i < mesh.positions.length / 3));
}
function triangleKey(a, b, c, oriented) {
  if (!oriented) return [a, b, c].sort((x, y) => x - y).join(',');
  return [`${a},${b},${c}`, `${b},${c},${a}`, `${c},${a},${b}`].sort()[0];
}
function matchedTriangles(left, right, mapping, reverse, oriented) {
  const counts = new Map();
  for (let i = 0; i < right.length; i += 3) {
    const key = triangleKey(right[i], right[i + 1], right[i + 2], oriented);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let matched = 0;
  for (let i = 0; i < left.length; i += 3) {
    const a = mapping[left[i]], b = mapping[left[i + 1]], c = mapping[left[i + 2]];
    const key = triangleKey(a, reverse ? c : b, reverse ? b : c, oriented);
    if (counts.get(key) > 0) { matched++; counts.set(key, counts.get(key) - 1); }
  }
  return matched;
}

// Diagnostic only: X reflection followed by centroid translation, no optimized
// rotation/scale, no model mutation. Distances/tolerance use the input units.
export function reflectedMeshCorrespondence(left, right, tolerance = 1e-6) {
  validate(left); validate(right);
  assert.ok(Number.isFinite(tolerance) && tolerance > 0);
  const n = left.positions.length / 3, m = right.positions.length / 3;
  const mean = p => [0, 1, 2].map(k => {
    let sum = 0; for (let i = k; i < p.length; i += 3) sum += p[i];
    return sum / (p.length / 3);
  });
  const a = mean(left.positions), b = mean(right.positions);
  const translation = [b[0] + a[0], b[1] - a[1], b[2] - a[2]];
  const mapping = new Uint32Array(n);
  let squaredSum = 0, maximumDistance = 0, ambiguousWithinTolerance = 0;
  for (let i = 0; i < n; i++) {
    const x = -left.positions[3 * i] + translation[0];
    const y = left.positions[3 * i + 1] + translation[1];
    const z = left.positions[3 * i + 2] + translation[2];
    let nearest = Infinity, nearestIndex = 0, within = 0;
    for (let j = 0; j < m; j++) {
      const d = (x - right.positions[3 * j]) ** 2 + (y - right.positions[3 * j + 1]) ** 2 + (z - right.positions[3 * j + 2]) ** 2;
      if (d <= tolerance * tolerance) within++;
      if (d < nearest) { nearest = d; nearestIndex = j; }
    }
    mapping[i] = nearestIndex;
    squaredSum += nearest; maximumDistance = Math.max(maximumDistance, Math.sqrt(nearest));
    if (within > 1) ambiguousWithinTolerance++;
  }
  const uniqueMappedVertices = new Set(mapping).size;
  const bijective = n === m && uniqueMappedVertices === n;
  const trianglesLeft = left.indices.length / 3, trianglesRight = right.indices.length / 3;
  const matchedUnoriented = matchedTriangles(left.indices, right.indices, mapping, false, false);
  const matchedSameWinding = matchedTriangles(left.indices, right.indices, mapping, false, true);
  const matchedReversedWinding = matchedTriangles(left.indices, right.indices, mapping, true, true);
  const topologyEquivalent = bijective && trianglesLeft === trianglesRight && matchedUnoriented === trianglesLeft;
  return {
    verticesLeft: n, verticesRight: m, trianglesLeft, trianglesRight, translation,
    rmsDistance: Math.sqrt(squaredSum / n), maximumDistance, uniqueMappedVertices,
    ambiguousWithinTolerance, bijective, matchedUnoriented, matchedSameWinding,
    matchedReversedWinding, topologyEquivalent,
    // A corresponding triangle point is the same convex combination of its
    // vertices. With full face multiplicity matching this bounds both surfaces.
    correspondingSurfaceUpperBound: topologyEquivalent ? maximumDistance : null,
    certifiedWithinTolerance: topologyEquivalent && maximumDistance <= tolerance && ambiguousWithinTolerance === 0,
    tolerance, mapping,
  };
}
