// One spatial step x -> x + c exp(-|x-a|²/(2 sigma²)). Units: metres.
// sup ||Du||₂ = |c|/(sigma sqrt(e)). With L < 1, the inverse exists by
// contraction and |F(x)-F(y)| >= (1-L)|x-y|. This continuous-map guarantee
// does NOT transfer automatically to straight triangles or Float32 packing.
import assert from 'node:assert/strict';
import {Matrix3,Vector3} from 'three';

export function displacementBound(step){
  assert.ok(step.centre?.length===3&&step.displacement?.length===3);
  assert.ok([...step.centre,...step.displacement,step.sigma].every(Number.isFinite));
  assert.ok(step.sigma>0);
  return Math.hypot(...step.displacement)/(step.sigma*Math.sqrt(Math.E));
}
export function validateDisplacementStep(step,maximum=.25){
  assert.ok(Number.isFinite(maximum)&&maximum>0&&maximum<1);
  const bound=displacementBound(step);assert.ok(bound<=maximum+1e-14,`Unsafe displacement bound ${bound}`);return bound;
}
export function applyDisplacement(point,step){
  const dx=point.x-step.centre[0],dy=point.y-step.centre[1],dz=point.z-step.centre[2];
  const k=Math.exp(-(dx*dx+dy*dy+dz*dz)/(2*step.sigma*step.sigma));
  point.x+=k*step.displacement[0];point.y+=k*step.displacement[1];point.z+=k*step.displacement[2];return point;
}
export function displacementJacobian(point,step){
  const d=point.clone().sub(new Vector3(...step.centre)),sigma2=step.sigma*step.sigma;
  const gradient=d.multiplyScalar(-Math.exp(-d.lengthSq()/(2*sigma2))/sigma2).toArray(),c=step.displacement;
  return new Matrix3().set(...Array.from({length:9},(_,i)=>+(Math.floor(i/3)===i%3)+c[Math.floor(i/3)]*gradient[i%3]));
}
export function mapDisplacements(source,initial,steps,withJacobian=false){
  const point=source.clone().applyMatrix4(initial),jacobian=withJacobian?new Matrix3().setFromMatrix4(initial):null;
  for(const step of steps){if(jacobian)jacobian.premultiply(displacementJacobian(point,step));applyDisplacement(point,step);}
  return {point,jacobian,determinant:jacobian?.determinant()};
}
