import assert from 'node:assert/strict';
import {Matrix3,Vector3} from 'three';

// Diagnostic inverse-fourth-distance frame blend. At a sole zero-distance
// anchor, the limiting map/derivative equal that anchor's affine frame.
// This is NOT a model of muscle attachments or an injectivity guarantee.
export function boneInterpolatingField(frames){
  assert.ok(frames.length>0);
  for(const f of frames){
    assert.ok(f.matrix.elements.every(Number.isFinite)&&f.matrix.determinant()>0);
    assert.deepEqual([3,7,11,15].map(i=>f.matrix.elements[i]),[0,0,0,1]);
  }
  return point=>{
    assert.ok(point.toArray().every(Number.isFinite));
    const rows=frames.map(frame=>{
      const nearest=frame.nearest(point).point;
      assert.ok(nearest.toArray().every(Number.isFinite));
      const difference=point.clone().sub(nearest);
      return {frame,difference,d2:difference.lengthSq(),mapped:point.clone().applyMatrix4(frame.matrix)};
    });
    const zero=rows.map((r,i)=>r.d2===0?i:-1).filter(i=>i>=0);
    if(zero.length){
      // Conflicting coincident anchor surfaces have no unique prescribed map.
      for(const i of zero)assert.deepEqual(rows[i].frame.matrix.elements,rows[zero[0]].frame.matrix.elements,'Conflicting zero-distance anchor frames');
      const m=rows[zero[0]].frame.matrix.elements;
      const jacobian=[m[0],m[4],m[8],m[1],m[5],m[9],m[2],m[6],m[10]];
      return {point:rows[zero[0]].mapped,jacobian,determinant:new Matrix3().set(...jacobian).determinant(),weights:rows.map((_,i)=>i===zero[0]?1:0),distancesMetres:rows.map(r=>Math.sqrt(r.d2))};
    }
    const minimum=Math.min(...rows.map(r=>r.d2));let sum=0;
    for(const r of rows){r.q=(minimum/r.d2)**2;sum+=r.q;r.logGradient=r.difference.clone().multiplyScalar(-4/r.d2);}
    assert.ok(Number.isFinite(sum)&&sum>0);
    const mapped=new Vector3(),jacobian=Array(9).fill(0);
    for(const r of rows){
      r.w=r.q/sum;mapped.addScaledVector(r.mapped,r.w);
      const m=r.frame.matrix.elements;
      for(let i=0;i<3;i++)for(let j=0;j<3;j++)jacobian[3*i+j]+=r.w*m[4*j+i];
    }
    // Pairwise form avoids subtracting F from the dominant T_i at tiny d_i.
    // dF = sum w_i A_i + sum(i<j) w_i*w_j*(T_i-T_j) outer (dlogq_i-dlogq_j).
    for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
      const a=rows[i],b=rows[j],factor=a.w*b.w;if(factor===0)continue;
      const delta=a.mapped.clone().sub(b.mapped).toArray(),gradient=a.logGradient.clone().sub(b.logGradient).toArray();
      for(let r=0;r<3;r++)for(let c=0;c<3;c++)jacobian[r*3+c]+=factor*delta[r]*gradient[c];
    }
    assert.ok(mapped.toArray().every(Number.isFinite)&&jacobian.every(Number.isFinite));
    return {point:mapped,jacobian,determinant:new Matrix3().set(...jacobian).determinant(),weights:rows.map(r=>r.w),distancesMetres:rows.map(r=>Math.sqrt(r.d2))};
  };
}
