import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Matrix3} from 'three';
test('bone interpolation evidence preserves own frames but rejects muscle reversal and skin regression',()=>{
  const bytes=fs.readFileSync('docs/anatomy-alignment/bone-interpolating-candidate.json'),r=JSON.parse(bytes);
  const back=JSON.parse(fs.readFileSync('docs/anatomy-alignment/bone-interpolating-readback.json'));
  assert.match(r.status,/REJECTED/);assert.match(r.baseline,/Gaussian/);
  assert.equal(r.summary.vertices,652173);assert.equal(r.summary.boneVertices,275221);
  assert.equal(r.summary.changedFloat32BoneVertices,0);assert.equal(r.boneChecks.length,10);
  for(const b of r.boneChecks){assert.equal(b.changedFloat32Vertices,0);assert.equal(b.maximumFrameDisplacementMm,0);}
  assert.equal(r.summary.skinOutsideBefore,7395);assert.equal(r.summary.skinOutsideAfter,7804);
  assert.equal(r.summary.newOutside,609);assert.equal(r.summary.worsenedOutside,2213);
  assert.equal(r.summary.nonpositiveJacobians,24);
  assert.deepEqual(r.rows.filter(row=>row.nonpositiveJacobians).map(row=>[row.id,row.nonpositiveJacobians]),[['VHF0027',22],['VHF0065',2]]);
  for(const row of r.rows)assert.equal(row.skinAfter.outside-row.skinBefore.outside,row.newOutside-row.resolvedOutside);
  const w=r.minimumJacobianWitness;
  assert.equal(new Matrix3().set(...w.jacobian).determinant(),w.determinant);
  assert.ok(w.determinant<-.7&&w.finiteDifference.determinant<-.7);
  assert.ok(w.finiteDifference.maximumElementResidual<2e-7);
  assert.equal(back.candidateReportSha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(back.candidateSha256,r.binary.sha256);assert.equal(back.vertices,652173);assert.equal(back.triangles,1304042);
  assert.equal(back.allTriangleIndicesAndWindingUnchanged,true);assert.equal(back.allMaximumOutsideWitnessesMatchBinary,true);
});
