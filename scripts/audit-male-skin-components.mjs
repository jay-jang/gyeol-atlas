// Position-exact component topology of the deployed male skin, offline only.
// This does not create a filled body or redefine the rendered skin.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {BufferAttribute,BufferGeometry,Matrix4,Vector3} from 'three';
import {surfaceTopology} from './lib/surface-containment.mjs';

const source='public/models/skin.glb',doc=await new NodeIO().read(source);
const node=doc.getRoot().listNodes().find(n=>n.getName()==='FMA7163');
assert.ok(node?.getMesh(),'Expected deployed male skin FMA7163');
const primitives=node.getMesh().listPrimitives();assert.equal(primitives.length,1);
const primitive=primitives[0],position=primitive.getAttribute('POSITION').getArray();
const originalIndex=primitive.getIndices()?.getArray();
const count=originalIndex?.length??position.length/3;
assert.equal(count%3,0);
const matrix=new Matrix4().fromArray(node.getWorldMatrix());
const original=new BufferGeometry();
original.setAttribute('position',new BufferAttribute(new Float32Array(position),3));
if(originalIndex)original.setIndex(new BufferAttribute(new Uint32Array(originalIndex),1));
original.applyMatrix4(matrix);
const array=original.getAttribute('position'),point=new Vector3(),welded=[],vertices=[],parents=[];
const lookup=new Map();
const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
for(let i=0;i<array.count;i++){
  point.fromBufferAttribute(array,i);
  const key=point.toArray().join('/');
  if(!lookup.has(key)){
    lookup.set(key,parents.length);parents.push(parents.length);vertices.push(...point.toArray());
  }
  welded.push(lookup.get(key));
}
const triangleIds=[];
for(let i=0;i<count;i+=3){
  const ids=[0,1,2].map(j=>welded[originalIndex?originalIndex[i+j]:i+j]);
  parents[root(ids[1])]=root(ids[0]);parents[root(ids[2])]=root(ids[0]);
  triangleIds.push(ids);
}
const groups=new Map();
for(const ids of triangleIds){const id=root(ids[0]);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(ids);}
const ranked=[...groups.entries()].sort((a,b)=>b[1].length-a[1].length);
const topology=surfaceTopology(original),components=[];
for(const [groupId,triangles] of ranked){
  const remap=new Map(),points=[],indices=[];
  for(const ids of triangles)for(const id of ids){
    if(!remap.has(id)){remap.set(id,remap.size);points.push(...vertices.slice(3*id,3*id+3));}
    indices.push(remap.get(id));
  }
  const g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(new Float32Array(points),3));
  g.setIndex(new BufferAttribute(new Uint32Array(indices),1));
  g.computeBoundingBox();
  const faces=new Map(),edges=new Map(),uniqueIndices=[];
  for(let i=0;i<indices.length;i+=3){
    const face=indices.slice(i,i+3),key=[...face].sort((a,b)=>a-b).join('/');
    faces.set(key,(faces.get(key)||0)+1);
    if(faces.get(key)===1)uniqueIndices.push(...face);
    for(let j=0;j<3;j++){
      const a=face[j],b=face[(j+1)%3],edge=a<b?`${a}/${b}`:`${b}/${a}`;
      edges.set(edge,(edges.get(edge)||0)+1);
    }
  }
  const deduplicated=new BufferGeometry();
  deduplicated.setAttribute('position',new BufferAttribute(new Float32Array(points),3));
  deduplicated.setIndex(new BufferAttribute(new Uint32Array(uniqueIndices),1));
  components.push({triangles:triangles.length,vertices:remap.size,
    bounds:[g.boundingBox.min.toArray(),g.boundingBox.max.toArray()],
    topology:surfaceTopology(g),
    edgeIncidence:Object.fromEntries([...new Set(edges.values())].sort((a,b)=>a-b).map(n=>[n,[...edges.values()].filter(v=>v===n).length])),
    exactDuplicateTriangles:triangles.length-faces.size,
    duplicateTriangleGroups:[...faces.values()].filter(n=>n>1).length,
    deduplicatedTopology:surfaceTopology(deduplicated)});
  g.dispose();deduplicated.dispose();
}
assert.equal(components.length,topology.connectedComponents);
assert.equal(components.reduce((n,c)=>n+c.triangles,0),count/3);
const files=['public/models/skin.glb','scripts/audit-male-skin-components.mjs',
  'scripts/lib/surface-containment.mjs','package-lock.json'].map(path=>({path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex')}));
const report={status:'MALE SKIN COMPONENT SCREEN; NO OUTER ENVELOPE APPROVED',
  sourceNode:node.getName(),vertices:array.count,triangles:count/3,wholeTopology:topology,
  componentCount:components.length,components,
  limitations:[
    'Exact-position connected components are not proof that the largest component is the external body boundary.',
    'Closed topology alone would not resolve nested skin shells, self-intersections or anatomical cavities.',
    'No male organ or nerve placement is approved by this component count; no runtime geometry is changed.',
  ],files};
fs.writeFileSync('docs/anatomy-alignment/male-skin-components.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({whole:topology,largest:components[0],remainder:components.slice(1).reduce((n,c)=>n+c.triangles,0)},null,2));
original.dispose();
