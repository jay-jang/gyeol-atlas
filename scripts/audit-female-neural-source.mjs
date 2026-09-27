// Factor source geometry versus delivery simplification without fitting anatomy.
// Borrowed bones keep their actual current runtime geometry in both comparisons.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {officialMeshes} from './lib/official-meshes.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
import {applyFemaleSourceRestoration} from '../src/female-source-restoration.ts';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';
import {resolveFemaleBrainGeometryPart} from '../src/female-brain-bindings.ts';

const files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const read=file=>{const b=fs.readFileSync(file);files.set(file,sha(b));return b;},json=file=>JSON.parse(read(file));
const atlas=json('public/models/female/atlas-female.json'),catalog=json('data/female-atlas-structures.json');
const partsById=new Map(atlas.parts.map(p=>[p.id,p]));
const reference=json('docs/anatomy-alignment/hra-brain-source.json'),hips=json('docs/anatomy-alignment/hip-surface-fits.json');
for(const f of json('data/catalog/female-atlas-source.json').files)assert.equal(sha(read(f.path)),f.sha256);
const selected=new Map(catalog.filter(p=>['nerve','bone'].includes(p.layer)).map(p=>[p.id,p]));
const parts=atlas.parts.filter(p=>selected.has(p.id));assert.equal(parts.length,683);
const native=parts.filter(p=>p.id.startsWith('HRAF')),sources=new Map();let spinalHierarchy;
for(const [file,pin] of [
  ['.cache/neural-bone/hra-united-female-v1.10.glb',reference.files.find(f=>f.path==='.cache/neural-bone/hra-united-female-v1.10.glb').sha256],
  ['.cache/hip-registration/hra-united-female-v1.5.glb',hips.files.find(f=>f.path==='.cache/hip-registration/hra-united-female-v1.5.glb').sha256],
]){
  const bytes=read(file);assert.equal(sha(bytes),pin);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),names=new Map();
  if(file.includes('v1.10')){
    const rootIndex=gltf.nodes.findIndex(n=>n.name==='VH_F_spinal_cord');assert.ok(rootIndex>=0);
    const descendants=[];
    function descend(index,parentIndex){
      const n=gltf.nodes[index];
      if(n.mesh!==undefined){
        const conceptId=`HRA:${n.name.replace(/^VH_F_/,'')}`,matches=parts.filter(p=>p.conceptId===conceptId);assert.equal(matches.length,1);
        descendants.push({id:matches[0].id,conceptId,sourceName:n.name,nodeIndex:index,parentIndex,representation:n.extras?.representation_of??null});
      }
      for(const child of n.children||[])descend(child,index);
    }
    descend(rootIndex,null);assert.equal(descendants.length,29);
    assert.deepEqual(descendants.map(p=>p.id),atlas.concepts.find(c=>c.id==='HRA:spinal_cord').elements);
    spinalHierarchy={sourceFile:file,rootIndex,rootName:gltf.nodes[rootIndex].name,rootHasMesh:gltf.nodes[rootIndex].mesh!==undefined,descendants};
  }
  for(const node of gltf.nodes){
    if(node.mesh===undefined)continue;
    const concept=`HRA:${node.name.replace(/^(VH_F|VH|Allen|Yao)(_|$)/,'')||'body'}`;
    assert.ok(!names.has(concept),`Duplicate concept ${concept}`);names.set(concept,node.name);
  }
  const wanted=native.filter(p=>!sources.has(p.id)&&names.has(p.conceptId));
  const meshes=officialMeshes(bytes,wanted.map(p=>names.get(p.conceptId)),reference.translationFromSkin);
  for(const p of wanted)sources.set(p.id,{...meshes.get(names.get(p.conceptId)),file});
}
assert.equal(sources.size,native.length);assert.equal(native.length,503);
const chunks=atlas.chunks.map(c=>gunzipSync(read(`public/models/female/${c.gzip.split('/').pop()}`)));
const restoration=json('data/catalog/female-source-restoration.json'),zip=read(`public/${restoration.url}`);
assert.equal(sha(zip),restoration.sha256);const restored=gunzipSync(zip);
const restorationBuffer=restored.buffer.slice(restored.byteOffset,restored.byteOffset+restored.byteLength);
const finish=g=>{g.computeBoundingBox();g.boundsTree=new MeshBVH(g);return g;};
const records=[],geometry=new Map();
for(const p of parts){
  const q=resolveFemaleBrainGeometryPart(p,'female',partsById);
  const b=chunks[q.chunk],runtime=new BufferGeometry();
  runtime.setAttribute('position',new BufferAttribute(Float32Array.from({length:q.vertexCount*3},(_,i)=>b.readFloatLE(q.positions+4*i)),3));
  runtime.setIndex(new BufferAttribute(Uint32Array.from({length:q.indexCount},(_,i)=>b.readUInt32LE(q.indices+4*i)),1));
  applyFemaleSourceRestoration(runtime,'female',p.id,p.system,restorationBuffer);
  applyFemaleArmRegistration(runtime,'female',p.id,p.system);applyFemaleFootRegistration(runtime,'female',p.id,p.system);
  finish(runtime);
  const s=sources.get(q.id),source=s?finish(s.geometry):runtime;
  let boundsResidualMm=null;
  if(s){
    boundsResidualMm=Math.max(...[source.boundingBox.min.toArray(),source.boundingBox.max.toArray()].flatMap((r,i)=>r.map((v,j)=>Math.abs(v-q.bounds[i][j])*1000)));
    assert.ok(boundsResidualMm<.01,`${p.id} original frame mismatch`);
  }else assert.equal(p.system,'borrowed',`Unexpected non-HRA source: ${p.id}`);
  geometry.set(p.id,{source,runtime});
  records.push({id:p.id,name:p.name,conceptId:p.conceptId,layer:selected.get(p.id).layer,system:p.system,
    sourceGeometryId:q.id,sourceGeometryConceptId:q.conceptId,
    sourceFile:s?.file??null,sourceName:s?.name??null,nodeIndex:s?.nodeIndex??null,worldMatrix:s?.worldMatrix??null,boundsResidualMm,
    comparison:s?'bound official source geometry versus runtime':'borrowed bone unchanged at runtime position',
    sourcePositionSha256:sha(Buffer.from(source.attributes.position.array.buffer,source.attributes.position.array.byteOffset,source.attributes.position.array.byteLength)),
    runtimePositionSha256:sha(Buffer.from(runtime.attributes.position.array.buffer,runtime.attributes.position.array.byteOffset,runtime.attributes.position.array.byteLength)),
    sourceVertices:source.attributes.position.count,runtimeVertices:runtime.attributes.position.count,
    sourceTriangles:source.index.count/3,runtimeTriangles:runtime.index.count/3});
}
const crossing=(a,b)=>a.boundingBox.intersectsBox(b.boundingBox)?meshCrossingWitness(a,b):null;
const neural=records.filter(p=>p.layer==='nerve'),bones=records.filter(p=>p.layer==='bone');
assert.equal(neural.length,362);assert.equal(bones.length,321);
assert.ok(neural.every(p=>p.sourceFile),'Every neural comparison must have its native original');
const modes=['source','runtime','sourceNeuralRuntimeBone','runtimeNeuralSourceBone'],pairs=[];
let evaluatedPairs=0;
for(const n of neural){
  for(const b of bones){
    evaluatedPairs++;const a=geometry.get(n.id),c=geometry.get(b.id);
    const row={neuralId:n.id,neuralName:n.name,neuralSystem:n.system,boneId:b.id,boneName:b.name,boneSystem:b.system,
      source:crossing(a.source,c.source),runtime:crossing(a.runtime,c.runtime),
      sourceNeuralRuntimeBone:crossing(a.source,c.runtime),runtimeNeuralSourceBone:crossing(a.runtime,c.source)};
    if(modes.some(mode=>row[mode]))pairs.push(row);
  }
  if(neural.indexOf(n)%50===49)console.log(JSON.stringify({processed:neural.indexOf(n)+1,evaluatedPairs,witnessPairs:pairs.length}));
}
assert.equal(evaluatedPairs,116202);
const summarize=rows=>({witnessPairs:Object.fromEntries(modes.map(mode=>[mode,rows.filter(p=>p[mode]).length])),
  newlyPresentInRuntime:rows.filter(p=>!p.source&&p.runtime).map(p=>[p.neuralId,p.boneId]),
  absentInRuntime:rows.filter(p=>p.source&&!p.runtime).map(p=>[p.neuralId,p.boneId])});
const summary={neuralMeshes:neural.length,boneMeshes:bones.length,evaluatedPairs,all:summarize(pairs),
  nativeBone:summarize(pairs.filter(p=>sources.has(p.boneId))),borrowedBone:summarize(pairs.filter(p=>!sources.has(p.boneId)))};
for(const file of ['scripts/audit-female-neural-source.mjs','scripts/lib/official-meshes.mjs','scripts/lib/triangle-witness.mjs',
  'src/female-source-restoration.ts','src/female-arm-registration.ts','src/female-foot-registration.ts',
  'src/female-brain-bindings.ts','data/catalog/female-brain-bindings.json',
  'data/catalog/female-arm-registration.json','data/catalog/female-foot-registration.json','package-lock.json'])read(file);
const report={createdAt:new Date().toISOString(),status:'SOURCE/RUNTIME DIAGNOSTIC ONLY; no anatomy changes',summary,translationFromSkin:reference.translationFromSkin,spinalHierarchy,records,pairs,
  limitations:['Only female overview neural-layer versus bone-layer relationships; other tissues, male, CT and independent details are excluded.',
    'Source mode uses official HRA surfaces for native structures and unchanged current borrowed bones, NOT an entirely native female skeleton.',
    'Official source hierarchy transforms and the existing common skin translation are applied, then coordinates are stored as Float32.',
    'Runtime includes ilium restoration, static arm/foot registrations and Allen brain binding. Both source/runtime variants use the same bound sourceGeometryId for each canonical ID; this is not a comparison with pre-correction source-side labels.',
    'A positive result is the first interior segment/triangle crossing with plane straddling >1 micrometre, not total triangle hits or penetration depth.',
    'No witness cannot prove solid separation or valid foramina/nerve courses. Neural-layer meshes include cavities and supporting tissues.',
    'Missing runtime witnesses may reflect approximation rather than correction; this diagnostic does not certify either source or runtime anatomy.'],
  files:[...files].map(([file,sha256])=>({file,sha256}))};
fs.mkdirSync('.cache/neural-source',{recursive:true});fs.writeFileSync('.cache/neural-source/female.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
for(const {source,runtime} of geometry.values()){runtime.dispose();if(source!==runtime)source.dispose();}
