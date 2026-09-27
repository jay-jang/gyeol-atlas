import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {validateDisplacementStep} from '../scripts/lib/gaussian-displacement.mjs';
const root='docs/anatomy-alignment/',read=p=>JSON.parse(fs.readFileSync(p));
const fit=read(`${root}calf-common-displacement.json`),audit=read(`${root}calf-common-displacement-audit.json`),captures=read(`${root}calf-common-displacement-captures.json`);
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');

test('common calf candidate preserves held-out scope, positive step bounds and honest iteration-limit status',()=>{
  assert.match(fit.status,/REJECTED/);assert.match(fit.status,/NO RUNTIME EXPORT/);
  assert.equal(fit.sides.length,2);assert.equal(fit.binary.parts.length,24);
  let vertices=0,sourcePairs=0;
  for(const side of fit.sides){
    assert.equal(side.termination,'iteration-limit');assert.equal(side.steps.length,120);assert.equal(side.history.length,120);
    assert.deepEqual(side.fitSamples.map(p=>p.name),['Femur','Patella','Tibia','Fibula','skin']);
    assert.equal(side.fitSamples.reduce((n,p)=>n+p.weight,0),1);
    assert.equal(side.fitSamples.reduce((n,p)=>n+p.samples,0),2600);
    for(const s of side.steps)assert.ok(Math.abs(validateDisplacementStep(s)-s.lipschitzBound)<1e-14);
    for(let i=1;i<side.history.length;i++)assert.ok(side.history[i].weightedRmsMm<=side.history[i-1].weightedRmsMm+1e-9);
    assert.ok(side.finalWeightedRmsMm<side.history.at(-1).weightedRmsMm);
    assert.ok(side.summary.minimumDeterminant>0);assert.equal(side.summary.afterOutside,0);
    assert.equal(side.summary.newOutside,0);assert.equal(side.summary.worsenedOutside,0);
    assert.equal(side.muscles.length,12);vertices+=side.summary.vertices;sourcePairs+=side.sourceMusclePairs.length;
    for(const bone of side.bones.filter(b=>b.name==='Tibia'||b.name==='Fibula'))assert.ok(bone.after.forward.p95Mm>bone.before.forward.p95Mm,'Known bone regression must remain visible');
  }
  assert.equal(vertices,132027);assert.equal(sourcePairs,132);
  assert.equal(fit.sides.reduce((n,s)=>n+s.summary.beforeOutside,0),16276);
  assert.equal(fit.sides.reduce((n,s)=>n+s.summary.ambiguousAfter,0),1);
  assert.equal(fit.sides.reduce((n,s)=>n+s.summary.increasedSourcePlaneExtentPairs,0),8);
});

test('saved scalar readback and supplemental rays do not turn an ambiguous original classification into approval',()=>{
  assert.equal(audit.candidateSha256,sha(`${root}calf-common-displacement.json`));
  assert.equal(audit.readback.vertices,132027);assert.equal(audit.readback.indexReferences,791874);
  assert.equal(audit.readback.differentFloat32Coordinates,0);assert.equal(audit.readback.maximumCoordinateResidualMetres,0);
  assert.equal(audit.readback.minimumWitnesses.length,24);
  for(const w of audit.readback.minimumWitnesses)assert.ok(w.maximumElementResidual<1e-8);
  assert.equal(audit.ambiguities.length,1);const a=audit.ambiguities[0];
  assert.equal(a.id,'VHF0020');assert.equal(a.vertex,4793);assert.equal(a.original.kind,'ambiguous');assert.ok(a.original.distance>.002);
  assert.equal(a.rays.length,35);assert.equal(a.rays.filter(r=>r.parity===0).length,1);
  assert.ok(Math.abs(a.signedSolidAngleWinding-1)<1e-12);
  const even=a.rays.find(r=>!r.parity);assert.equal(even.hits.length,5);assert.equal(even.crossings,4);
  assert.ok(even.hits[1].distanceMetres-even.hits[0].distanceMetres<1e-7);
});

test('all changed-versus-runtime pairs preserve 23 failed relationships and distinguish source-restored overlap',()=>{
  const s=audit.summary;assert.equal(s.meshes,1220);assert.equal(s.changedMeshes,24);assert.equal(s.uniquePairs,24*1196+24*23/2);
  assert.equal(s.beforePairs,80);assert.equal(s.afterPairs,66);assert.equal(s.newPairs,23);assert.equal(s.removedPairs,37);
  assert.deepEqual(s.newByOtherLayer,{bone:18,muscle:4});
  const newPairs=audit.relations.filter(r=>!r.before&&r.after);assert.equal(newPairs.length,23);
  assert.equal(newPairs.filter(r=>!r.bothChanged).length,22);
  const restored=newPairs.filter(r=>r.bothChanged);assert.equal(restored.length,1);
  const pair=restored[0].ids.toSorted().join('/');assert.equal(pair,'VHF0045/VHF0058');
  const source=fit.sides.flatMap(s=>s.sourceMusclePairs).find(r=>r.ids.toSorted().join('/')===pair);
  assert.ok(source.before?.strictPlaneStraddlingPairs>0);assert.ok(source.after?.strictPlaneStraddlingPairs>0);
  // Continuous-map injectivity must not be claimed for fixed HRA targets or
  // two independently placed sides; the broad intersection screen is distinct.
  assert.match(audit.limitations.join(' '),/Baseline is actual current low-resolution/);
});

test('candidate inputs, independent audit and eight fixed-camera diagnostics retain reproducible hashes',()=>{
  for(const report of [fit,audit])for(const f of report.files.filter(f=>!f.file.startsWith('.cache/')))assert.equal(sha(f.file),f.sha256,f.file);
  assert.equal(captures.candidateSha256,sha(`${root}calf-common-displacement.json`));assert.equal(captures.auditSha256,sha(`${root}calf-common-displacement-audit.json`));
  assert.equal(captures.scriptSha256,sha('scripts/capture-calf-common-displacement.mjs'));assert.deepEqual(captures.errors,[]);assert.equal(captures.captures.length,8);
  for(const p of captures.captures){assert.equal(sha(`${root}${p.file}`),p.sha256);assert.equal(p.ids.length,33);}
  for(const p of captures.captures.filter(p=>p.state==='current')){
    const q=captures.captures.find(q=>q.side===p.side&&q.view===p.view&&q.state==='candidate');assert.ok(q);
    assert.deepEqual(q.cameraPosition,p.cameraPosition);assert.deepEqual(q.target,p.target);assert.equal(q.extent,p.extent);assert.deepEqual(q.ids,p.ids);
  }
});
