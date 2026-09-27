import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {compactWeight,applyCompactDisplacement,validateCompactStep} from './compact-displacement.mjs';
const select=(a,n)=>a.length<=n?a:Array.from({length:n},(_,i)=>a[Math.floor(i*(a.length-1)/(n-1))]);

// Versioned variant: closest(point, sampleIndex) also supports fixed material
// correspondences. The saved earlier experiment keeps its original helper.
export function fitMaterialConstraints(groups,options,onProgress=()=>{}){
  const {iterations,radii,maximumBound,maximumDisplacement,regularization,centresPerGroup,backtracks}=options;
  assert.ok(Number.isInteger(iterations)&&iterations>0&&Number.isInteger(centresPerGroup)&&centresPerGroup>=2&&Number.isInteger(backtracks)&&backtracks>=0);
  assert.ok(radii.length>0&&radii.every(r=>Number.isFinite(r)&&r>0));assert.ok(maximumBound>0&&maximumBound<1&&Number.isFinite(maximumDisplacement)&&maximumDisplacement>0&&Number.isFinite(regularization)&&regularization>0);
  assert.ok(groups.length&&groups.every(g=>g.points.length&&Number.isFinite(g.weight)&&g.weight>0));
  const samples=groups.flatMap((g,group)=>g.points.map((p,sampleIndex)=>{assert.ok(p.toArray().every(Number.isFinite));return {point:p.clone(),group,sampleIndex,weight:g.weight/g.points.length};}));
  function measure(points){let loss=0;const groupSums=groups.map(()=>0),residuals=[];for(let i=0;i<samples.length;i++){const s=samples[i],point=points[i],q=groups[s.group].closest(point,s.sampleIndex);assert.ok(q.toArray().every(Number.isFinite));const residual=q.clone().sub(point),errorSq=residual.lengthSq();residuals.push({residual,errorSq});loss+=s.weight*errorSq;groupSums[s.group]+=errorSq;}assert.ok(Number.isFinite(loss));return {loss,rmsByGroup:groupSums.map((sum,i)=>Math.sqrt(sum/groups[i].points.length)),residuals};}
  let measured=measure(samples.map(s=>s.point)),termination='iteration-limit';const initial={loss:measured.loss,rmsByGroup:measured.rmsByGroup},steps=[],history=[];
  for(let iteration=0;iteration<iterations;iteration++){
    samples.forEach((s,i)=>Object.assign(s,measured.residuals[i]));const centres=groups.flatMap((_,i)=>{const own=samples.filter(s=>s.group===i);return [...own.toSorted((a,b)=>b.errorSq-a.errorSq).slice(0,centresPerGroup),...select(own,centresPerGroup)].map(s=>s.point);});let best=null;
    for(const centre of centres)for(const radius of radii){const numerator=new Vector3();let denominator=regularization;for(const s of samples){const k=compactWeight(s.point.distanceTo(centre),radius);numerator.addScaledVector(s.residual,s.weight*k);denominator+=s.weight*k*k;}const d=numerator.clone().multiplyScalar(1/denominator),maximum=Math.min(maximumDisplacement,maximumBound*radius*64/135);if(d.length()>maximum)d.setLength(maximum);const reduction=2*d.dot(numerator)-d.lengthSq()*denominator;if(!best||reduction>best.reduction)best={centre:centre.toArray(),radius,displacement:d.toArray(),reduction};}
    assert.ok(best);if(best.reduction<1e-12){termination='predicted-reduction-below-1e-12-m2';break;}
    let accepted=null;const trials=[];
    for(let backtrack=0;backtrack<=backtracks;backtrack++){const scale=2**(-backtrack),step={centre:best.centre,radius:best.radius,displacement:best.displacement.map(v=>v*scale)},points=samples.map(s=>applyCompactDisplacement(s.point.clone(),step)),next=measure(points);step.lipschitzBound=validateCompactStep(step,maximumBound);trials.push({backtrack,scale,loss:next.loss});if(next.loss<measured.loss-1e-15){accepted={step,points,next,backtrack};break;}}
    const row={iteration,beforeLoss:measured.loss,beforeRmsByGroup:measured.rmsByGroup,predictedReduction:best.reduction,trials,accepted:Boolean(accepted)};
    if(!accepted){history.push(row);termination='actual-loss-line-search-failed';break;}
    row.afterLoss=accepted.next.loss;row.afterRmsByGroup=accepted.next.rmsByGroup;row.backtracks=accepted.backtrack;row.stepBound=accepted.step.lipschitzBound;history.push(row);steps.push(accepted.step);samples.forEach((s,i)=>s.point.copy(accepted.points[i]));measured=accepted.next;
    if(iteration%10===0)onProgress(row);
  }
  const final=measure(samples.map(s=>s.point));assert.ok(final.loss<=initial.loss);return {initial,steps,history,termination,final:{loss:final.loss,rmsByGroup:final.rmsByGroup}};
}
