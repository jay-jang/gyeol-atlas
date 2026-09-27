import assert from 'node:assert/strict';
import {Matrix4,Vector3} from 'three';
import {fitRigid} from './rigid-fit.mjs';

// Symmetric pairs have zero means, so the proper least-squares rotation
// cannot absorb a translation. Both inputs are already in one common frame.
export function fitFixedPivot(from,onto,pivot){
  assert.ok(from.length===onto.length&&from.length>=3);
  assert.ok([...from,...onto,pivot].every(p=>p.toArray().every(Number.isFinite)));
  const a=[],b=[];
  for(let i=0;i<from.length;i++){
    const x=from[i].clone().sub(pivot),y=onto[i].clone().sub(pivot);
    a.push(x,x.clone().negate());b.push(y,y.clone().negate());
  }
  const r=fitRigid(a,b);r.setPosition(new Vector3());
  return new Matrix4().makeTranslation(...pivot.toArray()).multiply(r)
    .multiply(new Matrix4().makeTranslation(...pivot.clone().negate().toArray()));
}
