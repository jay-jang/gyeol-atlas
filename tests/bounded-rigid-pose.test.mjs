import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,BoxGeometry} from 'three';
import {rigidPose,searchRigidPose} from '../scripts/lib/bounded-rigid-pose.mjs';
import {surfaceProbe} from '../scripts/lib/surface-containment.mjs';
const options={iterations:100,translationBound:.02,rotationBound:.1,translationStep:.002,rotationStep:.01,halvings:4};
test('rigid pose preserves distances, proper orientation and the declared pivot translation',()=>{
  const pivot=new Vector3(.1,.8,-.2),parameters=[.003,-.004,.002,.03,-.01,.02],matrix=rigidPose(parameters,pivot);
  assert.ok(Math.abs(matrix.determinant()-1)<1e-14);
  assert.ok(pivot.clone().applyMatrix4(matrix).distanceTo(pivot.clone().add(new Vector3(...parameters.slice(0,3))))<1e-14);
  const a=new Vector3(-.2,.3,.7),b=new Vector3(.2,.8,-.4);assert.ok(Math.abs(a.distanceTo(b)-a.clone().applyMatrix4(matrix).distanceTo(b.clone().applyMatrix4(matrix)))<1e-14);
  const roundtrip=a.clone().applyMatrix4(matrix).applyMatrix4(matrix.clone().invert());assert.ok(roundtrip.distanceTo(a)<1e-14);
});
test('bounded pose search reduces a synthetic objective without accepting out-of-range poses',()=>{
  const target=[.01,-.007,.004,.04,-.03,.02],seen=[];
  const fit=searchRigidPose(p=>{seen.push(p);return {loss:p.reduce((n,v,i)=>n+(v-target[i])**2,0)};},options);
  assert.ok(fit.final.loss<fit.initial.loss/100);assert.ok(seen.every(p=>Math.hypot(...p.slice(0,3))<=.02+1e-14&&Math.hypot(...p.slice(3))<=.1+1e-14));
  assert.ok(fit.history.every((h,i)=>!i||h.loss<=fit.history[i-1].loss));
});
test('invalid and ambiguous objectives fail initially or remain unaccepted candidate poses',()=>{
  assert.throws(()=>searchRigidPose(()=>({loss:NaN}),options));
  const fit=searchRigidPose(p=>({loss:p.some(v=>v!==0)?Infinity:1}),options);
  assert.deepEqual(fit.parameters,[0,0,0,0,0,0]);assert.equal(fit.termination,'no-improving-coordinate-neighbour-at-final-step');
});
test('inverse-pose point classification matches explicit rigid mesh motion across the2mm boundary band',()=>{
  const source=new BoxGeometry(.2,.2,.2),pose=rigidPose([.007,-.002,.005,.02,-.03,.01],new Vector3(.1,.8,-.2)),moved=source.clone().applyMatrix4(pose),before=surfaceProbe(source,.002),after=surfaceProbe(moved,.002);
  for(const [x,kind] of [[0,'inside'],[.099,'surface-band'],[.104,'outside']]){
    const fixed=new Vector3(x,0,0).applyMatrix4(pose),inverse=fixed.clone().applyMatrix4(pose.clone().invert()),a=before.classify(inverse),b=after.classify(fixed);
    assert.equal(a.kind,kind);assert.equal(b.kind,kind);assert.ok(Math.abs(a.distance-b.distance)<1e-7);
  }
  before.dispose();after.dispose();source.dispose();moved.dispose();
});
