import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Vector3,Quaternion} from 'three';
import {surfaceFrameField} from '../scripts/lib/surface-frame-field.mjs';
const plane=x=>point=>({point:new Vector3(x,point.y,point.z)});
const identity=new Matrix4();
test('identical affine frames reduce exactly to one map despite changing surface weights',()=>{
  const matrix=new Matrix4().compose(new Vector3(.03,.1,-.2),new Quaternion().setFromAxisAngle(new Vector3(1,2,3).normalize(),.4),new Vector3(1.02,1.02,1.02));
  const field=surfaceFrameField([{matrix,nearest:plane(-.1)},{matrix,nearest:plane(.1)}],.02);
  for(const x of [-1,-.1,0,.1,1]){
    const p=new Vector3(x,.2,-.3),r=field(p);
    assert.ok(r.point.distanceTo(p.clone().applyMatrix4(matrix))<1e-12);
    assert.ok(Math.abs(r.determinant-matrix.determinant())<1e-12);
    assert.deepEqual(p.toArray(),[x,.2,-.3]);
  }
});
for(const kernel of ['inverse-square','gaussian'])test(`${kernel} analytic derivatives match centred differences and have no mesh identifier input`,()=>{
  const frames=[{matrix:new Matrix4().makeTranslation(.005,0,0),nearest:plane(-.1)},{matrix:new Matrix4().makeRotationY(.1),nearest:plane(.1)}];
  const field=surfaceFrameField(frames,.02,kernel),step=1e-6;
  for(const x of [-.15,-.1,-.01,0,.01,.1,.15]){
    const p=new Vector3(x,.2,.03),r=field(p);
    assert.deepEqual(field(p),r);
    assert.ok(Math.abs(r.weights.reduce((s,w)=>s+w,0)-1)<1e-12);
    for(let axis=0;axis<3;axis++){
      const before=p.clone(),after=p.clone();before.setComponent(axis,p.getComponent(axis)-step);after.setComponent(axis,p.getComponent(axis)+step);
      const derivative=field(after).point.sub(field(before).point).multiplyScalar(1/(2*step)).toArray();
      for(let row=0;row<3;row++)assert.ok(Math.abs(derivative[row]-r.jacobian[row*3+axis])<1e-7);
    }
  }
});
test('field rejects invalid scales and detects a deliberately folding blend',()=>{
  assert.throws(()=>surfaceFrameField([],1));assert.throws(()=>surfaceFrameField([{matrix:identity,nearest:plane(0)}],0));
  assert.throws(()=>surfaceFrameField([{matrix:new Matrix4().makeScale(-1,1,1),nearest:plane(0)}],.02));
  assert.throws(()=>surfaceFrameField([{matrix:identity,nearest:plane(0)}],1e300));
  assert.throws(()=>surfaceFrameField([{matrix:identity,nearest:plane(0)}],.02,'unknown'));
  const nonaffine=identity.clone();nonaffine.elements[3]=.01;
  assert.throws(()=>surfaceFrameField([{matrix:nonaffine,nearest:plane(0)}],.02));
  const field=surfaceFrameField([{matrix:new Matrix4().makeTranslation(.3,0,0),nearest:plane(-.1)},{matrix:new Matrix4().makeTranslation(-.3,0,0),nearest:plane(.1)}],.02);
  assert.ok(field(new Vector3()).determinant<0);
});
test('Gaussian normalization stays finite far from every anchor',()=>{
  const field=surfaceFrameField([{matrix:identity,nearest:plane(-.1)},{matrix:identity,nearest:plane(.1)}],.02,'gaussian');
  const p=new Vector3(100,3,4),r=field(p);assert.deepEqual(r.point.toArray(),p.toArray());assert.equal(r.determinant,1);assert.equal(r.weights.reduce((s,w)=>s+w,0),1);
});
