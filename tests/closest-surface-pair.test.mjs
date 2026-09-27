import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,BufferAttribute,Triangle,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {closestSurfacePair} from '../scripts/lib/closest-surface-pair.mjs';
function geometry(triangles){const g=new BufferGeometry(),values=triangles.flat(2);g.setAttribute('position',new BufferAttribute(new Float32Array(values),3));g.setIndex(Array.from({length:values.length/3},(_,i)=>i));g.computeBoundingBox();g.boundsTree=new MeshBVH(g,{indirect:true,maxLeafSize:1});return g;}
const triangle=(x,z)=>[[x,0,z],[x+1,0,z],[x,1,z]];
test('closest pair resolves indirect traversal indices to original mesh triangles',()=>{
  const triangles=Array.from({length:24},(_,i)=>triangle((23-i)*2,0)),a=geometry(triangles),b=geometry([triangle(0,.25)]),r=closestSurfacePair(a,b);
  assert.ok(Array.from({length:24},(_,i)=>a.boundsTree.resolveTriangleIndex(i)).some((v,i)=>v!==i));assert.equal(r.closest.faceA,23);assert.equal(r.closest.faceB,0);assert.deepEqual(r.closest.triangleA,triangles[23]);assert.ok(Math.abs(r.minimumDistanceMm-250)<1e-8);
  for(const [v,t] of [[r.closest.a,r.closest.triangleA],[r.closest.b,r.closest.triangleB]]){const p=new Vector3(...v),tri=new Triangle(...t.map(v=>new Vector3(...v)));assert.ok(tri.closestPointToPoint(p,new Vector3()).distanceTo(p)<1e-12);}
  a.dispose();b.dispose();
});
test('surface proximity distinguishes a positive gap from transverse contact',()=>{
  const a=geometry([triangle(0,0)]),b=geometry([[[.25,.25,-1],[.25,.25,1],[.75,.25,0]]]),r=closestSurfacePair(a,b);assert.equal(r.minimumDistanceMm,0);assert.ok(Math.hypot(...r.closest.a.map((v,i)=>v-r.closest.b[i]))<1e-12);a.dispose();b.dispose();
});
test('both indirect BVHs resolve their own triangle order',()=>{
  const left=Array.from({length:24},(_,i)=>triangle((23-i)*2,0)),right=Array.from({length:24},(_,i)=>triangle((23-i)*2,i===23?.125:5)),a=geometry(left),b=geometry(right),r=closestSurfacePair(a,b);
  assert.equal(r.closest.faceA,23);assert.equal(r.closest.faceB,23);assert.deepEqual(r.closest.triangleA,left[23]);assert.deepEqual(r.closest.triangleB,right[23]);assert.equal(r.minimumDistanceMm,125);a.dispose();b.dispose();
});
