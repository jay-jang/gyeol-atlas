import test from 'node:test';
import assert from 'node:assert/strict';
import {cubicWeight,shearPoint,minimumQuadraticInequalities} from '../scripts/lib/cord-shear.mjs';
test('height-only compact shear preserves height, same-height offsets, endpoints and has an explicit inverse',()=>{
  const field={centres:[1.15,1.16,1.17],spacing:.01,coefficients:[.001,.002,-.003,.001,.001,-.002]};
  for(let i=0;i<=100;i++){
    const p=[.012,1.1+i*.001,-.04],q=shearPoint(p,field),r=shearPoint(q,field,true);
    assert.equal(q[1],p[1]);assert.ok(r.every((x,k)=>Math.abs(x-p[k])<1e-14));
    const s=shearPoint([p[0]+.008,p[1],p[2]-.01],field);assert.ok(Math.abs(s[0]-q[0]-.008)<1e-14);assert.ok(Math.abs(s[2]-q[2]+.01)<1e-14);
    if(p[1]<1.13||p[1]>1.19)assert.deepEqual(q,p);
  }
  assert.equal(cubicWeight(0),2/3);assert.equal(cubicWeight(2),0);assert.equal(cubicWeight(-2),0);
});
test('quadratic half-space solve returns the constrained minimum and does not approve infeasible bounds',()=>{
  const result=minimumQuadraticInequalities([[2,0],[0,1]],[{a:[1,1],b:3},{a:[1,0],b:0},{a:[0,1],b:0}]);
  assert.ok(result.converged);assert.ok(Math.abs(result.coefficients[0]-1)<1e-8);assert.ok(Math.abs(result.coefficients[1]-2)<1e-8);
  const failed=minimumQuadraticInequalities([[1]],[{a:[1],b:2},{a:[-1],b:-1}],{sweeps:20});
  assert.equal(failed.converged,false);assert.ok(failed.maximumViolation>.9);
});
