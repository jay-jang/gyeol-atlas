import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {fitCompactConstraints} from '../scripts/lib/fit-compact-constraints.mjs';
const options={iterations:4,radii:[.05],maximumBound:.1,maximumDisplacement:.002,regularization:1e-5,centresPerGroup:2,backtracks:5};
test('actual-loss bounded flow reduces a fixed projection loss without mutating caller points',()=>{
  const points=[new Vector3(),new Vector3(0,.01,0)],before=points.map(p=>p.toArray()),r=fitCompactConstraints([{points,weight:1,closest:p=>new Vector3(.01,p.y,p.z)}],options);assert.ok(r.final.loss<r.initial.loss);assert.equal(r.steps.length,4);assert.ok(r.steps.every(s=>s.lipschitzBound<=.1+1e-14));assert.ok(r.history.every(h=>h.afterLoss<h.beforeLoss));assert.deepEqual(points.map(p=>p.toArray()),before);
});
test('line search halves a trial when a changing constraint invalidates predicted descent',()=>{
  const r=fitCompactConstraints([{points:[new Vector3()],weight:1,closest:p=>new Vector3(p.x>.0008?.5:.01,0,0)}],{...options,iterations:1});assert.equal(r.history[0].backtracks,2);assert.equal(r.steps[0].displacement[0],.0005);assert.equal(r.history[0].trials.length,3);assert.ok(r.history[0].trials[0].loss>r.initial.loss);assert.ok(r.final.loss<r.initial.loss);
});
test('an exhausted line search keeps the original state and invalid options fail early',()=>{
  const r=fitCompactConstraints([{points:[new Vector3()],weight:1,closest:p=>new Vector3(.01+11*p.x,0,0)}],options);assert.equal(r.termination,'actual-loss-line-search-failed');assert.equal(r.steps.length,0);assert.equal(r.final.loss,r.initial.loss);assert.equal(r.history[0].accepted,false);assert.throws(()=>fitCompactConstraints([],{...options,maximumBound:1}));assert.throws(()=>fitCompactConstraints([{points:[new Vector3()],weight:1,closest:()=>new Vector3(NaN,0,0)}],options));
});
