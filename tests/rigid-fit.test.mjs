import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Quaternion,Vector3} from 'three';
import {fitRigid} from '../scripts/lib/rigid-fit.mjs';
const points=[[.1,.2,.3],[1,.1,.2],[.2,2,.1],[.3,.2,3],[1,2,3]].map(p=>new Vector3(...p));
test('rigid fit recovers general rotation and translation without changing distances or inputs',()=>{
  const transform=new Matrix4().compose(new Vector3(.2,-.7,1),new Quaternion().setFromAxisAngle(new Vector3(1,2,3).normalize(),.5),new Vector3(1,1,1));
  const old=points.map(p=>p.toArray()),onto=points.map(p=>p.clone().applyMatrix4(transform)),fit=fitRigid(points,onto);
  for(let i=0;i<16;i++)assert.ok(Math.abs(fit.elements[i]-transform.elements[i])<1e-12);
  assert.deepEqual(points.map(p=>p.toArray()),old);
});
test('rigid fit removes scale but recentres the translation for differently scaled data',()=>{
  const q=new Quaternion().setFromAxisAngle(new Vector3(2,1,-3).normalize(),.8),t=new Vector3(.4,.8,-.9),s=1.12;
  const onto=points.map(p=>p.clone().applyQuaternion(q).multiplyScalar(s).add(t)),fit=fitRigid(points,onto);
  const mean=points.reduce((a,b)=>a.add(b),new Vector3()).multiplyScalar(1/points.length),expectedShift=t.clone().add(mean.clone().applyQuaternion(q).multiplyScalar(s-1));
  const expected=new Matrix4().compose(expectedShift,q,new Vector3(1,1,1));
  for(let i=0;i<16;i++)assert.ok(Math.abs(fit.elements[i]-expected.elements[i])<1e-12);
  for(const a of points)for(const b of points)assert.ok(Math.abs(a.clone().applyMatrix4(fit).distanceTo(b.clone().applyMatrix4(fit))-a.distanceTo(b))<1e-12);
  assert.throws(()=>fitRigid([],[]));assert.throws(()=>fitRigid([new Vector3(),new Vector3(),new Vector3()],[new Vector3(),new Vector3(),new Vector3()]));
});
