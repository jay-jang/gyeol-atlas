import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const read=path=>JSON.parse(fs.readFileSync(path));
const hash=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const receipt=read('docs/anatomy-alignment/bonehub-moose-stomach-surface.json');
const screen=read('docs/anatomy-alignment/bonehub-moose-stomach-surface-screen.json');

test('pinned stomach boundary is a closed offline segmentation candidate',()=>{
  assert.match(receipt.status,/NOT VALIDATED STOMACH ANATOMY/);
  assert.equal(receipt.scriptSha256,hash('scripts/export-bonehub-moose-stomach-surface.py'));
  assert.equal(receipt.thoraxScreenSha256,hash('docs/anatomy-alignment/bonehub-thorax-screen.json'));
  assert.equal(receipt.sourceVoxelCount,108011);
  assert.equal(receipt.vertexCount,25069);
  assert.equal(receipt.triangleCount,50178);
  assert.equal(screen.sourceReceiptSha256,hash('docs/anatomy-alignment/bonehub-moose-stomach-surface.json'));
  assert.equal(screen.scriptSha256,hash('scripts/audit-bonehub-moose-stomach-surface.mjs'));
  assert.equal(screen.femaleAtlasSha256,hash('public/models/female/atlas-female.json'));
  assert.deepEqual([screen.candidateTopology.connectedComponents,screen.candidateTopology.boundaryEdges,
    screen.candidateTopology.nonManifoldEdges,screen.candidateTopology.degenerateTriangles],[1,0,0,0]);
});

test('skin containment does not hide neighbouring HRA surface crossings',()=>{
  assert.deepEqual(screen.counts,{inside:25069,'surface-band':0,outside:0,ambiguous:0});
  assert.equal(screen.skinTriangleCrossing,false);
  assert.ok(screen.closestSkinMm>20);
  const crossing=screen.nearby.filter(row=>row.triangleIntersection);
  assert.equal(crossing.length,10);
  for(const row of crossing){
    assert.ok(row.intersectingTrianglePairs>0);
    assert.ok(row.strictPlaneStraddlingPairs>0);
    assert.ok(row.transverseWitness?.planeStraddleExtentMm>0);
  }
  assert.ok(crossing.some(row=>row.id==='HRAF0474'));
  assert.ok(crossing.some(row=>row.id==='HRAF0809'));
  assert.ok(crossing.some(row=>row.id==='HRAF0493'));
  assert.ok(crossing.some(row=>row.id==='HRAF0528'));
  assert.equal(screen.nearby.find(row=>row.id==='HRAF0554').triangleIntersection,false);
  assert.match(screen.status,/NOT REGISTERED HRA ANATOMY/);
});
