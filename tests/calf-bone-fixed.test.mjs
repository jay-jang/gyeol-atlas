import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {validateCompactStep} from '../scripts/lib/compact-displacement.mjs';
const root='docs/anatomy-alignment/',read=p=>JSON.parse(fs.readFileSync(p));
const fit=read(`${root}calf-bone-fixed.json`),audit=read(`${root}calf-bone-fixed-audit.json`),captures=read(`${root}calf-bone-fixed-captures.json`);
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sum=(rows,fn)=>rows.reduce((n,r)=>n+fn(r),0);

test('compact calf candidate fixes all eight source bones without claiming their initial pose is correct',()=>{
  assert.match(fit.status,/REJECTED/);assert.match(fit.status,/NO RUNTIME EXPORT/);
  assert.equal(fit.sides.length,2);assert.equal(fit.binary.parts.length,24);
  const bones=fit.sides.flatMap(s=>s.bones);assert.equal(bones.length,8);
  assert.equal(sum(bones,b=>b.preservation.vertices),176356);
  for(const b of bones){
    assert.equal(b.preservation.changedCoordinates,0);assert.equal(b.preservation.maximumPositionDifferenceMetres,0);
    assert.equal(b.preservation.beforeSha256,b.preservation.afterSha256);assert.deepEqual(b.before,b.after);
  }
  for(const side of fit.sides){
    assert.equal(side.termination,'iteration-limit');assert.equal(side.steps.length,240);assert.equal(side.history.length,240);
    assert.deepEqual(side.fitSamples.map(s=>s.weight),[0,0,0,0,1]);assert.equal(side.fitSamples.at(-1).samples,1000);
    for(const step of side.steps){
      assert.ok(Math.abs(validateCompactStep(step)-step.lipschitzBound)<1e-14);
      assert.equal(step.protectedDistances.length,4);
      for(const p of step.protectedDistances)assert.ok(p.distanceMetres-step.radius>=1e-6-1e-9);
    }
    for(let i=1;i<side.history.length;i++)assert.ok(side.history[i].weightedRmsMm<=side.history[i-1].weightedRmsMm+1e-9);
    assert.ok(side.finalWeightedRmsMm<side.history.at(-1).weightedRmsMm);
    assert.ok(side.summary.minimumDeterminant>0);assert.equal(side.summary.newSourceMuscleCrossingPairs,0);
  }
  assert.equal(sum(fit.sides,s=>s.summary.vertices),132027);
  assert.equal(sum(fit.sides,s=>s.summary.beforeOutside),16276);
  assert.equal(sum(fit.sides,s=>s.summary.afterOutside),1777);
  assert.equal(sum(fit.sides,s=>s.summary.newOutside),451);
  assert.equal(sum(fit.sides,s=>s.summary.worsenedOutside),94);
  assert.equal(sum(fit.sides,s=>s.summary.increasedSourcePlaneExtentPairs),7);
});

test('independent scalar readback and exhaustive support search retain their actual scope',()=>{
  assert.equal(audit.candidateSha256,sha(`${root}calf-bone-fixed.json`));
  assert.equal(audit.readback.vertices,132027);assert.equal(audit.readback.indexReferences,791874);
  assert.equal(audit.readback.differentFloat32Coordinates,0);assert.equal(audit.readback.maximumCoordinateResidualMetres,0);
  assert.equal(audit.readback.minimumWitnesses.length,24);
  for(const w of audit.readback.minimumWitnesses)assert.ok(w.maximumElementResidual<1e-8);
  const bones=audit.supportAudit.flatMap(s=>s.bones),checks=audit.supportAudit.flatMap(s=>s.checks);
  assert.equal(sum(bones,b=>b.cornerOccurrences),1058040);assert.equal(checks.length,1920);
  for(const b of bones){assert.equal(b.changedCoordinates,0);assert.equal(b.maximumPositionResidualMetres,0);}
  assert.equal(sum(checks,c=>c.trianglesConsidered),84643200);assert.equal(sum(checks,c=>c.exactChecks),120757);
  for(const c of checks){assert.equal(c.recordedDistanceResidualMetres,0);assert.ok(c.clearanceMetres>=1e-6-1e-9);}
  assert.equal(audit.ambiguities.length,0);
});

test('three-state screen distinguishes inherited initial-pose failures from compact-field changes',()=>{
  const s=audit.summary;assert.equal(s.meshes,1220);assert.equal(s.changedMeshes,24);assert.equal(s.uniquePairs,28980);
  assert.equal(s.beforePairs,80);assert.equal(s.afterPairs,52);assert.equal(s.newPairs,12);assert.equal(s.removedPairs,40);
  assert.deepEqual(s.newByOtherLayer,{bone:7,muscle:4});
  assert.deepEqual(s.fromCommonInitial,{beforePairs:52,afterPairs:52,newPairs:0,removedPairs:0});
  const newPairs=audit.relations.filter(r=>!r.before&&r.after);assert.equal(newPairs.length,12);
  for(const r of newPairs)assert.ok(r.initial);
  const restored=newPairs.filter(r=>r.bothChanged);assert.equal(restored.length,1);
  const pair=restored[0].ids.toSorted().join('/');assert.equal(pair,'VHF0045/VHF0058');
  const source=fit.sides.flatMap(s=>s.sourceMusclePairs).find(r=>r.ids.toSorted().join('/')===pair);
  assert.ok(source.before?.strictPlaneStraddlingPairs>0);
  assert.equal(audit.initialPlacementSkin.length,24);
  assert.equal(sum(audit.initialPlacementSkin,r=>r.initial.outside),6295);
  assert.equal(sum(audit.initialPlacementSkin,r=>r.after.outside),1777);
  assert.equal(sum(audit.initialPlacementSkin,r=>r.newOutside),0);assert.equal(sum(audit.initialPlacementSkin,r=>r.worsenedOutside),0);
  assert.equal(sum(audit.skinCorrespondence,r=>r.queries),482000);
  for(const r of audit.skinCorrespondence){assert.equal(r.worseRestrictedQueries,0);assert.equal(r.maximumExcessDistanceMetres,0);}
});

test('bone-fixed evidence and eight initial/candidate diagnostics retain hashes and fixed camera membership',()=>{
  for(const r of [fit,audit])for(const f of r.files.filter(f=>!f.file.startsWith('.cache/')))assert.equal(sha(f.file),f.sha256,f.file);
  assert.equal(captures.candidateSha256,sha(`${root}calf-bone-fixed.json`));assert.equal(captures.auditSha256,sha(`${root}calf-bone-fixed-audit.json`));
  assert.equal(captures.scriptSha256,sha('scripts/capture-calf-bone-fixed.mjs'));assert.deepEqual(captures.errors,[]);assert.equal(captures.captures.length,8);
  assert.match(captures.limits,/not current public muscle placement/);
  for(const p of captures.captures){assert.equal(sha(`${root}${p.file}`),p.sha256);assert.equal(p.ids.length,33);}
  for(const p of captures.captures.filter(p=>p.state==='initial')){
    const q=captures.captures.find(q=>q.side===p.side&&q.view===p.view&&q.state==='candidate');assert.ok(q);
    assert.deepEqual(q.cameraPosition,p.cameraPosition);assert.deepEqual(q.target,p.target);assert.equal(q.extent,p.extent);assert.deepEqual(q.ids,p.ids);
  }
});
