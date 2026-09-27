import assert from 'node:assert/strict';
import {Matrix4,Quaternion,Vector3} from 'three';

// Rotation-vector pose about a declared world-space pivot; translation is in
// world axes. This is a proper rigid adjustment, not a new fitted body scale.
export function rigidPose(parameters,pivot){
  assert.equal(parameters.length,6);assert.ok(parameters.every(Number.isFinite));assert.ok(pivot.toArray().every(Number.isFinite));
  const axis=new Vector3(...parameters.slice(3)),angle=axis.length(),q=new Quaternion();
  if(angle)q.setFromAxisAngle(axis.multiplyScalar(1/angle),angle);
  const position=pivot.clone().add(new Vector3(...parameters.slice(0,3))).sub(pivot.clone().applyQuaternion(q));
  return new Matrix4().compose(position,q,new Vector3(1,1,1));
}

// Deterministic derivative-free search; all accepted poses obey global norm
// bounds. No optimum/success claim is made at the iteration or step limit.
export function searchRigidPose(evaluate,options,onProgress=()=>{}){
  const {iterations,translationBound,rotationBound,translationStep,rotationStep,halvings}=options;
  assert.ok(Number.isInteger(iterations)&&iterations>0&&Number.isInteger(halvings)&&halvings>=0);
  assert.ok([translationBound,rotationBound,translationStep,rotationStep].every(v=>Number.isFinite(v)&&v>0));
  let parameters=[0,0,0,0,0,0],value=evaluate(parameters);assert.ok(Number.isFinite(value.loss)&&value.loss>=0,'Initial pose must have a valid finite objective');
  const initial=value,history=[];let evaluations=1,level=0,termination='iteration-limit';
  for(let iteration=0;iteration<iterations;iteration++){
    let best=null;
    for(let axis=0;axis<6;axis++)for(const sign of [-1,1]){
      const candidate=[...parameters];candidate[axis]+=sign*(axis<3?translationStep:rotationStep)/2**level;
      if(Math.hypot(...candidate.slice(0,3))>translationBound+1e-14||Math.hypot(...candidate.slice(3))>rotationBound+1e-14)continue;
      const result=evaluate(candidate);evaluations++;
      assert.ok(result.loss===Infinity||(Number.isFinite(result.loss)&&result.loss>=0));
      if(result.loss<value.loss-1e-14&&(!best||result.loss<best.value.loss))best={parameters:candidate,value:result};
    }
    history.push({iteration,level,parameters:[...parameters],loss:value.loss,evaluations});
    if(best){parameters=best.parameters;value=best.value;}
    else if(level<halvings)level++;
    else {termination='no-improving-coordinate-neighbour-at-final-step';break;}
    if(iteration%5===0)onProgress({iteration,level,parameters:[...parameters],evaluations,...value});
  }
  return {parameters,initial,final:value,history,evaluations,level,termination};
}
