import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,BufferAttribute} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {triangleCrossings} from '../scripts/lib/triangle-crossings.mjs';
import {meshCrossingWitness} from '../scripts/lib/triangle-witness.mjs';
test('two triangles can straddle both planes yet meet only at one shared vertex',()=>{
  const make=points=>{const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(points.flat()),3));g.setIndex([0,1,2]);g.boundsTree=new MeshBVH(g,{indirect:true});return g;};
  // In z=0 the intersection interval is x in [0,1]; in y=0 it is [-1,0].
  // Their intersection is the origin only, despite ±1 signed plane distances.
  const a=make([[0,0,0],[1,1,0],[1,-1,0]]),b=make([[0,0,0],[-1,0,1],[-1,0,-1]]);
  const counts=triangleCrossings(a,b);assert.equal(counts.intersectingTrianglePairs,1);assert.equal(counts.strictPlaneStraddlingPairs,1);assert.equal(counts.maxTrianglePlaneStraddleExtentMm,1000);
  assert.equal(meshCrossingWitness(a,b),null);a.dispose();b.dispose();
});
