// Current overview neural-layer vs bone-layer surface relationships, both sexes.
// This diagnoses geometry, not clinical nerve course or valid attachments.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {NodeIO} from '@gltf-transform/core';
import {KHRDracoMeshCompression} from '@gltf-transform/extensions';
import draco from 'draco3dgltf';
import {BufferGeometry,BufferAttribute,Matrix4} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';
import {triangleCrossings} from './lib/triangle-crossings.mjs';
const out='.cache/neural-bone';fs.mkdirSync(out,{recursive:true});
const hashes=new Map();
const bytes=path=>{const b=fs.readFileSync(path);hashes.set(path,createHash('sha256').update(b).digest('hex'));return b;};
const read=path=>JSON.parse(bytes(path));
function mesh(positions,indices){
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));
  if(indices)g.setIndex(new BufferAttribute(new Uint32Array(indices),1));return g;
}
function finish(g){g.computeBoundingBox();g.boundsTree=new MeshBVH(g);return g;}
function female(){
  const source=read('data/catalog/female-atlas-source.json');
  for(const f of source.files)assert.equal(createHash('sha256').update(bytes(f.path)).digest('hex'),f.sha256,f.path);
  const atlas=read('public/models/female/atlas-female.json'),catalog=read('data/female-atlas-structures.json'),buffer=new Map();
  const selected=new Map(catalog.filter(p=>['bone','nerve'].includes(p.layer)).map(p=>[p.id,p]));
  return atlas.parts.filter(p=>selected.has(p.id)).map(p=>{
    if(!buffer.has(p.chunk)){
      const c=atlas.chunks[p.chunk],zip=bytes(`public/models/female/${c.gzip.split('/').pop()}`);
      assert.equal(zip.length,c.gzipBytes);const b=gunzipSync(zip);assert.equal(b.length,c.bytes);buffer.set(p.chunk,b);
    }
    const b=buffer.get(p.chunk),g=mesh(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),
      Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i)));
    applyFemaleArmRegistration(g,'female',p.id,p.system);applyFemaleFootRegistration(g,'female',p.id,p.system);
    return {id:p.id,name:p.name,layer:selected.get(p.id).layer,sourceSystem:p.system,g:finish(g)};
  });
}
const io=new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({'draco3d.decoder':await draco.createDecoderModule()});
async function male(){
  const base=read('scripts/model-inputs.json').assets,full=read('data/full-system-structures.json'),registration=read('data/catalog/male-registration.json'),parts=[];
  for(const [path,catalog,registered] of [['public/models/bone.glb',base.filter(p=>p.layer==='bone'),false],['public/models/nerve-full.glb',full.filter(p=>p.layer==='nerve'),true]]){
    const doc=await io.readBinary(bytes(path)),entries=new Map(catalog.map(p=>[p.node||p.id,p]));
    for(const node of doc.getRoot().listNodes()){
      if(!node.getMesh())continue;const p=entries.get(node.getName());if(!p)continue;
      const primitives=node.getMesh().listPrimitives();assert.equal(primitives.length,1,`${node.getName()} must not silently merge/omit primitives`);
      const primitive=primitives[0],g=mesh(primitive.getAttribute('POSITION').getArray(),primitive.getIndices()?.getArray());
      g.applyMatrix4(new Matrix4().fromArray(node.getWorldMatrix()));
      if(registered){g.scale(registration.scale,registration.scale,registration.scale);g.translate(...registration.translation);}
      parts.push({id:p.id,name:p.name,layer:p.layer,sourceSystem:registered?'registered-Z-Anatomy-neural-layer':'BodyParts3D-bone-layer',g:finish(g)});
    }
    assert.equal(parts.filter(p=>p.layer===catalog[0].layer).length,catalog.length,path);
  }return parts;
}
const brainIds=new Set(read('data/female-organ-groups.json').find(g=>g.id==='brain').ids);
const report={status:'CURRENT GEOMETRY AUDIT; no coordinate changes or clinical approval',createdAt:new Date().toISOString(),
  limitations:[
    'Layer names are display classifications: female neural layer includes eye structures and brain cavities/supporting tissues, not only neurons or nerves.',
    'Bone-layer parts include cartilage/connective meshes, not necessarily individual bones.',
    'Triangle crossing does not measure solid penetration volume/depth or diagnose nerve injury.',
    'Pairs rejected by disjoint AABBs cannot intersect, but no surface crossing does not exclude complete solid containment.',
    'The audit does not validate all nerve continuity, foramina routes, vessel relationships or microscopic coverage.',
    'Independent male BP4 and female CT detail sources are not merged into overview coordinates or this audit.',
  ],bodies:[]};
for(const sex of ['female','male']){
  const parts=sex==='female'?female():await male(),neural=parts.filter(p=>p.layer==='nerve'),bones=parts.filter(p=>p.layer==='bone');
  assert.equal(neural.length,sex==='female'?362:525);assert.equal(bones.length,sex==='female'?321:278);
  assert.equal(new Set(parts.map(p=>p.id)).size,parts.length);
  const body={sex,neuralMeshes:neural.length,boneMeshes:bones.length,evaluatedPairs:0,broadPhasePairs:0,pairs:[],rows:[]};
  for(const n of neural){
    const row={id:n.id,name:n.name,sourceSystem:n.sourceSystem,inFemaleBrain:sex==='female'&&brainIds.has(n.id),intersectingBoneIds:[]};
    for(const b of bones){
      body.evaluatedPairs++;if(!n.g.boundingBox.intersectsBox(b.g.boundingBox))continue;body.broadPhasePairs++;
      if(!n.g.boundsTree.intersectsGeometry(b.g,new Matrix4()))continue;
      row.intersectingBoneIds.push(b.id);body.pairs.push({neuralId:n.id,neuralName:n.name,sourceSystem:n.sourceSystem,boneId:b.id,boneName:b.name,boneSourceSystem:b.sourceSystem,...triangleCrossings(n.g,b.g)});
    }
    body.rows.push(row);
    if(body.rows.length%50===0)console.log(JSON.stringify({sex,processed:body.rows.length,intersectingPairs:body.pairs.length}));
  }
  assert.equal(body.evaluatedPairs,neural.length*bones.length);
  body.summary={intersectingNeuralMeshes:body.rows.filter(r=>r.intersectingBoneIds.length).length,intersectingPairs:body.pairs.length,
    strictPlaneStraddlingMeshPairs:body.pairs.filter(p=>p.strictPlaneStraddlingPairs>0).length,
    femaleBrainIntersectingMeshes:sex==='female'?body.rows.filter(r=>r.inFemaleBrain&&r.intersectingBoneIds.length).length:null};
  console.log(JSON.stringify({sex,...body.summary}));report.bodies.push(body);parts.forEach(p=>p.g.dispose());
}
for(const p of ['scripts/audit-neural-bone-relations.mjs','scripts/lib/triangle-crossings.mjs','src/female-arm-registration.ts','src/female-foot-registration.ts',
  'data/catalog/female-arm-registration.json','data/catalog/female-foot-registration.json','package-lock.json'])bytes(p);
report.files=[...hashes].map(([path,sha256])=>({path,sha256}));
fs.writeFileSync(`${out}/relations.json`,JSON.stringify(report,null,2)+'\n');
