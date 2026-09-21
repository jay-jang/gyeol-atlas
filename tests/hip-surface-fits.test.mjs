import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p));
const hip=read('docs/anatomy-alignment/hip-surface-fits.json');
test('hip targets cover the twelve pinned source components with measured version/packing agreement',()=>{
  assert.equal(hip.targetComponents.length,12);assert.equal(new Set(hip.targetComponents.map(p=>p.id)).size,12);
  assert.equal(hip.versionComparison.length,4);
  for(const c of hip.versionComparison){assert.ok(c.name.includes('ilium'));assert.equal(c.forward.maximumMm,0);assert.equal(c.reverse.maximumMm,0);}
  for(const c of hip.targetComponents){assert.ok(c.boundResidualMm<.01);assert.ok(c.sourceToPacked.vertices>0&&c.packedToSource.vertices>0);}
  for(const side of ['left','right']){
    const fit=hip.fits.find(f=>f.side===side);assert.equal(fit.targetIds.length,6);assert.equal(fit.samples,5000);assert.equal(fit.converged,true);
    const expected=['ilium','ischium','pubis'].flatMap(bone=>['compact','spongy'].map(kind=>`HRA:${bone}_${kind}_bone_${side==='left'?'L':'R'}`)).sort();
    assert.deepEqual(fit.targetIds.map(id=>hip.targetComponents.find(p=>p.id===id).conceptId).sort(),expected);
    assert.ok(fit.after.forward.p95Mm<fit.before.forward.p95Mm);assert.ok(fit.after.reverse.p95Mm<fit.before.reverse.p95Mm);
    assert.ok(fit.after.reverse.maximumMm>8,'Residuals must not be reported as exact registration');
  }
});
test('side-scoped candidates exclude contralateral frames while retaining failed skin gates',()=>{
  const source=read('docs/anatomy-alignment/donor-source-comparison.json');
  for(const name of ['continuous-hip-surface','continuous-hip-per-side']){
    const file=`docs/anatomy-alignment/${name}.json`,r=read(file),back=read(`docs/anatomy-alignment/${name}-readback.json`);
    assert.equal(r.hipSurface,true);assert.equal(r.summary.nonpositiveJacobians,0);assert.ok(r.minimumJacobianWitness.determinant>0);
    assert.equal(r.summary.vertices,652173);assert.equal(r.summary.skinOutsideBefore,17567);assert.match(r.status,/REJECTED/);
    assert.ok(r.summary.newOutside>0&&r.summary.worsenedOutside>0);
    assert.equal(back.candidateReportSha256,createHash('sha256').update(fs.readFileSync(file)).digest('hex'));assert.equal(back.candidateSha256,r.binary.sha256);
    for(const row of r.rows){
      const muscle=source.muscles.find(p=>p.id===row.id),side=source.files.find(p=>p.file===muscle.source).side;assert.equal(row.sourceSide,side);
      assert.equal(row.anchorFrameIndices.length,r.perSide?3:6);
      if(r.perSide)assert.ok(row.anchorFrameIndices.every(i=>r.frames[i].side===side));
      if(row.maximumOutsideWitness){assert.equal(row.maximumOutsideWitness.weights.length,row.anchorFrameIndices.length);assert.ok(Math.abs(row.maximumOutsideWitness.weights.reduce((s,w)=>s+w,0)-1)<1e-12);}
    }
  }
});
