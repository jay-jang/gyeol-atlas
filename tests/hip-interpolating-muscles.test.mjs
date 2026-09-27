import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const dir='docs/anatomy-alignment/',read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const r=json(dir+'hip-interpolating-muscles.json'),a=json(dir+'hip-interpolating-muscles-readback.json'),b=json(dir+'hip-pivot-bone-crossings.json'),t=json(dir+'hip-interpolation-triangulation.json'),v=json(dir+'hip-interpolation-triangulation-readback.json'),c=json(dir+'hip-interpolating-muscles-captures.json'),candidate=r.candidates[0],prior=json(dir+'hip-rotation-muscles.json');
test('prescribed pivot frames create no new bone crossings while retaining two source lumbar pairs',()=>{
  assert.equal(b.rows.length,120);assert.deepEqual(b.summary,{examinedPairs:120,sourceBroadPairs:2,prescribedBroadPairs:2,sourceWitnessPairs:2,prescribedWitnessPairs:2,newBroadPairs:0,newWitnessPairs:0});
  assert.deepEqual(b.rows.filter(p=>p.source.witness).map(p=>p.names),[['VERTEBRA_L3','VERTEBRA_L4'],['VERTEBRA_L5','VERTEBRA_L6']]);
  const hips=b.rows.filter(p=>p.source.closest);assert.equal(hips.length,2);for(const p of hips){assert.equal(p.source.crossing,false);assert.equal(p.prescribed.crossing,false);assert.ok(p.source.closest.minimumDistanceMm>.4);assert.ok(p.prescribed.closest.minimumDistanceMm>.5);}
  assert.equal(r.boneCompatibilitySha256,sha(read(dir+'hip-pivot-bone-crossings.json')));
});
test('one inverse-fourth map reproduces all12 anchors but does not silently freeze holdouts',()=>{
  assert.match(r.status,/NO RUNTIME EXPORT/);assert.deepEqual(r.root,prior.root);assert.deepEqual(r.frames,prior.frames);assert.equal(r.candidates.length,1);assert.equal(r.frames.reduce((n,f)=>n+f.members.length,0),12);
  const anchors=candidate.bones.filter(p=>p.anchor),holdouts=candidate.bones.filter(p=>!p.anchor);assert.equal(anchors.length,12);assert.equal(anchors.reduce((n,p)=>n+p.ownFrameDifference.count,0),402669);assert.ok(anchors.every(p=>p.ownFrameFloat32Differences===0));assert.ok(anchors.every(p=>p.ownFrameDifference.maximumMm<.000031));
  assert.deepEqual(holdouts.map(p=>p.name),['left-Patella','right-Patella','VERTEBRA_L1','VERTEBRA_L6']);assert.ok(holdouts.every(p=>p.ownFrameFloat32Differences>0));assert.ok(holdouts.at(-1).ownFrameDifference.maximumMm>.4);
});
test('skin and HRA failures survive anchor success with source-internal relationships counted separately',()=>{
  const s=candidate.summary;assert.equal(s.vertices,652173);assert.equal(s.examinedPairs,89794);assert.equal(s.legacyOutside,17567);assert.equal(s.afterOutside,11672);assert.equal(s.newOutside,5851);assert.equal(s.worsenedOutside,1909);assert.equal(s.afterAmbiguous,1);assert.equal(s.currentPairs,232);assert.equal(s.legacyPairs,211);assert.equal(s.afterPairs,215);assert.equal(s.newAgainst_current,110);assert.equal(s.newAgainst_legacy,110);assert.equal(s.sourceInternalPairs,33);assert.equal(s.afterInternalPairs,34);assert.equal(s.newInternalPairs,1);assert.equal(s.removedInternalPairs,0);
  assert.equal(candidate.sourceBoneRelations.length,1216);assert.ok(candidate.sourceBoneRelations.every(p=>p.source===p.after));assert.equal(s.sourceBonePairs,23);assert.equal(s.afterSourceBonePairs,23);
  const ids=new Set(r.legacyMuscles.map(m=>m.id)),fresh=candidate.relations.filter(p=>p.after&&!p.legacy),internal=fresh.filter(p=>p.ids.every(id=>ids.has(id))),fixed=fresh.filter(p=>p.ids.some(id=>!ids.has(id)));assert.equal(internal.length,3);assert.equal(internal.filter(p=>p.sourceInternal).length,2);assert.equal(fixed.length,107);assert.ok(fresh.every(p=>p.interiorWitness));
  assert.deepEqual(fixed.reduce((a,p)=>{const l=p.layers.find((_,i)=>!ids.has(p.ids[i]));a[l]=(a[l]||0)+1;return a;},{}),{skin:10,organ:4,vessel:8,bone:85});
});
test('full scalar replay and minimum Jacobians retain exact files and bounded independent scope',()=>{
  assert.equal(a.reportSha256,sha(read(dir+'hip-interpolating-muscles.json')));assert.equal(a.scriptSha256,sha(read('scripts/verify-hip-interpolating-muscles.mjs')));const p=a.candidates[0];assert.equal(p.vertices,652173);assert.equal(p.indexReferences,3912126);assert.equal(p.coordinateDifferences,0);assert.equal(p.maximumCoordinateDifferenceMm,0);assert.equal(p.finiteDifference.points,228);assert.ok(p.finiteDifference.maximumJacobianDifference<2.5e-9);assert.equal(p.witnesses,110);assert.equal(p.missingWitnesses,0);assert.equal(p.boneFrameChecks.length,16);assert.equal(p.minimumChecks.length,2);assert.ok(p.minimumChecks.every(p=>p.finiteDifferenceDeterminant>.13&&p.maximumJacobianDifference<1.4e-9));assert.equal(p.boneCompatibility.witnesses,4);assert.equal(p.boneCompatibility.closestPoints,8);
  assert.equal(candidate.jacobianVertices.count,652173);assert.equal(candidate.jacobianTriangleCentroids.count,1304042);assert.equal(candidate.jacobianVertices.nonPositive,0);assert.equal(candidate.jacobianTriangleCentroids.nonPositive,0);
  for(const f of [...r.files,...b.files,...t.files].filter(f=>!f.file.startsWith('.cache/')))assert.equal(sha(read(f.file)),f.sha256,f.file);
  const review=json(dir+'hip-interpolation-agy-review.json');assert.match(review.initialObservation,/turn in progress/);assert.equal(review.followup.status,'SUCCESS');assert.equal(review.corrections.length,4);
});
test('the new displayed muscle pair crossing disappears at4/16 children without overwriting the coarse failure',()=>{
  assert.equal(t.reportSha256,a.reportSha256);assert.deepEqual(t.pair.ids,['VHF0005','VHF0022']);assert.equal(t.levels.length,3);assert.deepEqual(t.levels.map(p=>p.source.crossing),[false,false,false]);assert.deepEqual(t.levels.map(p=>p.mapped.crossing),[true,false,false]);assert.ok(t.levels[0].mapped.witness);assert.ok(t.levels.slice(1).every(p=>p.mapped.minimumDistanceMm>.01&&p.mapped.minimumDistanceMm<.013));
  assert.deepEqual(t.levels.map(p=>p.parts.reduce((n,p)=>n+p.triangles,0)),[48310,193240,772960]);assert.equal(candidate.summary.newInternalPairs,1);assert.equal(v.reportSha256,sha(read(dir+'hip-interpolation-triangulation.json')));assert.equal(v.scriptSha256,sha(read('scripts/verify-hip-interpolation-triangulation.mjs')));assert.equal(v.closestPoints,12);assert.equal(v.triangles,12);assert.ok(v.maximumPlaneResidualMm<1e-8&&v.maximumDistanceResidualMm<1e-8);
});
test('six paired diagnostics retain133 identical parts and three declared states',()=>{
  assert.equal(c.reportSha256,a.reportSha256);assert.equal(c.priorReportSha256,sha(read(dir+'hip-rotation-muscles.json')));assert.equal(c.auditSha256,sha(read(dir+'hip-interpolating-muscles-readback.json')));assert.equal(c.scriptSha256,sha(read('scripts/capture-hip-interpolating-muscles.mjs')));assert.deepEqual(c.errors,[]);assert.equal(c.captures.length,6);
  const ids=[...r.legacyMuscles.map(m=>m.id),...new Set(r.bones.flatMap(b=>b.targetIds)),'HRAF0003'];assert.equal(ids.length,133);for(const view of ['front','oblique']){const group=c.captures.filter(p=>p.view===view);assert.deepEqual(group.map(p=>p.state),['legacy','gaussian-20mm','inverse-fourth']);for(const p of group){assert.deepEqual(p.ids,ids);assert.deepEqual(p.cameraPosition,group[0].cameraPosition);assert.deepEqual(p.target,group[0].target);assert.equal(p.extent,group[0].extent);assert.equal(sha(read(dir+p.file)),p.sha256);}}
});
