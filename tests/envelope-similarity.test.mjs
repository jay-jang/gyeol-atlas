import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Matrix4,Quaternion,Vector3} from 'three';
const file='docs/anatomy-alignment/envelope-similarity-candidate.json',bytes=fs.readFileSync(file),r=JSON.parse(bytes);
const back=JSON.parse(fs.readFileSync('docs/anatomy-alignment/envelope-similarity-readback.json'));
test('envelope candidate retains failed gates despite decreasing fit residual',()=>{
  assert.match(r.status,/REJECTED/);assert.equal(r.converged,false);assert.equal(r.iterations,200);
  assert.equal(r.fitSelection.samples,5000);assert.equal(r.fitSelection.totalVertices,326280);
  assert.ok(r.fitSelection.eligibleVertices<r.fitSelection.totalVertices);
  assert.equal(r.envelopeDistances.allVerticesAfter.vertices,r.fitSelection.totalVertices);
  assert.ok(r.finalSampleRmsMm<r.sampleRmsMm[0]);assert.ok(r.envelopeDistances.fitEligibleAfter.p95Mm<r.envelopeDistances.fitEligibleBefore.p95Mm);
  assert.equal(r.summary.vertices,652173);assert.equal(r.summary.beforeOutside,17567);
  assert.equal(r.summary.afterOutside,141709);assert.equal(r.summary.newOutside,132932);assert.equal(r.summary.worsenedOutside,7481);
  assert.equal(r.rows.length,76);assert.equal(r.bones.length,10);
  for(const row of r.rows)assert.equal(row.after.outside-row.before.outside,row.newOutside-row.resolvedOutside);
  assert.ok(r.bones.find(b=>b.side==='right'&&b.name==='Fibula').targetToSource.p95Mm>250);
});
test('one proper uniform transform and serialized source topology are distinguished from anatomical accuracy',()=>{
  const m=new Matrix4().fromArray(r.sourceToAtlasMatrix),scale=new Vector3();m.decompose(new Vector3(),new Quaternion(),scale);
  assert.ok(m.determinant()>0);assert.ok(Math.abs(scale.x-scale.y)<1e-12&&Math.abs(scale.x-scale.z)<1e-12);
  assert.ok(Math.abs(scale.x-r.scale)<1e-12);assert.ok(r.scale<.9);
  assert.equal(back.reportSha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(back.candidateSha256,r.binary.sha256);
  assert.equal(back.vertices,652173);assert.equal(back.triangles,1304042);assert.equal(back.unchangedTriangleIndicesAndWinding,true);
  assert.equal(back.allPositionsEqualFloat32CommonSimilarity,true);
  for(const f of back.bilateralFrameRotationDisagreement)assert.ok(f.degrees>15&&f.degrees<18);
});
