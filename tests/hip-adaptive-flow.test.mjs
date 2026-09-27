import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const dir='docs/anatomy-alignment/',read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const r=json(dir+'hip-adaptive-flow.json'),a=json(dir+'hip-adaptive-flow-readback.json'),c=json(dir+'hip-adaptive-flow-captures.json'),prior=json(r.priorFile);
test('adaptive flow retains fixed reverse material controls and biased full-skin extrema',()=>{
  assert.match(r.status,/NO RUNTIME EXPORT/);assert.equal(r.priorSha256,sha(read(r.priorFile)));assert.deepEqual(r.initialBinary,prior.binary);assert.equal(r.controls.length,25);assert.equal(r.controls.reduce((n,p)=>n+p.points,0),6012);assert.equal(r.controls.at(-1).points,2940);assert.equal(r.controls.at(-1).weight,2);assert.equal(r.reverseCorrespondences.length,1536);assert.equal(r.sampling.length,100);
  assert.equal(r.skinOutlierSelection.length,76);assert.equal(r.skinOutlierSelection.reduce((n,p)=>n+p.selected.length,0),508);assert.equal(r.skinOutlierSelection.reduce((n,p)=>n+p.classes.outside,0),11178);assert.ok(r.skinOutlierSelection.every(p=>p.selected.length<=32&&p.selected.every(q=>q.distance>.002)));
  assert.equal(r.fit.termination,'iteration-limit');assert.equal(r.fit.steps.length,160);assert.equal(r.fit.history.length,160);let last=r.fit.initial.loss;for(const h of r.fit.history){assert.equal(h.beforeLoss,last);assert.equal(h.accepted,true);assert.equal(h.backtracks,0);assert.ok(h.afterLoss<h.beforeLoss-1e-15);last=h.afterLoss;}assert.equal(last,r.fit.final.loss);
});
test('full skin improvement retains89 new and74 worsened vertices and L1 regression',()=>{
  const s=r.summary;assert.equal(s.vertices,652173);assert.equal(s.initialOutside,11178);assert.equal(s.afterOutside,3882);assert.equal(s.newOutside,89);assert.equal(s.worsenedOutside,74);assert.equal(s.initialAmbiguous,0);assert.equal(s.afterAmbiguous,0);
  assert.deepEqual(r.muscles.filter(p=>p.newOutside).map(p=>[p.id,p.newOutside,p.worsenedOutside]),[['VHF0059',73,6],['VHF0060',16,68]]);
  assert.deepEqual(r.bones.filter(p=>!p.anchor).map(p=>p.name),['left-Patella','right-Patella','VERTEBRA_L1','VERTEBRA_L6']);for(const direction of ['forward','reverse'])assert.deepEqual(r.bones.filter(p=>p.after[direction].p95Mm>p.before[direction].p95Mm).map(p=>p.name),['VERTEBRA_L1']);
  for(const b of r.bones)assert.deepEqual(b.before,prior.bones.find(p=>p.name===b.name).after);assert.ok(r.bones.find(p=>p.name==='left-Tibia').after.reverse.p95Mm<8);assert.ok(r.bones.find(p=>p.name==='left-Fibula').after.reverse.p95Mm<5.5);
});
test('new crossing counts separate five initial-new pairs from90 runtime-new pairs',()=>{
  const s=r.summary;assert.equal(s.examinedPairs,89794);assert.equal(s.currentPairs,232);assert.equal(s.initialPairs,197);assert.equal(s.afterPairs,196);assert.equal(s.newAgainst_current,90);assert.equal(s.newAgainst_initial,5);
  const fresh=r.relations.filter(p=>p.after&&!p.initial),ids=new Set(r.muscles.map(p=>p.id));assert.equal(fresh.length,5);assert.ok(fresh.every(p=>p.interiorWitness&&p.layers.includes('bone')));assert.deepEqual(fresh.filter(p=>!p.current).map(p=>p.ids),[['HRAF0918','VHF0045']]);
  const layers=r.relations.filter(p=>p.after&&!p.current).reduce((a,p)=>{const l=p.layers.find((_,i)=>!ids.has(p.ids[i]))||'internal';a[l]=(a[l]||0)+1;return a;},{});assert.deepEqual(layers,{skin:9,organ:2,vessel:6,bone:70,internal:3});
  assert.equal(s.sourceInternalPairs,33);assert.equal(s.initialInternalPairs,34);assert.equal(s.afterInternalPairs,34);assert.equal(s.newInternalAgainstSource,1);assert.equal(s.newInternalAgainstInitial,0);assert.equal(r.sourceBoneRelations.length,1216);assert.ok(r.sourceBoneRelations.every(p=>p.source===p.initial&&p.initial===p.after));assert.equal(s.afterSourceBonePairs,23);
});
test('full scalar replay, original triangle membership and alternate extreme selection retain bounded scope',()=>{
  assert.equal(a.reportSha256,sha(read(dir+'hip-adaptive-flow.json')));assert.equal(a.scriptSha256,sha(read('scripts/verify-hip-adaptive-flow.mjs')));assert.equal(a.candidateSha256,r.binary.sha256);assert.equal(a.vertices,652173);assert.equal(a.indexReferences,3912126);assert.equal(a.coordinateDifferences,0);assert.equal(a.boneVertices,471211);assert.equal(a.boneIndexReferences,2827170);assert.equal(a.jacobianSamples,9728);assert.ok(a.maximumJacobianDifference<1e-14);assert.ok(a.maximumStepBound<.120000000000001);
  assert.equal(a.sampling.surfaces,100);assert.equal(a.sampling.samples,5504);assert.equal(a.sampling.inputTriangles,2250121);assert.equal(a.sampling.maximumPointResidualMm,0);assert.equal(a.reverseMaterialPoints,1536);assert.ok(a.maximumMaterialResidualMm<1e-7);assert.deepEqual(a.skinExtremes,{vertices:652173,outside:11178,selected:508});assert.equal(a.witnesses,6);assert.equal(a.missingWitnesses,0);assert.ok(a.maximumWitnessResidualMm<1e-8);assert.ok(a.controlLossReplay.every(p=>p.lossResidual<1e-19));
  for(const f of r.files.filter(f=>!f.file.startsWith('.cache/')))assert.equal(sha(read(f.file)),f.sha256,f.file);
  const review=json(dir+'hip-adaptive-flow-agy-review.json');assert.match(review.initialObservation,/turn in progress/);assert.equal(review.followup.status,'SUCCESS');assert.match(review.followup.response,/Completed/);assert.equal(review.corrections.length,7);
});
test('six diagnostics keep133 structures and three states with no claim of app validation',()=>{
  assert.equal(c.reportSha256,a.reportSha256);assert.equal(c.priorReportSha256,r.priorSha256);assert.equal(c.auditSha256,sha(read(dir+'hip-adaptive-flow-readback.json')));assert.equal(c.scriptSha256,sha(read('scripts/capture-hip-adaptive-flow.mjs')));assert.deepEqual(c.errors,[]);assert.equal(c.captures.length,6);
  const ids=[...r.muscles.map(p=>p.id),...new Set(r.bones.flatMap(p=>p.targetIds)),'HRAF0003'];assert.equal(ids.length,133);for(const view of ['front','oblique']){const group=c.captures.filter(p=>p.view===view);assert.deepEqual(group.map(p=>p.state),['legacy','initial','flow']);for(const p of group){assert.deepEqual(p.ids,ids);assert.deepEqual(p.cameraPosition,group[0].cameraPosition);assert.deepEqual(p.target,group[0].target);assert.equal(p.extent,group[0].extent);assert.equal(sha(read(dir+p.file)),p.sha256);}}assert.match(c.limits,/Not app\/mobile\/peel or clinical validation/);
});
