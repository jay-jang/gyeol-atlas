import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Matrix3} from 'three';
const read=p=>JSON.parse(fs.readFileSync(p));
const reports=['inverse-square','gaussian'].map(kernel=>read(`docs/anatomy-alignment/continuous-${kernel}.json`));
test('continuous candidate evidence compares the same unsimplified source vertices',()=>{
  const packing=read('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative;
  for(const r of reports){
    assert.equal(r.summary.meshes,76);assert.equal(r.summary.vertices,652173);
    assert.equal(r.summary.skinOutsideBefore,17567);
    assert.deepEqual(r.binary.parts,packing.parts);
    const back=read(`docs/anatomy-alignment/continuous-${r.kernel}-readback.json`);
    assert.equal(back.triangles,1304042);assert.equal(back.allTriangleIndicesAndWindingUnchanged,true);
    assert.equal(back.allMaximumOutsideWitnessesMatchBinary,true);
    assert.equal(back.candidateSha256,r.binary.sha256);
    assert.equal(back.candidateReportSha256,createHash('sha256').update(fs.readFileSync(`docs/anatomy-alignment/continuous-${r.kernel}.json`)).digest('hex'));
    for(const row of r.rows){
      assert.equal(row.vertices,packing.parts.find(p=>p.id===row.id).vertexCount);
      assert.equal(row.skinAfter.outside-row.skinBefore.outside,row.newOutside-row.resolvedOutside);
      assert.deepEqual(row.skinBefore,reports[0].rows.find(p=>p.id===row.id).skinBefore);
    }
  }
});
test('skin deterioration and independently reproduced local reversal remain rejected',()=>{
  for(const r of reports){
    assert.match(r.status,/REJECTED/);assert.ok(r.summary.newOutside>0&&r.summary.worsenedOutside>0);
    const w=r.minimumJacobianWitness;
    assert.equal(new Matrix3().set(...w.jacobian).determinant(),w.determinant);
    assert.ok(w.finiteDifference.maximumElementResidual<1e-7);
    assert.ok(Math.abs(new Matrix3().set(...w.finiteDifference.jacobian).determinant()-w.determinant)<1e-7);
    assert.equal(w.determinant,Math.min(...r.rows.map(p=>p.minimumJacobianDeterminant)));
  }
  assert.equal(reports[0].summary.nonpositiveJacobians,0);
  assert.equal(reports[1].summary.nonpositiveJacobians,111);
  assert.ok(reports[1].minimumJacobianWitness.determinant<0);
});
