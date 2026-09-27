// Current-runtime decoder for this new offline pose experiment. Historical
// experiments retain their own frozen loaders and source frames.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeVertices,mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {applyFemaleArmRegistration} from '../../src/female-arm-registration.ts';
import {applyFemaleFootRegistration} from '../../src/female-foot-registration.ts';
import {applyFemaleSourceRestoration} from '../../src/female-source-restoration.ts';
import {applyFemaleKneeSourceRestoration} from '../../src/female-knee-source-restoration.ts';
import {resolveFemaleBrainGeometryPart} from '../../src/female-brain-bindings.ts';
export function lowerBodyPoseContext(finalRoot){
  const files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
  const read=p=>{const b=fs.readFileSync(p);files.set(p,sha(b));return b;},json=p=>JSON.parse(read(p));
  const source=json('docs/anatomy-alignment/donor-source-comparison.json'),prior=json('docs/anatomy-alignment/lower-body-bone-flow.json');
  const atlas=json('public/models/female/atlas-female.json'),catalog=new Map(json('data/female-atlas-structures.json').map(p=>[p.id,p]));
  const packing=json('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative,zip=read('.cache/donor-fidelity/source-full.bin.gz');assert.equal(sha(zip),packing.sha256);const raw=gunzipSync(zip);
  const chunks=atlas.chunks.map(c=>gunzipSync(read(`public/models/female/${path.basename(c.gzip)}`))),byId=new Map(atlas.parts.map(p=>[p.id,p]));
  const patches=['female-source-restoration','female-knee-source-restoration'].map(name=>{const s=json(`data/catalog/${name}.json`),b=read(`public/${s.url}`);assert.equal(sha(b),s.sha256);const data=gunzipSync(b);return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);});
  const finish=g=>{g.computeBoundingBox();g.boundsTree=new MeshBVH(g,{indirect:true});return g;};
  function decoded(b,p){const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),3));g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i)),1));return g;}
  const runtime=atlas.parts.map(p=>{
    const q=resolveFemaleBrainGeometryPart(p,'female',byId),g=decoded(chunks[q.chunk],q);
    applyFemaleSourceRestoration(g,'female',p.id,p.system,patches[0]);applyFemaleKneeSourceRestoration(g,'female',p.id,p.system,patches[1]);
    applyFemaleArmRegistration(g,'female',p.id,p.system);applyFemaleFootRegistration(g,'female',p.id,p.system);g.deleteAttribute('normal');
    return {id:p.id,name:p.name,layer:catalog.get(p.id).layer,g:finish(g)};
  });assert.equal(runtime.length,1220);
  const runtimeMap=new Map(runtime.map(p=>[p.id,p])),initialMatrices=new Map(prior.sides.map(s=>[s.side,new Matrix4().fromArray(s.initialMatrix)]));
  const muscles=source.muscles.map(m=>{const side=m.fitGroup.split('-')[0],record=packing.parts.find(p=>p.id===m.id),g=finish(decoded(raw,record));return {...m,side,record,raw:g,initial:finish(g.clone().applyMatrix4(initialMatrices.get(side)))};});assert.equal(muscles.length,76);
  const loader=new STLLoader(),bones=[];
  for(const side of ['left','right'])for(const name of ['Pelvis','Femur','Patella','Tibia','Fibula']){
    const file=source.files.find(f=>f.side===side&&f.kind==='bone'&&f.structure===name);assert.ok(file);const bytes=read(path.join(finalRoot,file.file));assert.equal(sha(bytes),file.sha256);
    const parsed=loader.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));parsed.scale(.001,.001,.001);parsed.deleteAttribute('normal');const g=finish(mergeVertices(parsed,1e-9));parsed.dispose();
    const targetIds=prior.sides.find(s=>s.side===side).bones.find(b=>b.name===name).targetIds;
    bones.push({side,name,targetIds,raw:g,initial:finish(g.clone().applyMatrix4(initialMatrices.get(side))),target:finish(mergeGeometries(targetIds.map(id=>runtimeMap.get(id).g)))});
  }
  for(const file of ['scripts/lib/lower-body-pose-context.mjs','src/female-arm-registration.ts','src/female-foot-registration.ts','src/female-source-restoration.ts','src/female-knee-source-restoration.ts','src/female-brain-bindings.ts','data/catalog/female-arm-registration.json','data/catalog/female-foot-registration.json','data/catalog/female-brain-bindings.json','package-lock.json'])read(file);
  return {source,prior,atlas,packing,runtime,runtimeMap,initialMatrices,muscles,bones,finish,files,read,sha};
}
