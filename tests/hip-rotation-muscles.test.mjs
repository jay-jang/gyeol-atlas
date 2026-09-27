import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const dir='docs/anatomy-alignment/',read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const r=json(dir+'hip-rotation-muscles.json'),a=json(dir+'hip-rotation-muscles-readback.json'),l=json(dir+'hip-rotation-leakage.json'),c=json(dir+'hip-rotation-muscles-captures.json'),changed=new Set(r.legacyMuscles.map(m=>m.id));
test('shared hip map has12 source anchors with held-out patella/L1/L6 and keeps failures visible',()=>{
  assert.match(r.status,/NO RUNTIME EXPORT/);assert.equal(r.legacyMuscles.length,76);assert.equal(r.bones.length,16);assert.equal(r.frames.length,3);assert.equal(r.frames.reduce((n,f)=>n+f.members.length,0),12);
  assert.deepEqual(r.bones.filter(b=>!b.anchor).map(b=>b.name),['left-Patella','right-Patella','VERTEBRA_L1','VERTEBRA_L6']);
  for(const [i,p] of r.candidates.entries()){
    const s=p.summary;assert.equal(s.vertices,652173);assert.equal(s.examinedPairs,89794);assert.equal(s.legacyOutside,17567);assert.equal(s.afterOutside,i?18707:6249);assert.equal(s.newOutside,i?9668:3168);assert.equal(s.worsenedOutside,i?4066:1880);assert.equal(s.afterAmbiguous,i?0:1);assert.equal(s.currentPairs,232);assert.equal(s.legacyPairs,211);assert.equal(s.afterPairs,i?211:209);assert.equal(s.newAgainst_legacy,i?108:106);assert.equal(s.newAgainst_current,i?108:106);
    assert.equal(p.jacobianVertices.count,652173);assert.equal(p.jacobianTriangleCentroids.count,1304042);assert.equal(p.jacobianVertices.nonPositive,0);assert.equal(p.jacobianTriangleCentroids.nonPositive,0);assert.ok(p.jacobianVertices.maximum>3);
  }
});
test('source pair preservation is separate from reappearing legacy pairs and fixed-HRA crossings',()=>{
  for(const [i,p] of r.candidates.entries()){
    const s=p.summary;assert.equal(s.sourceInternalPairs,33);assert.equal(s.afterInternalPairs,33);assert.equal(s.newInternalPairs,0);assert.equal(s.removedInternalPairs,0);assert.equal(p.sourceBoneRelations.length,1216);assert.ok(p.sourceBoneRelations.every(p=>p.source===p.after));assert.equal(s.sourceBonePairs,23);assert.equal(s.afterSourceBonePairs,23);assert.equal(s.newSourceBonePairs,0);assert.equal(s.removedSourceBonePairs,0);
    const pairs=p.relations.filter(p=>p.after&&!p.legacy),internal=pairs.filter(p=>p.ids.every(id=>changed.has(id))),fixed=pairs.filter(p=>p.ids.some(id=>!changed.has(id)));
    assert.equal(internal.length,2);assert.ok(internal.every(p=>p.sourceInternal));assert.equal(fixed.length,i?106:104);assert.ok(pairs.every(p=>p.interiorWitness));
    const layers=fixed.reduce((a,p)=>{const layer=p.layers.find((_,i)=>!changed.has(p.ids[i]));a[layer]=(a[layer]||0)+1;return a;},{});assert.deepEqual(layers,i?{skin:12,organ:6,vessel:8,bone:80}:{skin:8,organ:4,vessel:8,bone:84});
    assert.equal(p.sourceBoneRelations.filter(p=>p.source&&p.bone.startsWith('VERTEBRA')).length,6);
  }
});
test('full scalar coordinates and actual witness membership agree while Gaussian cross-leg leakage remains',()=>{
  assert.equal(a.reportSha256,sha(read(dir+'hip-rotation-muscles.json')));assert.equal(l.reportSha256,a.reportSha256);assert.equal(a.scriptSha256,sha(read('scripts/verify-hip-rotation-muscles.mjs')));
  for(const [i,p] of a.candidates.entries()){assert.equal(p.vertices,652173);assert.equal(p.indexReferences,3912126);assert.equal(p.coordinateDifferences,0);assert.equal(p.maximumCoordinateDifferenceMm,0);assert.equal(p.finiteDifference.points,228);assert.ok(p.finiteDifference.maximumJacobianDifference<2.2e-9);assert.equal(p.witnesses,i?108:106);assert.equal(p.missingWitnesses,0);assert.ok(p.maximumWitnessResidualMm<1e-8);}
  assert.equal(l.rows.length,4);assert.equal(l.rows.reduce((n,p)=>n+p.examinedVertices,0),119826);
  for(const p of l.rows){const own=p.frameOrder.indexOf(p.side),other=p.frameOrder.indexOf(p.side==='left'?'right':'left');assert.equal(p.distancesMm[own],0);assert.ok(p.distancesMm[other]>36&&p.distancesMm[other]<37);assert.ok(p.weights[other]>.15);assert.ok(p.distanceMm>(p.mode==='gaussian-20mm'?32:80));}
  for(const f of [...r.files,...l.files].filter(f=>!f.file.startsWith('.cache/')))assert.equal(sha(read(f.file)),f.sha256,f.file);
  const review=json(dir+'hip-muscle-agy-review.json');assert.equal(review.review.status,'SUCCESS');assert.equal(review.corrections.length,8);
});
test('six candidate screenshots retain the same133 actual parts and camera without claiming app validation',()=>{
  assert.equal(c.reportSha256,a.reportSha256);assert.equal(c.auditSha256,sha(read(dir+'hip-rotation-muscles-readback.json')));assert.equal(c.scriptSha256,sha(read('scripts/capture-hip-rotation-muscles.mjs')));assert.deepEqual(c.errors,[]);assert.equal(c.captures.length,6);
  const ids=[...r.legacyMuscles.map(m=>m.id),...new Set(r.bones.flatMap(b=>b.targetIds)),'HRAF0003'];assert.equal(ids.length,133);
  for(const view of ['front','oblique']){const group=c.captures.filter(p=>p.view===view);assert.deepEqual(group.map(p=>p.state),['legacy','gaussian-20mm','gaussian-40mm']);for(const p of group){assert.deepEqual(p.ids,ids);assert.deepEqual(p.target,group[0].target);assert.deepEqual(p.cameraPosition,group[0].cameraPosition);assert.equal(p.extent,group[0].extent);assert.equal(sha(read(dir+p.file)),p.sha256);}}
});
