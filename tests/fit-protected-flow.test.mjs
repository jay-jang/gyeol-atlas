import assert from 'node:assert/strict';
import test from 'node:test';
import {Vector3,BoxGeometry,SphereGeometry} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {fitProtectedFlow} from '../scripts/lib/fit-protected-flow.mjs';
import {applyCompactDisplacement} from '../scripts/lib/compact-displacement.mjs';
const options={iterations:30,centresPerRound:4,maximumRadius:1,minimumRadius:.001,margin:.00001,maximumBound:.15,maximumDisplacement:.05,regularization:.00001};
test('common protected flow improves fit while leaving the whole protected plane outside every support',()=>{
  const points=[new Vector3(1,0,0),new Vector3(1,.1,0),new Vector3(.9,-.1,0)],original=points.map(p=>p.toArray());
  const fit=fitProtectedFlow(points,p=>new Vector3(.8,p.y,p.z),p=>Math.abs(p.x),options);
  assert.ok(fit.finalLoss<fit.history[0].loss);assert.deepEqual(points.map(p=>p.toArray()),original);
  for(const step of fit.steps){assert.ok(step.radius+options.margin<=Math.abs(step.centre[0])+1e-14);assert.ok(step.lipschitzBound<=.15+1e-14);}
  for(const y of [-5,0,.2,3]){const p=new Vector3(0,y,0);for(const step of fit.steps)applyCompactDisplacement(p,step);assert.deepEqual(p.toArray(),[0,y,0]);}
});
test('infeasible supports and invalid clearance cannot be counted as successful fitting',()=>{
  const points=[new Vector3(1,0,0)];
  const fit=fitProtectedFlow(points,()=>new Vector3(),()=>0,options);
  assert.equal(fit.termination,'no-admissible-support-ball');assert.equal(fit.steps.length,0);assert.equal(fit.finalLoss,1);
  assert.throws(()=>fitProtectedFlow(points,()=>new Vector3(),()=>NaN,options));
  assert.throws(()=>fitProtectedFlow(points,()=>new Vector3(),()=>-1,options));
});
test('minimum support radius does not imply a frozen band near the protected surface',()=>{
  const fit=fitProtectedFlow([new Vector3(.01,0,0)],()=>new Vector3(.005,0,0),p=>Math.abs(p.x),{...options,iterations:1,minimumRadius:.003});
  assert.equal(fit.steps.length,1);
  const near=new Vector3(.001,0,0);applyCompactDisplacement(near,fit.steps[0]);
  assert.ok(near.x!==.001&&near.x>0,'A point only1mm from the fixed plane moves inside a larger admissible support');
});
test('merged three-dimensional BVH obstacles remain fixed while an off-axis fit improves',()=>{
  const box=new BoxGeometry(2,2,2),sphere=new SphereGeometry(.5,12,8);sphere.translate(3,0,0);
  const protectedMesh=mergeGeometries([box,sphere]),bvh=new MeshBVH(protectedMesh,{indirect:true});
  const points=[new Vector3(1.8,1.5,.2),new Vector3(2,1.3,-.1),new Vector3(1.6,1.6,.4)];
  const fit=fitProtectedFlow(points,()=>new Vector3(1.65,1.3,.27),p=>bvh.closestPointToPoint(p).distance,options);
  assert.ok(fit.steps.length>0&&fit.finalLoss<fit.history[0].loss);
  for(const step of fit.steps)assert.ok(bvh.closestPointToPoint(new Vector3(...step.centre)).distance-step.radius>=options.margin-1e-14);
  const a=protectedMesh.attributes.position;
  for(let i=0;i<a.count;i++){const p=new Vector3().fromBufferAttribute(a,i),before=p.toArray();for(const step of fit.steps)applyCompactDisplacement(p,step);assert.deepEqual(p.toArray(),before);}
  box.dispose();sphere.dispose();protectedMesh.dispose();
});
