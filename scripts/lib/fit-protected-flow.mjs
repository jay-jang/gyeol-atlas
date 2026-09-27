// Common spatial deformation with support balls disjoint from fixed surfaces.
// This protects continuous fixed surfaces, not straight-triangle intersections.
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {compactWeight,applyCompactDisplacement,validateCompactStep} from './compact-displacement.mjs';
const select=(a,n)=>a.length<=n?a:Array.from({length:n},(_,i)=>a[Math.floor(i*(a.length-1)/(n-1))]);
export function fitProtectedFlow(points,closest,clearance,options,onProgress=()=>{}){
  const {iterations,centresPerRound,maximumRadius,minimumRadius,margin,maximumBound,maximumDisplacement,regularization}=options;
  assert.ok(Number.isInteger(iterations)&&iterations>0&&Number.isInteger(centresPerRound)&&centresPerRound>=2);
  assert.ok([maximumRadius,minimumRadius,margin,maximumBound,maximumDisplacement,regularization].every(v=>Number.isFinite(v)&&v>0));
  assert.ok(maximumRadius>=minimumRadius&&maximumBound<1&&points.length>0);
  const samples=points.map(p=>{assert.ok(p.toArray().every(Number.isFinite));return {point:p.clone()};});
  const steps=[],history=[];let lastLoss=Infinity,termination='iteration-limit';
  function measure(){
    let loss=0;
    for(const s of samples){const q=closest(s.point);assert.ok(q.toArray().every(Number.isFinite));s.residual=q.clone().sub(s.point);s.errorSq=s.residual.lengthSq();loss+=s.errorSq/samples.length;}
    assert.ok(loss<=lastLoss+1e-12,'Closest-surface loss increased');lastLoss=loss;return loss;
  }
  for(let iteration=0;iteration<iterations;iteration++){
    const loss=measure();history.push({iteration,loss});
    const centres=[...samples.toSorted((a,b)=>b.errorSq-a.errorSq).slice(0,centresPerRound),...select(samples,centresPerRound)];
    let best=null;
    for(const sample of centres){
      const centre=sample.point,distance=clearance(centre);assert.ok(Number.isFinite(distance)&&distance>=0);
      for(const fraction of [1,.65]){
        const radius=Math.min(maximumRadius,distance-margin)*fraction;
        if(radius<minimumRadius)continue;
        const numerator=new Vector3();let denominator=regularization;
        for(const s of samples){const k=compactWeight(s.point.distanceTo(centre),radius);numerator.addScaledVector(s.residual,k/samples.length);denominator+=k*k/samples.length;}
        const displacement=numerator.clone().multiplyScalar(1/denominator),maximum=Math.min(maximumDisplacement,maximumBound*radius*64/135);
        if(displacement.length()>maximum)displacement.setLength(maximum);
        const reduction=2*displacement.dot(numerator)-displacement.lengthSq()*denominator;
        if(!best||reduction>best.reduction)best={centre:centre.toArray(),radius,displacement:displacement.toArray(),protectedDistance:distance,reduction};
      }
    }
    if(!best){termination='no-admissible-support-ball';break;}
    if(best.reduction<1e-12){termination='predicted-reduction-below-1e-12-m2';break;}
    const {reduction,...step}=best;step.lipschitzBound=validateCompactStep(step,maximumBound);steps.push(step);
    for(const s of samples)applyCompactDisplacement(s.point,step);
    if(iteration%20===0)onProgress({iteration,loss,stepBound:step.lipschitzBound});
  }
  return {steps,history,termination,finalLoss:measure()};
}
