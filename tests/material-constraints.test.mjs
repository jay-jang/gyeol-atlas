import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,BufferGeometry,BufferAttribute} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {nearestMaterialPoint} from '../scripts/lib/nearest-material-point.mjs';
import {fitMaterialConstraints} from '../scripts/lib/fit-material-constraints.mjs';
import {spatialExtremes} from '../scripts/lib/spatial-extremes.mjs';
test('material correspondences keep their point indices through common compact steps',()=>{
  const points=[new Vector3(),new Vector3(.2,0,0)],targets=[new Vector3(.01,0,0),new Vector3(.19,0,0)],seen=new Set(),r=fitMaterialConstraints([{points,weight:1,closest:(p,i)=>{seen.add(i);return targets[i];}}],{iterations:4,radii:[.05],maximumBound:.1,maximumDisplacement:.002,regularization:1e-5,centresPerGroup:2,backtracks:5});assert.deepEqual([...seen],[0,1]);assert.ok(r.final.loss<r.initial.loss);assert.ok(r.steps.some(s=>s.displacement[0]>0));assert.ok(r.steps.some(s=>s.displacement[0]<0));assert.deepEqual(points.map(p=>p.toArray()),[[0,0,0],[.2,0,0]]);assert.deepEqual(targets.map(p=>p.toArray()),[[.01,0,0],[.19,0,0]]);
});
test('spatial extrema retain the worst point, diversify cells and deterministically fill leftovers',()=>{
  const rows=[{point:[0,0,0],distance:4},{point:[.001,0,0],distance:3},{point:[.1,0,0],distance:2},{point:[-.1,0,0],distance:1}];assert.deepEqual(spatialExtremes(rows,3,.01),[rows[0],rows[2],rows[3]]);assert.deepEqual(spatialExtremes(rows,4,.01),[rows[0],rows[2],rows[3],rows[1]]);assert.deepEqual(spatialExtremes([],3,.01),[]);assert.equal(rows[1].distance,3);assert.throws(()=>spatialExtremes(rows,0,.01));assert.throws(()=>spatialExtremes([{point:[NaN,0,0],distance:1}],1,.01));
});
test('point-to-surface material coordinates use the already resolved original face index',()=>{
  const values=Array.from({length:24},(_,i)=>{const x=(23-i)*2;return [x,0,0,x+1,0,0,x,1,0];}).flat(),g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(values),3));g.setIndex(Array.from({length:values.length/3},(_,i)=>i));g.boundsTree=new MeshBVH(g,{indirect:true,maxLeafSize:1});assert.notEqual(g.boundsTree.resolveTriangleIndex(23),23);
  const r=nearestMaterialPoint(g,new Vector3(.2,.3,.25));assert.equal(r.sourceFace,23);assert.equal(r.distanceMm,250);r.point.forEach((v,i)=>assert.ok(Math.abs(v-[.2,.3,0][i])<1e-12));r.sourceBarycentric.forEach((v,i)=>assert.ok(Math.abs(v-[.5,.2,.3][i])<1e-12));g.dispose();
});
