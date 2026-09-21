import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {Matrix4,Vector3} from 'three';
const read=p=>JSON.parse(fs.readFileSync(p));
const source=read('docs/anatomy-alignment/donor-source-comparison.json');
const fit=read('docs/anatomy-alignment/calf-bone-surface-fits.json');
const matrix=f=>new Matrix4().set(...f.rows[0].map(v=>v*f.scale),f.offset[0],...f.rows[1].map(v=>v*f.scale),f.offset[1],...f.rows[2].map(v=>v*f.scale),f.offset[2],0,0,0,1);
const baseline=read('docs/anatomy-alignment/donor-muscle-relations.json');
for(const [name,count,mode] of [['shank',2,null],['surface-shank',24,'shank'],['surface-whole-leg',50,'whole-leg']]){
  test(`${name} candidate records preserve baseline and source transform composition, not clinical approval`,()=>{
    const report=read(`docs/anatomy-alignment/calf-${name}-candidate.json`);
    assert.equal(report.comparisons.length,count);assert.equal(new Set(report.comparisons.map(r=>r.id)).size,count);
    assert.equal(report.otherMeshesPerCandidate,1219);
    for(const row of report.comparisons){
      const old=baseline.muscles.find(p=>p.id===row.id);assert.deepEqual(row.skinBefore,old.skin);
      const sourceRecord=source.muscles.find(p=>p.id===row.id),oldMatrix=matrix(source.fits[sourceRecord.fitGroup]);
      const target=mode?new Matrix4().fromArray(fit.fits.find(f=>f.side===row.side&&f.mode===mode).sourceToAtlasMatrix):matrix(source.fits[`${row.side}-shank`]);
      const delta=new Matrix4().fromArray(row.sourceToCandidateMatrix);
      for(const p of [[0,0,0],[.1,.5,-.3],[-.2,-.5,.1]]){
        const expected=new Vector3(...p).applyMatrix4(target),actual=new Vector3(...p).applyMatrix4(oldMatrix).applyMatrix4(delta);
        assert.ok(expected.distanceTo(actual)<1e-12);
      }
      assert.equal(row.skinAfter.outside-row.skinBefore.outside,row.skinPointwise.newOutside-row.skinPointwise.resolvedOutside);
    }
    assert.ok(report.comparisons.some(row=>row.pairs.some(p=>!p.before&&p.after)),'Known rejected candidates must not be represented as no-new-crossing fits');
  });
}
test('bone candidate convergence and independent vertex metrics are explicitly bounded',()=>{
  assert.equal(fit.fits.length,4);
  for(const row of fit.fits){
    assert.equal(row.converged,true);assert.equal(row.bones.length,4);
    assert.ok(row.finalSampleRmsMm<row.sampleRmsMm[0]);
    for(const bone of row.bones)for(const direction of ['forward','reverse']){
      assert.ok(bone.after[direction].vertices>0);assert.ok(bone.after[direction].maximumMm>=bone.after[direction].p95Mm);
    }
  }
});
