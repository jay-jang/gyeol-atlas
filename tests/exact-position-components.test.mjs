import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,BufferAttribute} from 'three';
import {exactPositionComponents} from '../scripts/lib/exact-position-components.mjs';
const make=points=>new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(points),3));
test('exact components preserve every triangle corner and distinguish nearby coordinates',()=>{
  const g=make([0,0,0,1,0,0,0,1,0, 0,0,0,0,1,0,-1,0,0, 0,0,1e-8,1,0,1,0,1,1]);
  const original=Array.from(g.attributes.position.array),{geometry,components}=exactPositionComponents(g);
  assert.deepEqual(components.map(c=>[c.triangles,c.vertices]),[[2,4],[1,3]]);
  assert.deepEqual(Array.from(geometry.toNonIndexed().attributes.position.array),original);
  assert.deepEqual(Array.from(g.attributes.position.array),original);
  g.dispose();geometry.dispose();
});
test('indexed input ignores unused vertices; shared point is connectivity, not proof of one tissue',()=>{
  const g=make([0,0,0,1,0,0,0,1,0,-1,0,0,0,-1,0,99,99,99]);g.setIndex([0,1,2,0,3,4]);
  const {geometry,components}=exactPositionComponents(g);
  assert.equal(components.length,1);assert.equal(geometry.attributes.position.count,5);
  assert.deepEqual(components[0].bounds,[[-1,-1,0],[1,1,0]]);
  g.dispose();geometry.dispose();
});
test('invalid triangle count, nonfinite coordinates and out-of-range indices are rejected',()=>{
  for(const g of [make([0,0,0]),make([NaN,0,0,1,0,0,0,1,0]),make([0,0,0,1,0,0,0,1,0]).setIndex([0,1,9])]){
    assert.throws(()=>exactPositionComponents(g));g.dispose();
  }
});
