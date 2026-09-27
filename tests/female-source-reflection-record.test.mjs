import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
const read = p => fs.readFileSync(p), json = p => JSON.parse(read(p));
const r = json('docs/anatomy-alignment/female-source-reflection.json');
test('source reflection record distinguishes 22 near-identical pairs from the ACL exception', () => {
  assert.equal(r.pairs.length, 23);
  assert.equal(new Set(r.pairs.flatMap(p => [p.leftId, p.rightId])).size, 46);
  assert.equal(r.pairs.filter(p => p.category === 'restored-knee-part').length, 19);
  assert.deepEqual(r.decoderCheck, {meshes: 46, positionScalars: 64608, indexReferences: 124776, differences: 0});
  const near = r.pairs.filter(p => p.certifiedWithinTolerance), different = r.pairs.filter(p => !p.certifiedWithinTolerance);
  assert.equal(near.length, 22); assert.equal(different.length, 1);
  for (const p of r.pairs) {
    assert.equal(p.verticesLeft, p.verticesRight);
    assert.equal(p.uniqueMappedVertices, p.verticesLeft);
    assert.equal(p.ambiguousWithinTolerance, 0);
    assert.equal(p.trianglesLeft, p.trianglesRight);
    assert.equal(p.matchedUnoriented, p.trianglesLeft);
    assert.equal(p.matchedReversedWinding, p.trianglesLeft);
    assert.equal(p.topologyEquivalent, true);
    assert.equal(p.correspondingSurfaceUpperBound, p.maximumDistance);
    assert.match(p.mappingSha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(near.reduce((n, p) => n + p.trianglesLeft, 0), 19808);
  assert.ok(near.every(p => p.maximumDistance < 1e-6));
  assert.equal(different[0].leftId, 'HRAF0934');
  assert.ok(Math.abs(different[0].maximumDistance * 1000 - 0.12367502187415945) < 1e-12);
});
test('source reference audit is reproducible and does not represent a runtime correction', () => {
  assert.equal(r.sourceSha256, json('data/catalog/female-knee-source-restoration.json').sourceSha256);
  for (const f of r.files) assert.equal(createHash('sha256').update(read(f.file)).digest('hex'), f.sha256, f.file);
  assert.match(r.status, /no runtime correction/);
  assert.ok(r.limitations.some(s => s.includes('donor identity')));
  assert.ok(r.limitations.some(s => s.includes('not interval-arithmetic')));
  const femur = r.pairs.find(p => p.left === 'VH_F_femur_L'), tibia = r.pairs.find(p => p.left === 'VH_F_tibia_L');
  assert.ok(Math.abs(femur.translation[0] - tibia.translation[0]) > 0.0006);
  assert.ok(Math.abs(femur.translation[2]) > 0.003);
});
test('donor triangle-area comparison retains all ten source hashes without inferring donor identity', () => {
  const source = json('docs/anatomy-alignment/donor-source-comparison.json');
  assert.deepEqual(r.donorAreaPairs.map(p => p.name), ['Pelvis', 'Femur', 'Patella', 'Tibia', 'Fibula']);
  for (const p of r.donorAreaPairs) {
    for (const side of ['left', 'right']) {
      const f = source.files.find(f => f.file === p[side].file);
      assert.equal(p[side].sha256, f.sha256);
      assert.ok(p[side].areaSquareMm > 0 && p[side].triangles > 0);
    }
    assert.equal(p.relativeAreaDifferencePercent, 200 * Math.abs(p.left.areaSquareMm - p.right.areaSquareMm) / (p.left.areaSquareMm + p.right.areaSquareMm));
    assert.ok(p.relativeAreaDifferencePercent > 0.05);
  }
});
