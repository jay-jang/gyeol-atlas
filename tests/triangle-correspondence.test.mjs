import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,Float32BufferAttribute,Matrix4} from 'three';
import {matchTriangles} from '../scripts/lib/triangle-correspondence.mjs';
const geometry=(positions,indices)=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);return g;};
test('triangle matching ignores array order while checking all corners and one-to-one membership',()=>{
  const a=geometry([0,0,0,1,0,0,0,1,0,1,1,0],[0,1,2,1,3,2]);
  const b=geometry([-1,1,0,0,1,0,-1,0,0,0,0,0],[1,0,2,1,2,3]);
  const result=matchTriangles(a,b,new Matrix4().makeScale(-1,1,1),1e-6);
  assert.equal(result.complete,true);assert.equal(result.matched,2);assert.equal(result.reversedWinding,2);
  assert.equal(result.maxMatchedVertexErrorMm,0);
  const duplicate=geometry([0,0,0,1,0,0,0,1,0],[0,1,2,0,1,2]);
  const incomplete=matchTriangles(duplicate,a,new Matrix4(),1e-6);
  assert.equal(incomplete.complete,false);assert.equal(incomplete.matched,1);
});
test('matching centroids alone cannot pass wrong-shaped triangles or invalid tolerance',()=>{
  const a=geometry([0,0,0,1,0,0,0,1,0],[0,1,2]);
  const b=geometry([-.1,0,0,1.1,0,0,0,1,0],[0,1,2]);
  assert.equal(matchTriangles(a,b,new Matrix4(),.001).complete,false);
  assert.throws(()=>matchTriangles(a,b,new Matrix4(),0));
});
