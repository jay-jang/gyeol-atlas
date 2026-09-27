import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Quaternion,Vector3} from 'three';
import {boneInterpolatingField} from '../scripts/lib/bone-interpolating-field.mjs';
const plane=x=>p=>({point:new Vector3(x,p.y,p.z)});
const frames=[{matrix:new Matrix4(),nearest:plane(0)},{matrix:new Matrix4().makeTranslation(.01,0,0),nearest:plane(.02)}];
test('interpolating field preserves each sole anchor and its affine derivative',()=>{
  const field=boneInterpolatingField(frames);
  for(const [i,x] of [0,.02].entries()){
    const p=new Vector3(x,.1,.2),r=field(p);
    assert.deepEqual(r.point.toArray(),p.clone().applyMatrix4(frames[i].matrix).toArray());
    assert.equal(r.weights[i],1);assert.equal(r.determinant,1);
    assert.deepEqual(r.jacobian,[1,0,0,0,1,0,0,0,1]);
  }
});
test('pairwise Jacobian matches centred differences and remains stable near anchors',()=>{
  const field=boneInterpolatingField(frames);
  for(const x of [-.1,-.01,1e-14,.005,.01,.019,.03]){
    const p=new Vector3(x,.1,.2),r=field(p),step=1e-7;
    for(let axis=0;axis<3;axis++){
      const a=p.clone(),b=p.clone();a.setComponent(axis,a.getComponent(axis)-step);b.setComponent(axis,b.getComponent(axis)+step);
      const d=field(b).point.sub(field(a).point).multiplyScalar(1/(2*step));
      for(let j=0;j<3;j++)assert.ok(Math.abs(d.getComponent(j)-r.jacobian[j*3+axis])<1e-7);
    }
  }
  assert.ok(Math.abs(field(new Vector3(1e-14,0,0)).jacobian[0]-1)<1e-12);
});
test('anchor interpolation is not a no-fold guarantee; conflicting coincident anchors are rejected',()=>{
  const field=boneInterpolatingField([{matrix:new Matrix4().makeTranslation(.03,0,0),nearest:plane(0)},{matrix:new Matrix4(),nearest:plane(.02)}]);
  assert.ok(field(new Vector3(.01,0,0)).determinant<0);
  assert.throws(()=>boneInterpolatingField([{...frames[0]},{matrix:frames[1].matrix,nearest:plane(0)}])(new Vector3()),/Conflicting/);
  assert.throws(()=>boneInterpolatingField([]));
  assert.throws(()=>boneInterpolatingField([{matrix:new Matrix4().makeScale(-1,1,1),nearest:plane(0)}]));
});
test('general rotations, scales and slanted anchor planes retain the full Jacobian convention',()=>{
  const normal=new Vector3(1,2,3).normalize();
  const slanted=offset=>p=>({point:p.clone().addScaledVector(normal,offset-p.dot(normal))});
  const matrix=new Matrix4().compose(new Vector3(.01,-.02,.03),new Quaternion().setFromAxisAngle(normal,.3),new Vector3(1.02,1.02,1.02));
  const field=boneInterpolatingField([{matrix,nearest:slanted(-.1)},{matrix:new Matrix4().makeRotationZ(-.2),nearest:slanted(.1)},{matrix:new Matrix4(),nearest:plane(.05)}]);
  for(const p of [new Vector3(.02,.01,.03),new Vector3(-.02,-.03,.07)]){
    const r=field(p),step=1e-7;
    for(let axis=0;axis<3;axis++){
      const a=p.clone(),b=p.clone();a.setComponent(axis,a.getComponent(axis)-step);b.setComponent(axis,b.getComponent(axis)+step);
      const d=field(b).point.sub(field(a).point).multiplyScalar(1/(2*step));
      for(let j=0;j<3;j++)assert.ok(Math.abs(d.getComponent(j)-r.jacobian[j*3+axis])<1e-7);
    }
  }
});
