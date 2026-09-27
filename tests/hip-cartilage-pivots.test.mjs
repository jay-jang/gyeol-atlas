import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const dir='docs/anatomy-alignment/',read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const s=json(dir+'hip-cartilage-pivots.json'),r=json(dir+'hip-pivot-legs.json'),a=json(dir+'hip-cartilage-pivots-readback.json'),c=json(dir+'hip-pivot-legs-captures.json');
test('source cartilage is a numerical sphere estimate with nonzero residuals, not a supplied joint landmark',()=>{
  assert.match(s.status,/NOT VERIFIED ANATOMICAL JOINT CENTRES/);assert.equal(s.parts.length,4);
  assert.equal(s.parts.reduce((n,p)=>n+p.vertices,0),49188);assert.equal(s.parts.reduce((n,p)=>n+p.indexReferences/3,0),98364);
  for(const p of s.parts){assert.equal(p.sampling.samples.length,2048);assert.equal(p.components.length,1);assert.equal(p.fit.termination,'parameter-change-threshold');assert.ok(p.fullVertexResidual.rmsMm>.7);assert.ok(p.fullVertexResidual.maximumMm>1);}
  assert.ok(s.sideDifferences.every(p=>p.centreDifferenceMm>1&&p.centreDifferenceMm<1.2));
});
test('pivot legs retain composed root scale, fixed pelvis and held-out patella with residual mismatch',()=>{
  assert.match(r.status,/NO RUNTIME EXPORT/);assert.ok(r.rootScale>.995&&r.rootScale<.996);assert.equal(r.candidates.length,4);assert.equal(r.sampling.length,6);assert.equal(r.baseline.length,10);
  for(const p of r.sampling)assert.ok(['Femur','Tibia','Fibula'].includes(p.name));
  for(const p of r.candidates){assert.ok(Math.abs(p.determinant-1)<1e-12);assert.ok(p.pivotMotionMm<1e-8);assert.equal(p.termination,'maximum-sample-change-threshold');assert.ok(p.history.every(h=>h.correspondences===2454));assert.ok(p.history.at(-1).maximumSampleChangeMm<.00001);
    assert.equal(p.bones.filter(b=>b.training).length,3);assert.equal(p.bones.find(b=>b.name==='Patella').training,false);assert.equal(p.bones.find(b=>b.name==='Patella').transformed,true);assert.equal(p.bones.find(b=>b.name==='Pelvis').transformed,false);
    for(const b of p.bones){const before=r.baseline.find(q=>q.side===p.side&&q.name===b.name);if(b.name==='Pelvis'){assert.deepEqual(b.forward,before.forward);assert.deepEqual(b.reverse,before.reverse);}else{assert.ok(b.forward.p95Mm<before.forward.p95Mm);assert.ok(b.forward.p95Mm>6);assert.ok(b.reverse.p95Mm>7);}}
  }
  assert.ok(r.candidates.filter(c=>c.side==='left').every(c=>c.angleDegrees>8.5&&c.angleDegrees<8.6));
  assert.equal(r.sensitivity.reduce((n,p)=>n+p.count,0),176356);assert.ok(r.sensitivity.every(p=>p.maximumMm>.2&&p.maximumMm<.22));
});
test('scalar STL, area and pivot replay remain linked to the exact scripts and records',()=>{
  assert.equal(r.cartilageReportSha256,sha(read(dir+'hip-cartilage-pivots.json')));assert.equal(a.sphereReportSha256,r.cartilageReportSha256);assert.equal(a.legReportSha256,sha(read(dir+'hip-pivot-legs.json')));
  assert.equal(a.scriptSha256,sha(read('scripts/verify-hip-cartilage-pivots.mjs')));assert.equal(a.cartilage.length,4);assert.equal(a.rotations.length,4);assert.equal(a.sampling.surfaces,16);assert.equal(a.sampling.samples,14336);assert.equal(a.sampling.inputTriangles,468024);assert.equal(a.sampling.maximumPointResidualMm,0);assert.ok(a.sampling.maximumAreaResidualSquareMetres<1e-10);
  for(const p of a.rotations)assert.ok(p.maximumGramError<1e-12&&p.pivotMotionMm<1e-8);
  for(const f of [...s.files,...r.files].filter(f=>!f.file.startsWith('.cache/')))assert.equal(sha(read(f.file)),f.sha256,f.file);
  const review=json(dir+'hip-pivot-agy-review.json');assert.equal(review.review.status,'SUCCESS');assert.equal(review.corrections.length,4);
});
test('six diagnostic views keep the same declared skeletal set and camera, not an app or tissue validation',()=>{
  assert.equal(c.reportSha256,a.legReportSha256);assert.equal(c.auditSha256,sha(read(dir+'hip-cartilage-pivots-readback.json')));assert.equal(c.scriptSha256,sha(read('scripts/capture-hip-pivot-legs.mjs')));assert.deepEqual(c.errors,[]);assert.equal(c.captures.length,6);
  const ids=[...r.baseline.map(b=>`source-${b.side}-${b.name}`),...new Set(r.baseline.flatMap(b=>b.targetIds))];
  for(const view of ['front','oblique']){const group=c.captures.filter(p=>p.view===view);assert.deepEqual(group.map(p=>p.state),['root','FemurHead','PelvisAcetabulum']);for(const p of group){assert.deepEqual(p.ids,ids);assert.deepEqual(p.target,group[0].target);assert.deepEqual(p.cameraPosition,group[0].cameraPosition);assert.equal(p.extent,group[0].extent);assert.equal(sha(read(dir+p.file)),p.sha256);}}
});
