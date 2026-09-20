import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,SphereGeometry,Vector3,BufferGeometry,BufferAttribute} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {surfaceProbe,surfaceTopology,referencedVertices} from '../scripts/lib/surface-containment.mjs';
test('surface audit distinguishes box containment from actual skin, preserves input and records topology',()=>{
  const sphere=new SphereGeometry(1,32,24),indices=Array.from(sphere.index.array),positions=Array.from(sphere.attributes.position.array);
  const probe=surfaceProbe(sphere);
  assert.equal(probe.classify(new Vector3(0,0,0)).kind,'inside');
  assert.equal(probe.classify(new Vector3(.9,.9,.9)).kind,'outside','Inside its AABB is insufficient');
  assert.equal(probe.classify(new Vector3(1,0,0)).kind,'surface-band');
  assert.deepEqual(Array.from(sphere.index.array),indices);
  assert.deepEqual(Array.from(sphere.attributes.position.array),positions);
  probe.dispose();sphere.dispose();
  const box=new BoxGeometry(2,2,2);
  assert.equal(surfaceTopology(box).boundaryEdges,0);
  assert.equal(surfaceTopology(box).connectedComponents,1);
  const p=surfaceProbe(box);
  assert.equal(p.classify(new Vector3(.9,.9,.9)).kind,'inside');p.dispose();box.dispose();
});
test('surface audit samples only vertices actually referenced by triangles',()=>{
  const g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(new Float32Array(15),3));g.setIndex([0,1,3,1,3,4]);
  assert.deepEqual(referencedVertices(g,100),[0,1,3,4]);
  assert.deepEqual(referencedVertices(g,2),[0,4]);g.dispose();
});
test('a closed double skin shell demonstrates why parity is not automatically body containment',()=>{
  const outer=new BoxGeometry(2,2,2),inner=new BoxGeometry(1,1,1),shell=mergeGeometries([outer,inner]);
  const topology=surfaceTopology(shell),probe=surfaceProbe(shell);
  assert.equal(topology.boundaryEdges,0);assert.equal(topology.connectedComponents,2);
  assert.equal(probe.classify(new Vector3()).kind,'outside','Outside the skin-shell solid can still be inside the body envelope');
  probe.dispose();outer.dispose();inner.dispose();shell.dispose();
});
test('one closed manifold component can still be a hollow tissue wall, not a filled body envelope',()=>{
  const positions=[],indices=[],n=32;
  for(const [radius,z] of [[2,-2],[2,2],[1,-2],[1,2]])for(let i=0;i<n;i++){
    positions.push(radius*Math.cos(2*Math.PI*i/n),radius*Math.sin(2*Math.PI*i/n),z);
  }
  for(let i=0;i<n;i++)for(const [a,b] of [[0,1],[1,3],[3,2],[2,0]]){
    const j=(i+1)%n;indices.push(a*n+i,a*n+j,b*n+j,a*n+i,b*n+j,b*n+i);
  }
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));g.setIndex(indices);
  const topology=surfaceTopology(g),probe=surfaceProbe(g);
  assert.equal(topology.connectedComponents,1);assert.equal(topology.boundaryEdges,0);assert.equal(topology.nonManifoldEdges,0);
  assert.equal(probe.classify(new Vector3()).kind,'outside','A cavity is outside the tissue solid, but inside its outer envelope');
  assert.equal(probe.classify(new Vector3(1.5,0,0)).kind,'inside');
  probe.dispose();g.dispose();
});
