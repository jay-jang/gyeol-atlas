// Greedy shared spatial flow. Correspondences are numerical closest points,
// not anatomical landmarks. Every emitted continuous step has ||Du|| < 1.
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {compactWeight,applyCompactDisplacement,validateCompactStep} from './compact-displacement.mjs';
const select=(a,n)=>a.length<=n?a:Array.from({length:n},(_,i)=>a[Math.floor(i*(a.length-1)/(n-1))]);
export function fitCompactFlow(groups,options,onProgress=()=>{}){
  const {iterations,radii,maximumBound,maximumDisplacement,regularization,centresPerGroup}=options;
  assert.ok(Number.isInteger(iterations)&&iterations>0&&Number.isInteger(centresPerGroup)&&centresPerGroup>=2);
  assert.ok(radii.length>0&&radii.every(r=>Number.isFinite(r)&&r>0));
  assert.ok(maximumBound>0&&maximumBound<1&&Number.isFinite(maximumDisplacement)&&maximumDisplacement>0&&Number.isFinite(regularization)&&regularization>0);
  assert.ok(groups.length&&groups.every(g=>g.points.length&&Number.isFinite(g.weight)&&g.weight>0));
  const samples=groups.flatMap((g,group)=>g.points.map(p=>{assert.ok(p.toArray().every(Number.isFinite));return {point:p.clone(),group,weight:g.weight/g.points.length};}));
  const steps=[],history=[];let lastLoss=Infinity,termination='iteration-limit';
  function measure(){
    let loss=0;const groupSums=groups.map(()=>0);
    for(const s of samples){const q=groups[s.group].closest(s.point);assert.ok(q.toArray().every(Number.isFinite));s.residual=q.clone().sub(s.point);s.errorSq=s.residual.lengthSq();loss+=s.weight*s.errorSq;groupSums[s.group]+=s.errorSq;}
    assert.ok(loss<=lastLoss+1e-12,'Closest-surface loss increased');lastLoss=loss;
    return {loss,rmsByGroup:groupSums.map((sum,i)=>Math.sqrt(sum/groups[i].points.length))};
  }
  for(let iteration=0;iteration<iterations;iteration++){
    const measured=measure();history.push({iteration,...measured});
    const centres=groups.flatMap((_,i)=>{const own=samples.filter(s=>s.group===i);return [...own.toSorted((a,b)=>b.errorSq-a.errorSq).slice(0,centresPerGroup),...select(own,centresPerGroup)].map(s=>s.point);});
    let best=null;
    for(const centre of centres)for(const radius of radii){
      const numerator=new Vector3();let denominator=regularization;
      for(const s of samples){const k=compactWeight(s.point.distanceTo(centre),radius);numerator.addScaledVector(s.residual,s.weight*k);denominator+=s.weight*k*k;}
      const d=numerator.clone().multiplyScalar(1/denominator),maximum=Math.min(maximumDisplacement,maximumBound*radius*64/135);
      if(d.length()>maximum)d.setLength(maximum);
      const reduction=2*d.dot(numerator)-d.lengthSq()*denominator;
      if(!best||reduction>best.reduction)best={centre:centre.toArray(),radius,displacement:d.toArray(),reduction};
    }
    assert.ok(best);
    if(best.reduction<1e-12){termination='predicted-reduction-below-1e-12-m2';break;}
    const {reduction,...step}=best;step.lipschitzBound=validateCompactStep(step,maximumBound);steps.push(step);
    for(const s of samples)applyCompactDisplacement(s.point,step);
    if(iteration%20===0)onProgress({iteration,...measured,stepBound:step.lipschitzBound});
  }
  return {steps,history,termination,final:measure()};
}
