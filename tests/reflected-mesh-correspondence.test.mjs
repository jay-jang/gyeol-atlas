import test from 'node:test';
import assert from 'node:assert/strict';
import {reflectedMeshCorrespondence as compare} from '../scripts/lib/reflected-mesh-correspondence.mjs';

const left = {positions: [0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4], indices: [0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2]};
function reflected() {
  const order = [2, 0, 3, 1], mapping = [1, 3, 0, 2];
  const positions = order.flatMap(i => [5 - left.positions[3 * i], left.positions[3 * i + 1] + 7, left.positions[3 * i + 2] - 9]);
  const indices = [];
  for (let i = 0; i < left.indices.length; i += 3) indices.push(mapping[left.indices[i + 1]], mapping[left.indices[i]], mapping[left.indices[i + 2]]);
  return {positions, indices};
}
test('reflection audit handles vertex permutation and reversed cyclic triangle winding', () => {
  const r = compare(left, reflected());
  assert.deepEqual(r.translation, [5, 7, -9]);
  assert.equal(r.certifiedWithinTolerance, true);
  assert.equal(r.matchedReversedWinding, 4); assert.equal(r.matchedSameWinding, 0);
  assert.equal(r.correspondingSurfaceUpperBound, 0);
  assert.deepEqual([...r.mapping], [1, 3, 0, 2]);
});
test('identical vertex sets do not certify changed connectivity or duplicate-face multiplicities', () => {
  const right = reflected(); right.indices.splice(0, 3, ...right.indices.slice(3, 6));
  const r = compare(left, right);
  assert.equal(r.maximumDistance, 0); assert.equal(r.bijective, true);
  assert.equal(r.matchedUnoriented, 3); assert.equal(r.certifiedWithinTolerance, false);
  assert.equal(r.correspondingSurfaceUpperBound, null);
});
test('non-bijective correspondence cannot certify a surface copy', () => {
  const right = reflected(); right.positions.push(...right.positions.slice(0, 3));
  const r = compare(left, right);
  assert.equal(r.bijective, false); assert.equal(r.certifiedWithinTolerance, false);
});
test('finite tolerance is enforced and invalid geometry is rejected', () => {
  const right = reflected(); right.positions[0] += 0.01;
  assert.equal(compare(left, right).certifiedWithinTolerance, false);
  assert.throws(() => compare(left, reflected(), NaN));
  assert.throws(() => compare(left, {positions: [NaN, 0, 0], indices: [0, 0, 0]}));
  assert.throws(() => compare(left, {positions: [0, 0, 0], indices: [0, 1, 0]}));
});
test('ambiguous coincident vertices are not silently certified', () => {
  const a = {positions: [0, 0, 0, 0, 0, 0, 1, 0, 0], indices: [0, 1, 2]};
  const b = {positions: [0, 0, 0, 0, 0, 0, -1, 0, 0], indices: [0, 2, 1]};
  const r = compare(a, b);
  assert.equal(r.ambiguousWithinTolerance, 2);
  assert.equal(r.bijective, false); assert.equal(r.certifiedWithinTolerance, false);
});
