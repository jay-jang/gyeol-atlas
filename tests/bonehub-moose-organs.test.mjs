import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const read=path=>JSON.parse(fs.readFileSync(path));
const hash=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const report=read('docs/anatomy-alignment/bonehub-moose-organs.json');
const points=read('docs/anatomy-alignment/bonehub-moose-stomach-centres.json');
const skin=read('docs/anatomy-alignment/bonehub-moose-stomach-skin.json');
const slices=read('docs/anatomy-alignment/bonehub-moose-stomach-slices.json');

test('same-donor CT organ labels remain offline and preserve the full model mapping',()=>{
  assert.match(report.status,/NOT HRA REGISTRATION OR ATLAS APPROVAL/);
  assert.equal(report.scriptSha256,hash('scripts/audit-bonehub-moose-organs.py'));
  assert.equal(report.thoraxScreenSha256,hash('docs/anatomy-alignment/bonehub-thorax-screen.json'));
  assert.equal(report.femaleAtlasSha256,hash('public/models/female/atlas-female.json'));
  assert.deepEqual(report.labels.map(row=>row.label),Array.from({length:19},(_,i)=>i+1));
  assert.ok(report.labels.every(row=>row.voxels>0&&row.maskVolumeMl>0));
  assert.equal(report.labels.find(row=>row.name==='stomach').voxels,108011);
  assert.equal(report.labels.find(row=>row.name==='trachea').voxels,194);
  const rightUpper=report.labels.find(row=>row.name==='lung_upper_lobe_right');
  assert.ok(rightUpper.largestComponentVoxelFraction<.36);
  assert.equal(rightUpper.voxelBoundsHalfOpen[0][1],243);
  const rightLung=report.comparisons.find(row=>row.name==='lung_right');
  assert.equal(rightLung.ctFragmentedAtSixConnectivity,true);
  assert.ok(rightLung.bboxCentreDistanceMm>120);
  assert.ok(report.comparisons.every(row=>row.hraPartIds.length>0));
});

test('stomach screening checks all derived centres but does not claim a validated surface',()=>{
  assert.equal(points.scriptSha256,hash('scripts/export-bonehub-moose-stomach-centres.py'));
  assert.equal(points.segmentationSha256,report.segmentationSha256);
  assert.equal(points.voxels,108011);
  assert.match(points.status,/NOT A STOMACH SURFACE/);
  assert.equal(skin.scriptSha256,hash('scripts/audit-bonehub-moose-stomach-skin.mjs'));
  assert.equal(skin.sourceReceiptSha256,hash('docs/anatomy-alignment/bonehub-moose-stomach-centres.json'));
  assert.deepEqual(skin.counts,{inside:108011,'surface-band':0,outside:0,ambiguous:0});
  assert.deepEqual([skin.skinTopology.connectedComponents,skin.skinTopology.boundaryEdges,
    skin.skinTopology.nonManifoldEdges],[1,0,0]);
  assert.ok(skin.proximity.gastricImpression.minDistanceMm<.01);
  assert.ok(skin.proximity.gastricImpression.centresWithin2mm>0);
  assert.ok(skin.proximity.gastricImpression.topology.boundaryEdges>0);
  assert.equal(slices.scriptSha256,hash('scripts/capture-bonehub-moose-stomach-slices.py'));
  assert.equal(slices.imageSha256,hash('docs/anatomy-alignment/bonehub-moose-stomach-slices.png'));
  assert.equal(slices.slices.length,6);
});
