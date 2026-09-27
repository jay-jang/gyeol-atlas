import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const root='docs/anatomy-alignment/',r=json(root+'lower-body-bone-flow.json'),a=json(root+'lower-body-bone-flow-readback.json'),t=json(root+'lower-body-bone-flow-triangulation.json'),c=json(root+'lower-body-bone-flow-captures.json');
test('common lower-body flow covers all76 source muscles and five bone groups per side without claiming anatomical approval',()=>{
  assert.equal(r.muscles.length,76);assert.equal(r.summary.vertices,652173);assert.equal(r.status.includes('NOT APPROVED'),true);
  for(const side of r.sides){
    assert.deepEqual(side.controls.map(c=>c.name),['Pelvis','Femur','Patella','Tibia','Fibula']);
    assert.equal(side.controls.reduce((n,c)=>n+c.weight,0),1);assert.ok(side.controls.every(c=>c.indices.length===300));
    assert.equal(side.steps.length,240);assert.equal(side.termination,'iteration-limit');assert.equal(side.ligaments.length,4);
    assert.equal(r.muscles.filter(m=>m.side===side.side).length,38);assert.ok(side.final.loss<side.history[0].loss);
    for(const s of side.steps)assert.ok(135*Math.hypot(...s.displacement)/(64*s.radius)<=.15+1e-14);
  }
  assert.equal(r.muscles.reduce((n,m)=>n+m.jacobianSamples.length,0),9728);
});
test('whole-atlas and skin screens preserve failed gates rather than approving a lower fit score',()=>{
  assert.deepEqual(r.summary,{meshes:76,vertices:652173,examinedPairs:89794,legacyOutside:17567,legacyAmbiguous:3,initialOutside:7278,initialAmbiguous:0,afterOutside:8952,afterAmbiguous:0,newLegacyOutside:4810,worsenedLegacyOutside:2377,newInitialOutside:1694,worsenedInitialOutside:5957,currentPairs:232,legacyPairs:211,initialPairs:230,afterPairs:208,newAgainst_current:93,newAgainst_legacy:93,newAgainst_initial:19,newSameSideSourcePairs:0});
  assert.equal(r.summary.examinedPairs,76*1144+76*75/2);
  assert.equal(r.relations.filter(p=>p.after&&!p.initial).length,19);
  assert.ok(r.relations.filter(p=>p.after&&!p.initial).every(p=>p.interiorWitness));
  assert.ok(r.sides.find(s=>s.side==='right').ligaments.find(l=>l.name==='PCL').after.forward.p95Mm>10);
});
test('independent replay separates preserved source-muscle relations from one new discretized muscle-bone crossing',()=>{
  assert.equal(a.reportSha256,sha(read(root+'lower-body-bone-flow.json')));assert.equal(a.binarySha256,r.binary.sha256);
  assert.deepEqual([a.vertices,a.indexReferences,a.coordinateDifferences],[652173,3912126,0]);
  assert.equal(a.boneReadbacks.length,10);assert.equal(a.boneReadbacks.reduce((n,b)=>n+b.vertices,0),275221);
  assert.deepEqual(a.relationSummary,{examinedPairs:380,sourcePairs:17,mappedSourcePairs:18,nativeTargetPairs:60,newMappedSourcePairs:1,removedMappedSourcePairs:0,nativeTargetWithoutSourcePair:44,nativeTargetWithSourcePair:16});
  const pair=a.boneMuscleRelations.filter(p=>!p.source&&p.mappedSource);assert.equal(pair.length,1);assert.equal(pair[0].muscleId,'VHF0028');assert.equal(pair[0].bone,'Pelvis');assert.ok(pair[0].mappedSource.witness);
});
test('refinement resolves only the tested mapped-source pair, not the unchanged native bone or skin failures',()=>{
  assert.equal(t.reportSha256,a.reportSha256);assert.equal(t.auditSha256,sha(read(root+'lower-body-bone-flow-readback.json')));
  assert.deepEqual(t.levels.map(l=>l.crosses),[true,false,false]);
  for(const [i,l] of t.levels.entries())for(const [key,base] of [['muscle',22330],['bone',99308]]){
    assert.equal(l[key].triangles,base*4**i);
    if(i)assert.ok(l[key].maximumCentroidChordErrorMm<t.levels[i-1][key].maximumCentroidChordErrorMm);
  }
  assert.equal(t.subdivisionSha256,sha(read('scripts/lib/subdivide-source.mjs')));
  assert.equal(t.scriptSha256,sha(read('scripts/probe-bone-flow-triangulation.mjs')));
});
test('saved diagnostic source scripts and all eight full-scope paired cameras retain provenance',()=>{
  for(const f of r.files.filter(f=>f.file.startsWith('scripts/')||f.file.startsWith('src/')||f.file.startsWith('data/')))assert.equal(sha(read(f.file)),f.sha256,f.file);
  assert.equal(a.scriptSha256,sha(read('scripts/audit-lower-body-bone-flow.mjs')));
  assert.equal(c.reportSha256,a.reportSha256);assert.equal(c.auditSha256,t.auditSha256);assert.equal(c.scriptSha256,sha(read('scripts/capture-lower-body-bone-flow.mjs')));assert.deepEqual(c.errors,[]);assert.equal(c.captures.length,8);
  for(const s of r.sides)for(const view of ['front','back']){
    const captures=c.captures.filter(p=>p.side===s.side&&p.view===view),expected=[...s.bones.flatMap(b=>b.targetIds),...r.muscles.filter(m=>m.side===s.side).map(m=>m.id),'HRAF0003'];
    assert.equal(expected.length,64);assert.equal(captures.length,2);
    for(const p of captures){assert.deepEqual(p.ids,expected);assert.deepEqual(p.cameraPosition,captures[0].cameraPosition);assert.deepEqual(p.target,captures[0].target);assert.equal(p.extent,captures[0].extent);assert.equal(sha(read(root+p.file)),p.sha256);}
  }
});
