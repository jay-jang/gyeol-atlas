import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const dir='docs/anatomy-alignment/',read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const r=json(dir+'hip-joint-flow.json'),a=json(dir+'hip-joint-flow-readback.json'),c=json(dir+'hip-joint-flow-captures.json'),prior=json(r.priorFile);
test('common flow retains the rejected initial candidate and bounded sampled objective scope',()=>{
  assert.match(r.status,/NO RUNTIME EXPORT/);assert.equal(r.priorSha256,sha(read(r.priorFile)));assert.deepEqual(r.initialBinary,prior.candidates[0].binary);
  assert.equal(r.controls.length,13);assert.equal(r.controls.reduce((n,p)=>n+p.points,0),3968);assert.equal(r.sampling.length,88);assert.deepEqual(r.initialSkinSampleClasses,{inside:2332,outside:44,'surface-band':56,ambiguous:0});
  assert.equal(r.fit.termination,'iteration-limit');assert.equal(r.fit.steps.length,160);assert.equal(r.fit.history.length,160);assert.ok(r.fit.final.loss<r.fit.initial.loss);let previous=r.fit.initial.loss;
  for(const h of r.fit.history){assert.equal(h.beforeLoss,previous);assert.equal(h.accepted,true);assert.equal(h.backtracks,0);assert.ok(h.afterLoss<h.beforeLoss-1e-15);assert.equal(h.trials.length,1);previous=h.afterLoss;}assert.equal(previous,r.fit.final.loss);
  for(const s of r.fit.steps)assert.ok(135*Math.hypot(...s.displacement)/(64*s.radius)<=r.options.maximumBound+1e-14);
});
test('sparse loss improvement does not erase full skin failures or reverse bone p95 regressions',()=>{
  const s=r.summary;assert.equal(s.vertices,652173);assert.equal(s.initialOutside,11672);assert.equal(s.afterOutside,11178);assert.equal(s.newOutside,287);assert.equal(s.worsenedOutside,1248);assert.equal(s.initialAmbiguous,1);assert.equal(s.afterAmbiguous,0);
  assert.equal(r.muscles.reduce((n,p)=>n+p.newOutside,0),s.newOutside);assert.equal(r.muscles.reduce((n,p)=>n+p.worsenedOutside,0),s.worsenedOutside);
  assert.deepEqual(r.bones.filter(p=>!p.anchor).map(p=>p.name),['left-Patella','right-Patella','VERTEBRA_L1','VERTEBRA_L6']);
  assert.deepEqual(r.bones.filter(p=>p.after.reverse.p95Mm>p.before.reverse.p95Mm).map(p=>p.name),['left-Tibia','left-Fibula']);
  for(const b of r.bones){assert.deepEqual(b.before.forward,prior.candidates[0].bones.find(p=>p.name===b.name).forward);assert.deepEqual(b.before.reverse,prior.candidates[0].bones.find(p=>p.name===b.name).reverse);}
});
test('initial and runtime new crossings retain separate fixed HRA and internal counts',()=>{
  const s=r.summary;assert.equal(s.examinedPairs,89794);assert.equal(s.currentPairs,232);assert.equal(s.initialPairs,215);assert.equal(s.afterPairs,197);assert.equal(s.newAgainst_current,94);assert.equal(s.newAgainst_initial,11);
  const ids=new Set(r.muscles.map(p=>p.id)),fixedLayers=pairs=>pairs.filter(p=>p.ids.some(id=>!ids.has(id))).reduce((a,p)=>{const layer=p.layers.find((_,i)=>!ids.has(p.ids[i]));a[layer]=(a[layer]||0)+1;return a;},{}),fresh=r.relations.filter(p=>p.after&&!p.initial),runtimeNew=r.relations.filter(p=>p.after&&!p.current);
  assert.equal(fresh.length,11);assert.ok(fresh.every(p=>p.interiorWitness&&p.sourceInternal===null));assert.deepEqual(fixedLayers(fresh),{skin:1,bone:10});assert.deepEqual(fixedLayers(runtimeNew),{skin:10,organ:2,vessel:7,bone:72});
  assert.equal(runtimeNew.filter(p=>p.sourceInternal!==null).length,3);assert.equal(s.sourceInternalPairs,33);assert.equal(s.initialInternalPairs,34);assert.equal(s.afterInternalPairs,34);assert.equal(s.newInternalAgainstSource,1);assert.equal(s.newInternalAgainstInitial,0);
  assert.equal(r.sourceBoneRelations.length,1216);assert.ok(r.sourceBoneRelations.every(p=>p.source===p.initial&&p.initial===p.after));assert.equal(s.sourceSourceBonePairs,23);assert.equal(s.initialSourceBonePairs,23);assert.equal(s.afterSourceBonePairs,23);
});
test('scalar replay verifies all coordinates and only the stated samples and witnesses',()=>{
  assert.equal(a.reportSha256,sha(read(dir+'hip-joint-flow.json')));assert.equal(a.scriptSha256,sha(read('scripts/verify-hip-joint-flow.mjs')));assert.equal(a.candidateSha256,r.binary.sha256);assert.equal(a.vertices,652173);assert.equal(a.indexReferences,3912126);assert.equal(a.coordinateDifferences,0);assert.equal(a.boneVertices,471211);assert.equal(a.boneIndexReferences,2827170);assert.equal(a.jacobianSamples,9728);assert.ok(a.maximumJacobianDifference<1e-14);assert.ok(a.maximumStepBound<.120000000000001);
  assert.equal(a.sampling.surfaces,88);assert.equal(a.sampling.samples,3968);assert.equal(a.sampling.inputTriangles,2109356);assert.equal(a.sampling.maximumPointResidualMm,0);assert.ok(a.sampling.maximumAreaResidualSquareMetres<1e-16);assert.equal(a.witnesses,12);assert.equal(a.missingWitnesses,0);assert.ok(a.maximumWitnessResidualMm<1e-8);assert.ok(a.controlLossReplay.every(p=>p.lossResidual<1e-20));
  for(const f of r.files.filter(f=>!f.file.startsWith('.cache/')))assert.equal(sha(read(f.file)),f.sha256,f.file);
  const review=json(dir+'hip-joint-flow-agy-review.json');assert.equal(review.status,'SUCCESS');assert.match(review.recordKind,/not a verbatim transcript/);assert.equal(review.corrections.length,6);
});
test('six diagnostic captures preserve camera and133 parts without implying app release',()=>{
  assert.equal(c.reportSha256,a.reportSha256);assert.equal(c.priorReportSha256,r.priorSha256);assert.equal(c.auditSha256,sha(read(dir+'hip-joint-flow-readback.json')));assert.equal(c.scriptSha256,sha(read('scripts/capture-hip-joint-flow.mjs')));assert.deepEqual(c.errors,[]);assert.equal(c.captures.length,6);
  const ids=[...r.muscles.map(p=>p.id),...new Set(r.bones.flatMap(p=>p.targetIds)),'HRAF0003'];assert.equal(ids.length,133);
  for(const view of ['front','oblique']){const group=c.captures.filter(p=>p.view===view);assert.deepEqual(group.map(p=>p.state),['legacy','initial','flow']);for(const p of group){assert.deepEqual(p.ids,ids);assert.deepEqual(p.cameraPosition,group[0].cameraPosition);assert.deepEqual(p.target,group[0].target);assert.equal(p.extent,group[0].extent);assert.equal(sha(read(dir+p.file)),p.sha256);}}
  assert.match(c.limits,/Not app\/mobile\/peel or clinical validation/);
});
