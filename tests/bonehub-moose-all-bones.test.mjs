import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const full=JSON.parse(fs.readFileSync('docs/anatomy-alignment/bonehub-moose-all-bones.json'));
const initial=JSON.parse(fs.readFileSync('docs/anatomy-alignment/bonehub-moose-bones.json'));
const hash=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');

test('all 31 MOOSE bone labels are compared to distinct same-CT source segments',()=>{
  assert.match(full.status,/NOT ATLAS APPROVAL/);
  assert.equal(full.scriptSha256,hash('scripts/audit-bonehub-moose-all-bones.py'));
  assert.equal(full.segmentationSha256,initial.segmentationSha256);
  assert.equal(full.modelDatasetJsonSha256,initial.modelDatasetJsonSha256);
  assert.deepEqual(full.comparisonGridShape,[243,242,864]);
  assert.equal(Object.keys(full.sourceFiles).length,9);
  assert.ok(full.candidateCornerMaxDistanceMm<.00003);
  assert.ok(Object.values(full.sourceAffineMaxAbsDifference).every(value=>value===0));
  assert.deepEqual(full.comparisons.map(row=>row.mooseLabel),Array.from({length:31},(_,i)=>i+1));
  const sourceKeys=new Set();
  for(const row of full.comparisons){
    assert.ok(row.sourceHighResolutionVoxels>0,row.name);
    assert.ok(row.sourceSegments.length>=1,row.name);
    for(const segment of row.sourceSegments){
      const key=`${row.sourceFile}/${segment.layer}/${segment.value}`;
      assert.ok(!sourceKeys.has(key),`source segment reused: ${key}`);
      sourceKeys.add(key);
    }
    for(const method of [row.nearest,row.eightSubpointMajority]){
      assert.ok(method.reference.voxels>0,row.name);
      assert.ok(method.candidate.voxels>0,row.name);
      assert.ok(method.intersectionVoxels>0,row.name);
      assert.ok(method.dice>0&&method.dice<1,row.name);
      assert.ok(Number.isFinite(method.centroidDistanceMm),row.name);
    }
    for(let d=0;d<3;d++){
      assert.ok(row.roi[d][0]>=0&&row.roi[d][1]<=full.comparisonGridShape[d]);
      assert.ok(row.roi[d][0]<row.roi[d][1]);
    }
  }
  assert.equal(sourceKeys.size,90);
});

test('the original ten centre-sampled comparisons are reproduced within the bilateral audit',()=>{
  for(const row of initial.comparisons){
    const expanded=full.comparisons.find(part=>part.mooseLabel===row.mooseLabel);
    assert.ok(expanded,row.name);
    assert.ok(Math.abs(expanded.nearest.dice-row.dice)<1e-12,row.name);
    assert.ok(Math.abs(expanded.nearest.centroidDistanceMm-row.centroidDistanceMm)<1e-9,row.name);
    assert.equal(expanded.nearest.reference.voxels,row.reference.voxels);
    assert.equal(expanded.nearest.candidate.voxels,row.candidate.voxels);
  }
  const byName=Object.fromEntries(full.comparisons.map(row=>[row.name,row]));
  assert.ok(byName.carpal_right.nearest.dice<.75);
  assert.ok(byName.femur_left.eightSubpointMajority.dice>.96);
  assert.ok(byName.ulna_right.nearest.centroidDistanceMm>18);
});
