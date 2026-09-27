import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='docs/anatomy-alignment/',read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const r=json(root+'shared-lumbar-leg-frame.json'),a=json(root+'shared-lumbar-leg-frame-readback.json'),c=json(root+'shared-lumbar-leg-frame-captures.json');
test('shared frame has one transform per whole candidate,14 training bones and two excluded vertebrae',()=>{
  assert.match(r.status,/NO RUNTIME EXPORT/);assert.equal(r.training.length,14);assert.deepEqual(r.heldOut,['VERTEBRA_L1','VERTEBRA_L6']);assert.equal(r.sourceBones.length,16);assert.equal(r.legacyMuscles.length,76);assert.equal(r.sampling.length,14);assert.ok(r.sampling.every(p=>r.training.includes(p.name)&&p.source.samples.length===512&&p.target.samples.length===512));
  assert.equal(r.sampling.reduce((s,p)=>s+p.source.inputTriangles+p.target.inputTriangles,0),960019);assert.equal(r.sampling.reduce((s,p)=>s+p.target.exactDuplicateTriangles,0),6648);
  for(const [i,p] of r.candidates.entries()){assert.equal(p.muscles.length,76);assert.equal(p.fit.termination,'maximum-sample-change-threshold');assert.equal(p.fit.history.length,i?46:55);assert.ok(p.fit.history.every(h=>h.correspondences===11452));assert.ok(p.fit.history.at(-1).maximumSampleChangeMm<.00001);assert.equal(p.bones.filter(b=>!b.training).length,2);}
});
test('source relationship preservation does not erase severe fixed-HRA and skin failures',()=>{
  for(const [i,p] of r.candidates.entries()){
    const s=p.summary;assert.equal(s.examinedPairs,89794);assert.equal(s.vertices,652173);assert.equal(s.legacyOutside,17567);assert.equal(s.legacyAmbiguous,3);assert.equal(s.afterOutside,i?125630:122707);assert.equal(s.afterAmbiguous,0);assert.equal(s.newOutside,i?112803:110629);assert.equal(s.worsenedOutside,i?12573:11782);assert.equal(s.currentPairs,232);assert.equal(s.legacyPairs,211);assert.equal(s.afterPairs,i?224:222);assert.equal(s.newAgainst_legacy,i?93:125);assert.equal(s.newAgainst_current,i?93:125);
    assert.equal(s.sourceInternalPairs,33);assert.equal(s.afterInternalPairs,33);assert.equal(s.newInternalPairs,0);assert.equal(s.removedInternalPairs,0);assert.equal(p.sourceBoneRelations.length,1216);assert.ok(p.sourceBoneRelations.every(p=>p.source===p.after));assert.equal(s.sourceBonePairs,23);assert.equal(s.mappedSourceBonePairs,23);
    assert.equal(p.sourceBoneRelations.filter(p=>p.source&&!p.bone.startsWith('VERTEBRA')).length,17);assert.equal(p.sourceBoneRelations.filter(p=>p.source&&p.bone.startsWith('VERTEBRA')).length,6);
    assert.ok(p.relations.filter(p=>p.sourceInternal).every(p=>p.after));assert.ok(p.relations.filter(p=>p.after&&!p.legacy).every(p=>p.interiorWitness));assert.ok(p.bones.find(b=>b.name==='right-Fibula').forward.p95Mm>97);
  }
});
test('independent scalar and area-stratum replay cover all declared points, edges and witness arithmetic',()=>{
  assert.equal(a.reportSha256,sha(read(root+'shared-lumbar-leg-frame.json')));assert.equal(a.sampling.surfaces,28);assert.equal(a.sampling.samples,14336);assert.equal(a.sampling.maximumPointResidualMm,0);assert.ok(a.sampling.maximumAreaResidualSquareMetres<1e-10);assert.equal(a.scriptSha256,sha(read('scripts/verify-shared-lumbar-leg-frame.mjs')));
  for(const [i,p] of a.candidates.entries()){assert.equal(p.binarySha256,r.candidates[i].binary.sha256);assert.equal(p.vertices,652173);assert.equal(p.indexReferences,3912126);assert.equal(p.edgeOccurrences,3912126);assert.equal(p.coordinateDifferences,0);assert.ok(p.determinant>0&&p.maximumGramError<1e-12&&p.maximumScaledEdgeResidualMm<.000117);assert.equal(p.witnesses,i?93:125);assert.equal(p.missingWitnesses,0);assert.ok(p.maximumWitnessResidualMm<1e-8);}
  for(const f of r.files.filter(f=>!f.file.startsWith('.cache/')))assert.equal(sha(read(f.file)),f.sha256,f.file);
});
test('six shared-frame screenshots retain133 declared meshes and common cameras in all states',()=>{
  assert.equal(c.reportSha256,a.reportSha256);assert.equal(c.auditSha256,sha(read(root+'shared-lumbar-leg-frame-readback.json')));assert.equal(c.scriptSha256,sha(read('scripts/capture-shared-lumbar-leg-frame.mjs')));assert.deepEqual(c.errors,[]);assert.equal(c.captures.length,6);
  const ids=[...r.legacyMuscles.map(m=>m.id),...new Set(r.sourceBones.flatMap(p=>p.targetIds)),'HRAF0003'];assert.equal(ids.length,133);
  for(const view of ['front','oblique']){const group=c.captures.filter(p=>p.view===view);assert.deepEqual(group.map(p=>p.state),['legacy','rigid','similarity']);for(const p of group){assert.deepEqual(p.ids,ids);assert.deepEqual(p.target,group[0].target);assert.deepEqual(p.cameraPosition,group[0].cameraPosition);assert.equal(p.extent,group[0].extent);assert.equal(sha(read(root+p.file)),p.sha256);}}
});
