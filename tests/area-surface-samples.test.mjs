import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,BufferAttribute,Triangle,Vector3} from 'three';
import {areaSurfaceSamples} from '../scripts/lib/area-surface-samples.mjs';
const geometry=triangles=>{const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(triangles.flat(2)),3));return g;};
const a=[[0,0,0],[1,0,0],[0,1,0]],b=[[3,0,0],[6,0,0],[3,1,0]];
test('area-stratified sampling follows 1:3 areas and preserves all geometry',()=>{
  const g=geometry([a,b]),before=Array.from(g.attributes.position.array),r=areaSurfaceSamples(g,512);assert.equal(r.samples.length,512);assert.equal(r.totalAreaSquareMetres,2);assert.equal(r.samples.filter(p=>p.face===0).length,128);assert.equal(r.samples.filter(p=>p.face===1).length,384);assert.deepEqual(Array.from(g.attributes.position.array),before);
  for(const p of r.samples){assert.ok(p.barycentric.every(x=>x>0&&x<1));assert.ok(Math.abs(p.barycentric.reduce((a,b)=>a+b)-1)<1e-12);const t=new Triangle(...[a,b][p.face].map(v=>new Vector3(...v))),v=new Vector3(...p.point);assert.ok(t.closestPointToPoint(v,new Vector3()).distanceTo(v)<1e-12);}assert.deepEqual(areaSurfaceSamples(g,512),r);g.dispose();
});
test('opposite winding duplicates do not multiply area and low vertex counts still yield distinct points',()=>{
  const g=geometry([a,[a[2],a[1],a[0]]]),r=areaSurfaceSamples(g,512);assert.equal(r.exactDuplicateTriangles,1);assert.equal(r.uniquePositiveAreaTriangles,1);assert.equal(r.totalAreaSquareMetres,.5);assert.equal(new Set(r.samples.map(s=>s.point.join(','))).size,512);g.dispose();
});
test('zero-area triangles are excluded and invalid geometry/sample counts fail',()=>{
  const zero=[[0,0,0],[1,0,0],[2,0,0]],g=geometry([zero,a]);assert.equal(areaSurfaceSamples(g,3).zeroAreaTriangles,1);assert.throws(()=>areaSurfaceSamples(g,0));assert.throws(()=>areaSurfaceSamples(geometry([zero]),3));const bad=geometry([a]);bad.attributes.position.array[0]=NaN;assert.throws(()=>areaSurfaceSamples(bad,2));g.dispose();bad.dispose();
});
