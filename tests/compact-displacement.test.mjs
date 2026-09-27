import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Quaternion,Vector3} from 'three';
import {compactWeight,compactBound,compactJacobian,validateCompactStep,applyCompactDisplacement,mapCompactDisplacements} from '../scripts/lib/compact-displacement.mjs';
const step={centre:[.1,.2,.3],radius:.04,displacement:[.002,-.001,.001]};
test('compact step attains its analytic derivative bound and is identity outside support',()=>{
  const L=validateCompactStep(step);assert.ok(L<.25);assert.equal(compactWeight(0,.04),1);assert.equal(compactWeight(.04,.04),0);assert.equal(compactWeight(.05,.04),0);
  assert.throws(()=>compactWeight(-.01,.04));assert.throws(()=>compactWeight(0,0));assert.throws(()=>compactWeight(Infinity,.04));
  assert.throws(()=>validateCompactStep({...step,displacement:[1,0,0]}));assert.throws(()=>validateCompactStep({...step,radius:0}));assert.throws(()=>validateCompactStep({...step,centre:[NaN,0,0]}));assert.throws(()=>validateCompactStep(step,1));
  const direction=new Vector3(...step.displacement).normalize(),p=new Vector3(...step.centre).addScaledVector(direction,step.radius/4);
  assert.ok(Math.abs(compactJacobian(p,step).determinant()-(1-L))<1e-12);
  for(const distance of [.04,.0400001,.1]){
    const q=new Vector3(...step.centre).addScaledVector(direction,distance),old=q.clone();applyCompactDisplacement(q,step);assert.ok(q.distanceTo(old)<1e-15);assert.ok(Math.abs(compactJacobian(old,step).determinant()-1)<1e-12);
  }
  assert.equal(compactBound({...step,displacement:[0,0,0]}),0);
});
test('compact supports avoiding a plane fix every sampled plane point while moving nearby tissue',()=>{
  const s={centre:[0,0,.03],radius:.029999,displacement:[.001,0,-.002]};validateCompactStep(s);
  for(let i=-10;i<=10;i++)for(let j=-10;j<=10;j++){
    const p=new Vector3(i*.005,j*.005,0);assert.deepEqual(applyCompactDisplacement(p.clone(),s).toArray(),p.toArray());
  }
  const p=new Vector3(0,0,.03);assert.ok(applyCompactDisplacement(p.clone(),s).distanceTo(p)>.002);
});
test('compact composition matches finite differences and reverses by contraction without source mutation',()=>{
  const initial=new Matrix4().compose(new Vector3(.03,.07,.1),new Quaternion().setFromAxisAngle(new Vector3(1,2,3).normalize(),.3),new Vector3(1.02,1.02,1.02));
  const steps=[step,{centre:[.09,.19,.3],radius:.05,displacement:[-.001,.002,0]}];steps.forEach(s=>validateCompactStep(s));
  const points=[[.1,.2,.3],[.11,.21,.31],[0,0,0]].map(p=>new Vector3(...p).applyMatrix4(initial.clone().invert()));
  for(const source of points){
    const old=source.toArray(),mapped=mapCompactDisplacements(source,initial,steps,true),J=mapped.jacobian.elements;
    for(let axis=0;axis<3;axis++){
      const a=source.clone(),b=source.clone(),h=1e-7;a.setComponent(axis,a.getComponent(axis)-h);b.setComponent(axis,b.getComponent(axis)+h);
      const numeric=mapCompactDisplacements(b,initial,steps).point.sub(mapCompactDisplacements(a,initial,steps).point).multiplyScalar(1/(2*h));
      for(let row=0;row<3;row++)assert.ok(Math.abs(numeric.getComponent(row)-J[3*axis+row])<1e-8);
    }
    assert.deepEqual(source.toArray(),old);assert.ok(mapped.determinant>0);let inverse=mapped.point.clone();
    for(const s of steps.toReversed()){
      const target=inverse.clone();for(let i=0;i<40;i++)inverse=target.clone().sub(applyCompactDisplacement(inverse.clone(),s).sub(inverse));
    }
    assert.ok(inverse.applyMatrix4(initial.clone().invert()).distanceTo(source)<1e-12);
  }
});
