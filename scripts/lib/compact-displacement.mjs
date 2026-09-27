// C2 compact radial displacement x -> x + c phi(|x-a|/R), where
// phi(t)=(1-t)^4(4t+1) for t<1, zero otherwise.
// sup |phi'| = 135/64 (at t=1/4), hence sup ||Du||₂ <= 135|c|/(64R).
// L<1 gives an invertible continuous spatial step. Support balls disjoint
// from protected surfaces fix those surfaces exactly in real arithmetic.
// Neither property certifies Float32 triangles or anatomical registration.
import assert from 'node:assert/strict';
import {Matrix3} from 'three';
export function compactWeight(distance,radius){
  if(!Number.isFinite(distance)||distance<0||!Number.isFinite(radius)||radius<=0)throw new RangeError('Expected finite nonnegative distance and positive radius');
  if(distance>=radius)return 0;
  const t=distance/radius,q=1-t;return q*q*q*q*(4*t+1);
}
export function compactBound(step){
  assert.ok(step.centre?.length===3&&step.displacement?.length===3);
  assert.ok([...step.centre,...step.displacement,step.radius].every(Number.isFinite));assert.ok(step.radius>0);
  return 135*Math.hypot(...step.displacement)/(64*step.radius);
}
export function validateCompactStep(step,maximum=.25){
  assert.ok(Number.isFinite(maximum)&&maximum>0&&maximum<1);const bound=compactBound(step);
  assert.ok(bound<=maximum+1e-14,`Unsafe compact displacement ${bound}`);return bound;
}
export function applyCompactDisplacement(point,step){
  const dx=point.x-step.centre[0],dy=point.y-step.centre[1],dz=point.z-step.centre[2],r2=dx*dx+dy*dy+dz*dz;
  if(r2>=step.radius*step.radius)return point;
  const k=compactWeight(Math.sqrt(r2),step.radius);point.x+=k*step.displacement[0];point.y+=k*step.displacement[1];point.z+=k*step.displacement[2];return point;
}
export function compactJacobian(point,step){
  const d=[point.x-step.centre[0],point.y-step.centre[1],point.z-step.centre[2]],r=Math.hypot(...d),R=step.radius;
  if(r>=R)return new Matrix3();
  const factor=-20*(1-r/R)**3/(R*R),gradient=d.map(v=>v*factor),c=step.displacement;
  return new Matrix3().set(...Array.from({length:9},(_,i)=>+(Math.floor(i/3)===i%3)+c[Math.floor(i/3)]*gradient[i%3]));
}
export function mapCompactDisplacements(source,initial,steps,withJacobian=false){
  const point=source.clone().applyMatrix4(initial),jacobian=withJacobian?new Matrix3().setFromMatrix4(initial):null;
  for(const step of steps){
    const dx=point.x-step.centre[0],dy=point.y-step.centre[1],dz=point.z-step.centre[2];
    if(dx*dx+dy*dy+dz*dz>=step.radius*step.radius)continue;
    if(jacobian)jacobian.premultiply(compactJacobian(point,step));applyCompactDisplacement(point,step);
  }
  return {point,jacobian,determinant:jacobian?.determinant()};
}
