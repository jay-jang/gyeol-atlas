import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,Float32BufferAttribute} from 'three';
import {triangleCrossings} from '../scripts/lib/triangle-crossings.mjs';
const triangle=vertices=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices.flat(),3));return g;};
test('crossing diagnostic distinguishes transverse intersections from coplanar contact',()=>{
  const a=triangle([[0,0,0],[.002,0,0],[0,.002,0]]);
  const b=triangle([[.0005,-.0005,-.001],[.0005,.0015,.001],[.0005,.0015,-.001]]);
  const before=Array.from(a.attributes.position.array);
  const crossing=triangleCrossings(a,b);
  assert.equal(crossing.intersectingTrianglePairs,1);assert.equal(crossing.strictPlaneStraddlingPairs,1);
  assert.ok(crossing.maxTrianglePlaneStraddleExtentMm>.1);
  assert.deepEqual(Array.from(a.attributes.position.array),before);assert.equal(a.index,null);
  const contact=triangleCrossings(a,a);
  assert.equal(contact.intersectingTrianglePairs,1);assert.equal(contact.strictPlaneStraddlingPairs,0);
  b.translate(1,0,0);assert.equal(triangleCrossings(a,b).intersectingTrianglePairs,0);
  a.dispose();b.dispose();
});
test('crossing diagnostic rejects invalid tolerance',()=>{
  assert.throws(()=>triangleCrossings(null,null,NaN),/Invalid tolerance/);
  assert.throws(()=>triangleCrossings(null,null,-1),/Invalid tolerance/);
});
