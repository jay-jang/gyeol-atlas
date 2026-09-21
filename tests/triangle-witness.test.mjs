import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Triangle} from 'three';
import {segmentTriangleHit,transverseTriangleWitness} from '../scripts/lib/triangle-witness.mjs';
const v=(x,y,z)=>new Vector3(x,y,z);
const a=new Triangle(v(-1,-1,0),v(1,-1,0),v(0,1,0));
test('independent witness requires segment interior and triangle barycentric inclusion',()=>{
  const hit=segmentTriangleHit(v(0,0,-1),v(0,0,1),a);
  assert.deepEqual(hit.point,[0,0,0]);assert.equal(hit.segmentFraction,.5);
  assert.equal(segmentTriangleHit(v(2,2,-1),v(2,2,1),a),null);
  assert.equal(segmentTriangleHit(v(0,0,0),v(0,0,1),a),null);
  assert.equal(segmentTriangleHit(v(-.1,0,0),v(.1,0,0),a),null);
  assert.equal(segmentTriangleHit(v(0,-1,-1),v(0,-1,1),a),null);
});
test('transverse witness excludes disjoint and coplanar triangles',()=>{
  const b=new Triangle(v(0,-.5,-1),v(0,-.5,1),v(0,.5,.2));
  assert.ok(transverseTriangleWitness(a,b));assert.ok(transverseTriangleWitness(b,a));
  const outside=new Triangle(v(2,-.5,-1),v(2,-.5,1),v(2,.5,.2));
  assert.equal(transverseTriangleWitness(a,outside),null);
  assert.equal(transverseTriangleWitness(a,a),null);
  assert.throws(()=>transverseTriangleWitness(a,b,-1),/Invalid/);
});
