import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Quaternion,Vector3} from 'three';
import {applyDisplacement,displacementBound,displacementJacobian,mapDisplacements,validateDisplacementStep} from '../scripts/lib/gaussian-displacement.mjs';

const step={centre:[.1,-.2,.3],displacement:[.004,-.003,.002],sigma:.04};
test('Gaussian displacement enforces a strict global Lipschitz bound rather than a sampled determinant test',()=>{
  const L=validateDisplacementStep(step);assert.ok(L<.25);
  assert.throws(()=>validateDisplacementStep({...step,displacement:[1,0,0]}));
  assert.throws(()=>validateDisplacementStep({...step,sigma:0}));
  assert.throws(()=>validateDisplacementStep({...step,centre:[NaN,0,0]}));
  assert.throws(()=>validateDisplacementStep(step,1));
  assert.equal(displacementBound({...step,displacement:[0,0,0]}),0);
  const centre=new Vector3(...step.centre),direction=new Vector3(...step.displacement).normalize();
  // At this point the rank-one derivative reaches the negative determinant bound.
  const p=centre.clone().addScaledVector(direction,step.sigma),J=displacementJacobian(p,step);
  assert.ok(Math.abs(J.determinant()-(1-L))<1e-12);
  for(let i=0;i<50;i++){
    const a=centre.clone().add(new Vector3(Math.sin(i),Math.cos(i),Math.sin(2*i)).multiplyScalar(.06));
    const b=centre.clone().add(new Vector3(Math.cos(2*i),Math.sin(3*i),Math.cos(i)).multiplyScalar(.06));
    assert.ok(applyDisplacement(a.clone(),step).distanceTo(applyDisplacement(b.clone(),step))>=(1-L)*a.distanceTo(b)-1e-12);
  }
});

test('composed displacement derivative matches central differences after a rotated positive-scale initial map',()=>{
  const initial=new Matrix4().compose(new Vector3(.03,-.05,.12),new Quaternion().setFromAxisAngle(new Vector3(1,2,3).normalize(),.4),new Vector3(1.03,1.03,1.03));
  const steps=[step,{centre:[.11,-.19,.31],displacement:[-.002,.001,.003],sigma:.03}];steps.forEach(s=>validateDisplacementStep(s));
  for(const p of [[.07,-.1,.15],[0,0,0],[.2,-.3,.1]]){
    const source=new Vector3(...p),before=source.toArray(),mapped=mapDisplacements(source,initial,steps,true),J=mapped.jacobian.elements,h=1e-7;
    for(let axis=0;axis<3;axis++){
      const a=source.clone(),b=source.clone();a.setComponent(axis,a.getComponent(axis)-h);b.setComponent(axis,b.getComponent(axis)+h);
      const numeric=mapDisplacements(b,initial,steps).point.sub(mapDisplacements(a,initial,steps).point).multiplyScalar(1/(2*h));
      for(let row=0;row<3;row++)assert.ok(Math.abs(numeric.getComponent(row)-J[3*axis+row])<1e-8);
    }
    assert.deepEqual(source.toArray(),before);assert.ok(mapped.determinant>0);
    let inverse=mapped.point.clone();
    for(const s of steps.toReversed()){
      const target=inverse.clone();for(let iteration=0;iteration<30;iteration++)inverse=target.clone().sub(applyDisplacement(inverse.clone(),s).sub(inverse));
    }
    inverse.applyMatrix4(initial.clone().invert());assert.ok(inverse.distanceTo(source)<1e-12);
  }
});
