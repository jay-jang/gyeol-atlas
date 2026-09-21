import assert from 'node:assert/strict';
import {Matrix3,Vector3} from 'three';

// Experimental common spatial map. All callers, regardless of mesh identity,
// use exactly the same source-space distance weights and affine frames.
// A sampled positive Jacobian is not a global injectivity proof.
export function surfaceFrameField(frames,regularizationMetres,kernel='inverse-square'){
  assert.ok(frames.length>0);
  assert.ok(['inverse-square','gaussian'].includes(kernel));
  assert.ok(Number.isFinite(regularizationMetres)&&regularizationMetres>0);
  for(const f of frames){
    assert.ok(f.matrix.elements.every(Number.isFinite));
    assert.deepEqual([3,7,11,15].map(i=>f.matrix.elements[i]),[0,0,0,1],'Only affine frames are supported');
    assert.ok(f.matrix.determinant()>0);
  }
  const epsilon2=regularizationMetres**2;
  assert.ok(Number.isFinite(epsilon2)&&epsilon2>0);
  return point=>{
    assert.ok(point.toArray().every(Number.isFinite));
    let sum=0;const rows=[];
    for(const frame of frames){
      const nearest=frame.nearest(point);
      const difference=point.clone().sub(nearest.point);
      rows.push({frame,difference,distanceSquared:difference.lengthSq(),mapped:point.clone().applyMatrix4(frame.matrix)});
    }
    const minimumDistanceSquared=Math.min(...rows.map(r=>r.distanceSquared));
    for(const r of rows){
      // Common exponential normalization prevents underflow. Its derivative
      // cancels in the normalized weights, so dq can omit this common factor.
      r.q=kernel==='gaussian'?Math.exp((minimumDistanceSquared-r.distanceSquared)/(2*epsilon2)):1/(r.distanceSquared+epsilon2);
      r.gradient=r.difference.multiplyScalar(kernel==='gaussian'?-r.q/epsilon2:-2*r.q*r.q);sum+=r.q;
    }
    assert.ok(Number.isFinite(sum)&&sum>0);
    const mapped=new Vector3();
    for(const r of rows)mapped.addScaledVector(r.mapped,r.q/sum);
    // dF = sum_i w_i A_i + sum_i (T_i p - F) outer (dq_i / sum q).
    // Matrix3.set accepts row-major entries; its elements are column-major.
    const jacobian=Array(9).fill(0);
    for(const r of rows){
      const offset=r.mapped.clone().sub(mapped).toArray(),gradient=r.gradient.toArray(),m=r.frame.matrix.elements;
      for(let i=0;i<3;i++)for(let j=0;j<3;j++)jacobian[i*3+j]+=r.q/sum*m[j*4+i]+offset[i]*gradient[j]/sum;
    }
    return {point:mapped,jacobian,determinant:new Matrix3().set(...jacobian).determinant(),weights:rows.map(r=>r.q/sum),distancesMetres:rows.map(r=>Math.sqrt(r.distanceSquared))};
  };
}
