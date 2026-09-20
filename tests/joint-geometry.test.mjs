import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry} from 'three';
import {jointSurfaceRelation} from '../scripts/lib/joint-geometry.mjs';

test('joint screen reports intersecting triangle surfaces even when vertex minimum stays positive',()=>{
  const a=new BoxGeometry(4,.2,.2),b=new BoxGeometry(.2,4,.2);b.translate(0,0,.05);
  const positions=Array.from(a.attributes.position.array),indices=Array.from(a.index.array);
  const r=jointSurfaceRelation(a,b);
  assert.equal(r.triangleSurfacesIntersect,true);
  assert.ok(r.vertexSurfaceMinimumMm>100,'No vertex need lie at the edge/face intersection');
  assert.deepEqual(Array.from(a.attributes.position.array),positions);assert.deepEqual(Array.from(a.index.array),indices);
  a.dispose();b.dispose();
});

test('surface intersection is false for separated surfaces and for a fully enclosed solid',()=>{
  const a=new BoxGeometry(2,2,2),b=new BoxGeometry(.5,.5,.5);
  assert.equal(jointSurfaceRelation(a,b).triangleSurfacesIntersect,false,'Not a solid-overlap or penetration-volume test');
  b.translate(5,0,0);
  const r=jointSurfaceRelation(a,b);assert.equal(r.triangleSurfacesIntersect,false);assert.ok(r.vertexSurfaceMinimumMm>3000);
  a.dispose();b.dispose();
});
