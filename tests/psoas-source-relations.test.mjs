import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='docs/anatomy-alignment/',read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const r=json(root+'psoas-source-relations.json'),a=json(root+'psoas-source-relations-readback.json');
test('source psoas relationships distinguish shared Denver coordinates from approximate lumbar frames',()=>{
  assert.match(r.status,/NO RUNTIME EXPORT/);assert.deepEqual(r.summary,{examinedSourceMusclePairs:149,sourceMuscleCrossings:1,exactSourceBonePairs:8,exactSourceBoneCrossings:0,approximateLumbarPairs:24,approximateLumbarCrossings:13,hraLumbarPairs:12});
  const crossing=r.sourceMuscleRelations.filter(p=>p.source.crossing);assert.equal(crossing.length,1);assert.deepEqual(crossing[0].ids,['VHF0028','VHF0034']);assert.ok(crossing[0].source.witness);
  const sameFemurs=r.sourceBoneRelations.filter(p=>p.side===p.muscleSide&&p.bone==='Femur');assert.equal(sameFemurs.length,2);assert.ok(sameFemurs.every(p=>p.source.minimumDistanceMm>9&&p.source.minimumDistanceMm<12));
  assert.ok(r.sourceBoneRelations.every(p=>!p.source.crossing&&p.source.minimumDistanceMm>0));
});
test('each nine-pair lumbar change preserves six reproduced, one frame-sensitive and two unreproduced relations',()=>{
  for(const [i,c] of r.newCandidateAttribution.entries()){
    assert.equal(c.pairs.length,i?25:23);const lumbar=c.pairs.filter(p=>p.sourceKind==='approximate-cross-source-lumbar');assert.equal(lumbar.length,9);
    assert.equal(lumbar.filter(p=>p.sourceCrossing.final&&p.sourceCrossing.original).length,6);assert.equal(lumbar.filter(p=>!p.sourceCrossing.final&&!p.sourceCrossing.original).length,2);
    const sensitive=lumbar.filter(p=>p.sourceCrossing.final!==p.sourceCrossing.original);assert.equal(sensitive.length,1);assert.deepEqual(sensitive[0].ids,['HRAF0855','VHF0034']);
    const unavailable=c.pairs.filter(p=>p.sourceKind==='unavailable');assert.equal(unavailable.length,6);assert.ok(unavailable.every(p=>p.sourceCrossing===null));
    const exact=c.pairs.filter(p=>p.sourceKind.startsWith('same-frame'));assert.equal(exact.length,i?10:8);assert.ok(exact.every(p=>p.sourceCrossing===false));
  }
  for(const p of r.hraLumbarRelations){assert.equal(p.currentRuntime.crossing,false);assert.equal(p.currentOfficial.crossing,false);for(const c of p.candidates)assert.equal(c.runtime.crossing,c.official.crossing);}
  assert.deepEqual(['rigid','similarity'].map(mode=>r.hraLumbarRelations.filter(p=>p.candidates.find(c=>c.mode===mode).official.crossing).length),[9,9]);
});
test('stored minimum point and crossing evidence retains every triangle check and exact provenance',()=>{
  assert.equal(a.reportSha256,sha(read(root+'psoas-source-relations.json')));assert.equal(r.priorSha256,sha(read(r.priorFile)));assert.equal(a.scriptSha256,sha(read('scripts/verify-psoas-source-relations.mjs')));assert.equal(a.relations,134);assert.equal(a.closestPoints,268);assert.equal(a.witnesses,55);
  assert.ok(a.maximumClosestPlaneResidualMm<1e-8&&a.maximumDistanceResidualMm<1e-8&&a.maximumWitnessResidualMm<1e-8);
  assert.equal(a.lumbarFrameSensitivity.reduce((s,p)=>s+p.vertices,0),195990);assert.ok(a.lumbarFrameSensitivity[0].maximumMm>.406&&a.lumbarFrameSensitivity[0].maximumMm<.407);
  for(const f of r.files.filter(f=>!f.file.startsWith('.cache/')))assert.equal(sha(read(f.file)),f.sha256,f.file);
});
test('paired source/reference screens fix the psoas pose and distinguish limited diagnostic scope',()=>{
  const c=json(root+'psoas-source-relations-captures.json');assert.equal(c.reportSha256,a.reportSha256);assert.equal(c.auditSha256,sha(read(root+'psoas-source-relations-readback.json')));assert.equal(c.scriptSha256,sha(read('scripts/capture-psoas-source-relations.mjs')));assert.deepEqual(c.errors,[]);assert.equal(c.captures.length,8);
  for(const side of ['left','right'])for(const view of ['front','oblique']){const pair=c.captures.filter(p=>p.side===side&&p.view===view);assert.equal(pair.length,2);assert.deepEqual(pair.map(p=>p.state),['source','hra']);const ids=[`${side}-Pelvis`,`${side}-Femur`,...Array.from({length:6},(_,i)=>`VERTEBRA_L${i+1}`),side==='left'?'VHF0034':'VHF0072'];for(const p of pair){assert.deepEqual(p.ids,ids);assert.deepEqual(p.target,pair[0].target);assert.deepEqual(p.cameraPosition,pair[0].cameraPosition);assert.equal(p.extent,pair[0].extent);assert.equal(sha(read(root+p.file)),p.sha256);}}
});
