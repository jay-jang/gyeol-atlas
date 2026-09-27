import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const path=name=>new URL(`../docs/anatomy-alignment/${name}.json`,import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(path(name)));
const hash=name=>createHash('sha256').update(fs.readFileSync(path(name))).digest('hex');

test('native shank trials preserve the worse symmetric fit and all seventeen foot source labels',()=>{
  const f=read('bonehub-foot-shank'),s=read('bonehub-foot-shank-symmetric');
  for(let side=0;side<2;side++){
    assert.equal(f.sides[side].footLabels.length,17);
    assert.equal(f.sides[side].footLabels.filter(n=>n.startsWith('METATARSAL_')).length,5);
    assert.equal(f.sides[side].footLabels.filter(n=>n.startsWith('PHALANGE_FOOT_')).length,5);
    assert.equal(s.sides[side].stopReason,'iteration limit');
    assert.equal(f.sides[side].stopReason,'sample-change threshold');
    for(let bone=0;bone<2;bone++)assert.ok(s.sides[side].bones[bone].forward.p95Mm>f.sides[side].bones[bone].forward.p95Mm);
  }
  assert.match(f.status,/foot placement not approved/);
});

test('sample-guided native foot poses still fail full-vertex skin gates despite zero strict ankle crossings',()=>{
  const r=read('bonehub-foot-pose');assert.equal(r.fullVertexObjective,false);
  assert.deepEqual(r.sides.map(s=>s.best.outside),[95,11]);
  const candidates=r.sides.map(s=>s.snapshots.find(s=>s.variant==='candidate'));
  assert.deepEqual(candidates.map(c=>c.summary.vertices),[121256,121474]);
  assert.deepEqual(candidates.map(c=>c.summary.outside),[5970,1091]);
  assert.deepEqual(candidates.map(c=>c.summary.strictCrossingPairs),[0,0]);
  assert.ok(candidates.every(c=>c.parts.length===17&&c.summary.maxOutsideMm>2));
  const readback=read('bonehub-foot-readback'),visual=read('bonehub-foot-visual');
  assert.equal(readback.checks.length,68);assert.equal(readback.triangleCornerOccurrences,2911944);
  assert.ok(readback.checks.every(c=>c.maximumCoordinateResidualMetres===0));
  assert.equal(visual.captures.length,4);assert.ok(visual.captures.every(c=>c.camera.visibleSourceMeshes===17));assert.deepEqual(visual.errors,[]);
  for(const record of [readback,visual])assert.equal(record.files.find(f=>f.file.endsWith('/pose-sampled.json')).sha256,hash('bonehub-foot-pose'));
});

test('same-source CT receipt pins the full image, while its unsigned values are not relabeled as HU',()=>{
  const r=read('bonehub-female-ct-receipt'),g=read('bonehub-female-ct-grid');
  assert.equal(r.sourceFile.sha256,r.sourceFile.publishedLfsSha256);
  assert.equal(r.sourceFile.sha256,'638c569c9a702a6c7b3f50e36fe4be8ef7acc2ab0c53d960ad19418d7f00d979');
  assert.equal(r.sourceFile.bytes,501395759);assert.equal(r.gzipCrcChecked,true);
  assert.equal(r.nifti.datatype,512);assert.equal(r.nifti.bitpix,16);assert.equal(r.nifti.sclSlope,1);assert.equal(r.nifti.sclInter,0);
  assert.equal(g.voxels,778721570);assert.deepEqual(g.range,[0,4050]);assert.equal(g.zeroVoxels,323936364);
  assert.equal(g.histogram.reduce((n,r)=>n+r.count,0),g.voxels);
  assert.equal(g.slices.reduce((n,r)=>n+r.voxels,0),g.voxels);
  assert.equal(g.masks.length,11);assert.ok(g.masks.every(m=>m.voxelCentresMatch));
  assert.match(g.status,/not tissue or HU validation/);
  assert.equal(g.files.find(f=>f.file.endsWith('/ct-receipt.json')).sha256,hash('bonehub-female-ct-receipt'));
});

test('independent NIfTI reader agrees with both coded image affines',()=>{
  const r=read('bonehub-female-ct-readback'),receipt=read('bonehub-female-ct-receipt');
  assert.deepEqual(r.shape,[673,670,1727]);assert.equal(r.dtype,'uint16');assert.equal(r.units[0],'mm');
  assert.equal(r.maximumQformSformDifference,0);
  for(let row=0;row<3;row++)for(let column=0;column<4;column++)assert.equal(Math.abs(r.sform[row][column]-receipt.nifti.sformRas[row][column]),0);
  assert.equal(r.files.find(f=>f.file.endsWith('/ct-receipt.json')).sha256,hash('bonehub-female-ct-receipt'));
});
