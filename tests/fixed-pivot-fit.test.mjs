import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Vector3} from 'three';
import {fitFixedPivot} from '../scripts/lib/fixed-pivot-fit.mjs';
const points=[new Vector3(1,2,3),new Vector3(-2,1,4),new Vector3(3,-2,-1),new Vector3(4,1,-3)];
test('fixed-pivot fit recovers a proper rotation around a nonzero pivot',()=>{
  const pivot=new Vector3(.4,-.2,.7),truth=new Matrix4().makeTranslation(...pivot.toArray())
    .multiply(new Matrix4().makeRotationAxis(new Vector3(1,2,3).normalize(),.31))
    .multiply(new Matrix4().makeTranslation(...pivot.clone().negate().toArray()));
  const target=points.map(p=>p.clone().applyMatrix4(truth)),m=fitFixedPivot(points,target,pivot);
  assert.ok(Math.abs(m.determinant()-1)<1e-12);
  assert.ok(pivot.clone().applyMatrix4(m).distanceTo(pivot)<1e-12);
  points.forEach((p,i)=>assert.ok(p.clone().applyMatrix4(m).distanceTo(target[i])<1e-10));
});
test('translation-only mismatch is not silently turned into a free translation',()=>{
  const pivot=new Vector3(.4,-.2,.7),target=points.map(p=>p.clone().add(new Vector3(.1,.2,.3))),m=fitFixedPivot(points,target,pivot);
  assert.ok(pivot.clone().applyMatrix4(m).distanceTo(pivot)<1e-12);
  assert.ok(Math.abs(m.determinant()-1)<1e-12);
  assert.ok(points.some((p,i)=>p.clone().applyMatrix4(m).distanceTo(target[i])>.01));
});
test('fixed-pivot fit rejects mismatched or nonfinite input',()=>{
  assert.throws(()=>fitFixedPivot(points,points.slice(1),new Vector3()));
  assert.throws(()=>fitFixedPivot(points,points,new Vector3(NaN,0,0)));
});
