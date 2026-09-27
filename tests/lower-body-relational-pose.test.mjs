import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='docs/anatomy-alignment/',read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const r=json(root+'lower-body-relational-pose.json'),a=json(root+'lower-body-relational-pose-readback.json'),c=json(root+'lower-body-relational-pose-captures.json');
test('relational pose fits only declared four psoas targets with bounded proper adjustments, not all neurovascular passages',()=>{
  assert.match(r.status,/NOT APPROVED/);assert.equal(r.sides.length,2);assert.equal(r.muscles.length,76);
  assert.deepEqual(r.sides.flatMap(s=>s.relationControls.map(c=>[c.muscleId,c.id])),[['VHF0034','HRAF0608'],['VHF0034','HRAF0653'],['VHF0072','HRAF0592'],['VHF0072','HRAF0654']]);
  for(const s of r.sides){assert.equal(s.skinControls.length,2432);assert.equal(s.boneControls.length,5);assert.ok(s.boneControls.every(c=>c.indices.length===200));assert.ok(s.relationControls.every(c=>c.indices.length===256));assert.equal(s.fit.termination,'no-improving-coordinate-neighbour-at-final-step');assert.ok(s.fit.final.loss<s.fit.initial.loss);assert.ok(Math.hypot(...s.fit.parameters.slice(0,3))<=.02);assert.ok(Math.hypot(...s.fit.parameters.slice(3))<=5*Math.PI/180);}
  assert.deepEqual(r.sides.map(s=>s.invalidEvaluations),[1,0]);
  for(const m of r.muscles){assert.equal(m.sourceTopology.connectedComponents,1);assert.equal(m.sourceTopology.boundaryEdges,0);assert.equal(m.sourceTopology.nonManifoldEdges,0);assert.equal(m.sourceTopology.degenerateTriangles,0);}
});
test('full target-vertex improvement preserves remaining vein/ureter failures and finite scope',()=>{
  const full=r.sides.flatMap(s=>s.relationFullVertices);
  assert.deepEqual(full.map(p=>[p.vertices,p.initialInside,p.afterInside]),[[1645,91,0],[297,194,17],[1426,52,21],[257,15,2]]);
  assert.ok(full.every(p=>p.initialAmbiguous===0&&p.afterAmbiguous===0));
  const pair=(id,muscle)=>r.relations.find(p=>p.ids.includes(id)&&p.ids.includes(muscle));
  assert.equal(pair('HRAF0608','VHF0034').after,false);assert.equal(pair('HRAF0653','VHF0034').after,true);
  assert.equal(pair('HRAF0592','VHF0072').after,true);assert.equal(pair('HRAF0654','VHF0072').after,true);
});
test('global candidate failures are retained despite lower objective and fewer total crossings',()=>{
  assert.deepEqual(r.summary,{meshes:76,vertices:652173,examinedPairs:89794,initialOutside:7278,initialAmbiguous:0,afterOutside:4794,afterAmbiguous:0,newOutside:553,worsenedOutside:217,currentPairs:232,initialPairs:230,afterPairs:203,newAgainst_current:86,newAgainst_initial:24,sourceBonePairs:17,initialBonePairs:17,afterBonePairs:17,newBonePairs:0});
  const added=r.relations.filter(p=>p.after&&!p.initial),counts={};for(const p of added){const key=p.layers.slice().sort().join('/');counts[key]=(counts[key]||0)+1;assert.ok(p.interiorWitness);}
  assert.deepEqual(counts,{'muscle/skin':1,'muscle/muscle':1,'bone/muscle':22});assert.equal(r.relations.filter(p=>p.initial&&!p.after).length,51);
  const femur=r.sides[0].bones.find(b=>b.name==='Femur');assert.ok(femur.after.forward.p95Mm>10&&femur.initial.forward.p95Mm<5);
  assert.equal(r.sourceBoneRelations.length,380);
});
test('serialized scalar replay checks all vertices, indices and edge occurrences with bounded rounding changes',()=>{
  assert.equal(a.reportSha256,sha(read(root+'lower-body-relational-pose.json')));assert.equal(a.binarySha256,r.binary.sha256);assert.equal(a.vertices,652173);assert.equal(a.indexReferences,3912126);assert.equal(a.edgeOccurrences,3912126);assert.equal(a.coordinateDifferences,0);
  assert.ok(a.maximumEdgeLengthChangeMm<.00012);assert.ok(a.maximumVertexDisplacementMm>20&&a.maximumVertexDisplacementMm<22);
  for(const s of a.rigidChecks){assert.ok(s.maximumGramError<1e-12);assert.ok(Math.abs(s.determinant-1)<1e-12);assert.ok(s.translationNormMm<20&&s.rotationDegrees<5);}
  assert.equal(a.scriptSha256,sha(read('scripts/verify-lower-body-relational-pose.mjs')));
  for(const f of r.files.filter(f=>!f.file.startsWith('.cache/')))assert.equal(sha(read(f.file)),f.sha256,f.file);
});
test('eight paired diagnostics distinguish full-side scope from transparent psoas detail',()=>{
  assert.equal(c.reportSha256,a.reportSha256);assert.equal(c.auditSha256,sha(read(root+'lower-body-relational-pose-readback.json')));assert.equal(c.scriptSha256,sha(read('scripts/capture-lower-body-relational-pose.mjs')));assert.deepEqual(c.errors,[]);assert.equal(c.captures.length,8);
  for(const s of r.sides)for(const view of ['overview','psoas-detail']){
    const pair=c.captures.filter(p=>p.side===s.side&&p.view===view),detail=view==='psoas-detail';assert.equal(pair.length,2);
    const expected=[...s.bones.filter(b=>!detail||b.name==='Pelvis').flatMap(b=>b.targetIds),...r.muscles.filter(m=>m.side===s.side&&(!detail||m.id===s.relationControls[0].muscleId)).map(m=>m.id),...s.relationControls.map(c=>c.id),'HRAF0003'];
    assert.equal(expected.length,detail?10:66);
    for(const p of pair){assert.deepEqual(p.ids,expected);assert.equal(sha(read(root+p.file)),p.sha256);assert.deepEqual(p.cameraPosition,pair[0].cameraPosition);assert.deepEqual(p.target,pair[0].target);assert.equal(p.extent,pair[0].extent);}
  }
});
