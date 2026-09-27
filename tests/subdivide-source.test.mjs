import test from 'node:test';
import assert from 'node:assert/strict';
import {subdivideSourceTriangles} from '../scripts/lib/subdivide-source.mjs';
test('planar subdivision preserves winding and area and shares an edge midpoint without changing the source',()=>{
  const input={positions:Float64Array.from([0,0,0,1,0,0,1,1,0,0,1,0]),indices:Uint32Array.from([0,1,2,0,2,3])},before=structuredClone(input),out=subdivideSourceTriangles(input);
  assert.deepEqual(input,before);assert.equal(out.positions.length/3,9);assert.equal(out.indices.length/3,8);
  const vertices=Array.from({length:9},(_,i)=>Array.from(out.positions.subarray(i*3,i*3+3)));
  assert.equal(vertices.filter(p=>p[0]===.5&&p[1]===.5&&p[2]===0).length,1);let area=0;
  for(let i=0;i<out.indices.length;i+=3){const [a,b,c]=Array.from(out.indices.subarray(i,i+3),id=>vertices[id]);const twice=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);assert.ok(twice>0);area+=twice/2;assert.ok([a,b,c].every(p=>p[2]===0));}
  assert.equal(area,1);
});
test('source subdivision rejects nonfinite points, malformed faces and invalid indices',()=>{
  const input={positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,2]};
  assert.throws(()=>subdivideSourceTriangles({...input,positions:[NaN,...input.positions.slice(1)]}));
  assert.throws(()=>subdivideSourceTriangles({...input,indices:[0,1]}));
  for(const value of [3,-1,.5])assert.throws(()=>subdivideSourceTriangles({...input,indices:[0,1,value]}));
});
