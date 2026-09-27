import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Matrix4} from 'three';
import {fitCompactFlow} from '../scripts/lib/fit-compact-flow.mjs';
import {mapCompactDisplacements} from '../scripts/lib/compact-displacement.mjs';
const options={iterations:30,radii:[.04,.1],maximumBound:.2,maximumDisplacement:.003,regularization:1e-5,centresPerGroup:4};
test('shared compact flow reduces a fixed closest-plane objective without mutating inputs',()=>{
  const points=Array.from({length:9},(_,i)=>new Vector3((i%3-1)*.01,.01,(Math.floor(i/3)-1)*.01)),before=points.map(p=>p.toArray());
  const result=fitCompactFlow([{points,weight:1,closest:p=>new Vector3(p.x,0,p.z)}],options);
  assert.ok(result.final.loss<result.history[0].loss*.001);assert.deepEqual(points.map(p=>p.toArray()),before);
  assert.ok(result.steps.every(s=>s.lipschitzBound<=.2+1e-14));
  for(const point of points){const mapped=mapCompactDisplacements(point,new Matrix4(),result.steps,true);assert.ok(mapped.determinant>0);assert.ok(Math.abs(mapped.point.y)<.001);}
});
test('compact flow rejects invalid controls and does not fabricate a step at zero loss',()=>{
  const group={points:[new Vector3()],weight:1,closest:p=>p.clone()};
  const r=fitCompactFlow([group],options);assert.equal(r.steps.length,0);assert.equal(r.final.loss,0);
  assert.throws(()=>fitCompactFlow([] ,options));assert.throws(()=>fitCompactFlow([{...group,weight:0}],options));
  assert.throws(()=>fitCompactFlow([group],{...options,maximumBound:1}));
  assert.throws(()=>fitCompactFlow([{...group,closest:()=>new Vector3(NaN,0,0)}],options));
});
test('nearest-point branch changes on nonconvex targets do not invalidate monotone majorization',()=>{
  const choices=[];
  const result=fitCompactFlow([
    {points:[new Vector3(-.005,0,0)],weight:.9,closest:()=>new Vector3(-.04,0,0)},
    {points:[new Vector3(.001,0,0)],weight:.1,closest:p=>{const x=p.x>0?.01:-.01;choices.push(x);return new Vector3(x,0,0);}},
  ],{...options,radii:[.2]});
  assert.ok(choices.includes(.01)&&choices.includes(-.01),'Nearest target branch must actually change');
  for(let i=1;i<result.history.length;i++)assert.ok(result.history[i].loss<=result.history[i-1].loss+1e-12);
  assert.ok(result.final.loss<result.history[0].loss);
});
