import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {Matrix4,Vector3} from 'three';

const read=file=>JSON.parse(fs.readFileSync(file));
const current=read('docs/anatomy-alignment/joint-bone-surface-fits.json');
const previous=read('docs/anatomy-alignment/calf-bone-surface-fits.json');

test('opt-in thigh fits preserve the four historical fit results',()=>{
  assert.equal(current.fits.length,6);
  for(const old of previous.fits){
    const next=current.fits.find(f=>f.side===old.side&&f.mode===old.mode);
    assert.deepEqual(next,old);
  }
  for(const side of ['left','right']){
    const fit=current.fits.find(f=>f.side===side&&f.mode==='thigh');
    assert.equal(fit.converged,true);
    assert.deepEqual(fit.bones.filter(b=>b.inFit).map(b=>b.name),['Femur','Patella']);
    assert.ok(fit.finalSampleRmsMm<fit.sampleRmsMm[0]);
    // Reduced fit RMS does not imply acceptable full-surface correspondence.
    assert.ok(fit.bones.find(b=>b.name==='Femur').after.forward.p95Mm>12);
  }
});

test('recorded frame-disagreement witnesses reproduce two transforms of one source point',()=>{
  assert.equal(current.jointFrameDisagreement.length,2);
  for(const row of current.jointFrameDisagreement){
    const frame=mode=>new Matrix4().fromArray(current.fits.find(f=>f.side===row.side&&f.mode===mode).sourceToAtlasMatrix);
    const thigh=frame('thigh'),shank=frame('shank');
    assert.equal(row.bones.length,4);
    for(const bone of row.bones){
      const p=new Vector3(...bone.maximumWitness.sourcePointMetres);
      const distance=p.clone().applyMatrix4(thigh).distanceTo(p.clone().applyMatrix4(shank))*1000;
      assert.ok(Math.abs(distance-bone.maximumMm)<1e-9);
      assert.equal(bone.maximumWitness.distanceMm,bone.maximumMm);
      assert.ok(bone.vertices>0&&bone.minimumMm<=bone.medianMm&&bone.medianMm<=bone.p95Mm&&bone.p95Mm<=bone.maximumMm);
      const fit=current.fits.find(f=>f.side===row.side&&f.mode==='thigh');
      assert.equal(bone.vertices,fit.bones.find(b=>b.name===bone.name).after.forward.vertices);
    }
  }
});
