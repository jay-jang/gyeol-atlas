// Resolve correspondence membership from the pinned official scene hierarchy.
// This creates a diagnostic manifest only, never application geometry.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute} from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {surfaceTopology} from './lib/surface-containment.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sourceFile='.cache/neural-bone/hra-united-female-v1.10.glb';
const pinned=read('docs/anatomy-alignment/hra-brain-source.json').files.find(f=>f.path===sourceFile);
assert.equal(hash(sourceFile),pinned.sha256);
const bytes=fs.readFileSync(sourceFile),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
const atlasFile='public/models/female/atlas-female.json',atlas=read(atlasFile);
for(const f of read('data/catalog/female-atlas-source.json').files)assert.equal(hash(f.path),f.sha256);
const buffers=atlas.chunks.map(c=>gunzipSync(fs.readFileSync(`public/models/female/${c.gzip.split('/').pop()}`)));
function geometry(p){
  const b=buffers[p.chunk],g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i)),1));return g;
}
const targets=[];
for(const side of ['left','right'])for(const bone of ['Femur','Patella','Tibia','Fibula']){
  const name=`VH_F_${bone.toLowerCase()}_${side==='left'?'L':'R'}`,roots=gltf.nodes.map((n,i)=>({n,i})).filter(({n})=>n.name===name);assert.equal(roots.length,1);
  const members=[],seen=new Set();
  function walk(index,parent){
    assert.ok(!seen.has(index),'Unexpected cycle/shared descendant');seen.add(index);
    const node=gltf.nodes[index];
    if(node.mesh!==undefined){
      assert.equal(gltf.meshes[node.mesh].primitives.length,1);
      const conceptId=`HRA:${node.name.replace(/^VH_F_/,'')}`,matches=atlas.parts.filter(p=>p.conceptId===conceptId);assert.equal(matches.length,1);
      const p=matches[0];members.push({id:p.id,name:p.name,system:p.system,conceptId,nodeIndex:index,parentIndex:parent,sourceName:node.name,sourceNodeType:node.extras?.node_type,representation:node.extras?.representation_of});
    }
    for(const c of node.children||[])walk(c,index);
  }
  walk(roots[0].i,null);
  assert.equal(members.length,bone==='Femur'?16:1);
  const geometries=members.map(m=>geometry(atlas.parts.find(p=>p.id===m.id))),merged=mergeGeometries(geometries),welded=mergeVertices(merged,1e-6);
  targets.push({side,bone,rootId:members[0].id,members,topology:{root:surfaceTopology(geometries[0]),combinedExact:surfaceTopology(merged),combinedWelded1Micrometre:surfaceTopology(welded)}});
  for(const g of [...geometries,merged,welded])g.dispose();
}
const report={status:'DIAGNOSTIC TARGET MEMBERSHIP; no runtime export',sourceFile,sourceSha256:pinned.sha256,atlasFile,atlasSha256:hash(atlasFile),targets,
  limitations:['Femur descendants include source-labelled cartilage and attachment surfaces; this is the source-defined composite envelope, not bone-only tissue.',
    'Joining members does not prove source anatomical validity or authorize muscle placement. Topology welding is diagnostic only and is not applied to fit coordinates.'],scriptSha256:hash('scripts/build-hra-bone-targets.mjs')};
fs.mkdirSync('.cache/joint-bone-visual',{recursive:true});fs.writeFileSync('.cache/joint-bone-visual/hra-bone-targets.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(targets.map(({side,bone,members,topology})=>({side,bone,members:members.length,topology})),null,2));
