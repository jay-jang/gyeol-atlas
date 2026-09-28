// Current female overview organ/bone surface diagnostic. This never writes
// runtime geometry and does not treat every normal tissue contact as an error.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';
import {applyFemaleCordRegistration} from '../src/female-cord-registration.ts';
import {applyFemaleSourceRestoration} from '../src/female-source-restoration.ts';
import {applyFemaleKneeSourceRestoration} from '../src/female-knee-source-restoration.ts';
import {resolveFemalePelvicGeometryPart} from '../src/female-pelvic-bindings.ts';
import {triangleCrossings} from './lib/triangle-crossings.mjs';

const output='.cache/female-organ-bone/relations.json';
fs.mkdirSync('.cache/female-organ-bone',{recursive:true});
const hashes=new Map();
const bytes=path=>{const value=fs.readFileSync(path);hashes.set(path,createHash('sha256').update(value).digest('hex'));return value;};
const read=path=>JSON.parse(bytes(path));
const source=read('data/catalog/female-atlas-source.json');
for(const entry of source.files)assert.equal(createHash('sha256').update(bytes(entry.path)).digest('hex'),entry.sha256,entry.path);
const atlas=read('public/models/female/atlas-female.json');
const catalogue=read('data/female-atlas-structures.json');
const byId=new Map(atlas.parts.map(part=>[part.id,part]));
assert.equal(byId.size,1220);
const catalogById=new Map(catalogue.map(part=>[part.id,part]));
assert.deepEqual([...catalogById.keys()].sort(),[...byId.keys()].sort());
const restoration=read('data/catalog/female-source-restoration.json');
const restoredBytes=gunzipSync(bytes(`public/${restoration.url}`));
assert.equal(restoredBytes.length,restoration.bytes);
const restored=restoredBytes.buffer.slice(restoredBytes.byteOffset,restoredBytes.byteOffset+restoredBytes.byteLength);
const knee=read('data/catalog/female-knee-source-restoration.json');
const kneeBytes=gunzipSync(bytes(`public/${knee.url}`));
assert.equal(kneeBytes.length,knee.bytes);
const restoredKnee=kneeBytes.buffer.slice(kneeBytes.byteOffset,kneeBytes.byteOffset+kneeBytes.byteLength);
const buffers=new Map();
function geometry(part){
  const sourcePart=resolveFemalePelvicGeometryPart(part,'female',byId);
  const chunk=atlas.chunks[sourcePart.chunk];
  if(!buffers.has(sourcePart.chunk)){
    const zipped=bytes(`public/models/female/${chunk.gzip.split('/').pop()}`);
    assert.equal(zipped.length,chunk.gzipBytes);
    const raw=gunzipSync(zipped);assert.equal(raw.length,chunk.bytes);
    buffers.set(sourcePart.chunk,raw);
  }
  const raw=buffers.get(sourcePart.chunk),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:sourcePart.vertexCount*3},(_,i)=>raw.readFloatLE(sourcePart.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:sourcePart.indexCount},(_,i)=>raw.readUInt32LE(sourcePart.indices+4*i)),1));
  applyFemaleSourceRestoration(g,'female',part.id,part.system,restored);
  applyFemaleKneeSourceRestoration(g,'female',part.id,part.system,restoredKnee);
  applyFemaleArmRegistration(g,'female',part.id,part.system);
  applyFemaleFootRegistration(g,'female',part.id,part.system);
  applyFemaleCordRegistration(g,'female',part.id,part.system);
  g.computeBoundingBox();g.boundsTree=new MeshBVH(g);
  return {id:part.id,name:part.name,system:part.system,sourceGeometryId:sourcePart.id,g};
}
const organs=atlas.parts.filter(part=>catalogById.get(part.id).layer==='organ').map(geometry);
const bones=atlas.parts.filter(part=>catalogById.get(part.id).layer==='bone').map(geometry);
assert.equal(organs.length,301);assert.equal(bones.length,321);
const report={status:'CURRENT FEMALE GEOMETRY DIAGNOSTIC; NO POSITION CORRECTION OR CLINICAL APPROVAL',
  createdAt:new Date().toISOString(),scope:{organSurfaces:organs.length,defaultOrganSurfaces:organs.filter(o=>o.system!=='pregnancy').length,boneLayerSurfaces:bones.length,evaluatedPairs:0,broadPhasePairs:0},
  limitations:[
    'The organ display layer includes multiple systems and anatomical surfaces, not 301 distinct complete organs.',
    'Eight pregnancy-reference surfaces are hidden by default; their pairs are reported separately.',
    'The bone display layer includes connective/cartilage surfaces and 180 male-derived borrowed bones, not 321 distinct female bones.',
    'Triangle surface crossing is not solid penetration depth, injury or an automatically invalid tissue contact.',
    'No triangle crossing does not prove correct organ position, full solid containment, vascular or neural continuity.',
    'The separate female CT and male/BP4 detail frames are excluded.',
  ],pairs:[],rows:[]};
for(const organ of organs){
  const row={id:organ.id,name:organ.name,system:organ.system,sourceGeometryId:organ.sourceGeometryId,
    defaultHidden:organ.system==='pregnancy',intersectingBoneIds:[]};
  for(const bone of bones){
    report.scope.evaluatedPairs++;
    if(!organ.g.boundingBox.intersectsBox(bone.g.boundingBox))continue;
    report.scope.broadPhasePairs++;
    if(!organ.g.boundsTree.intersectsGeometry(bone.g,new Matrix4()))continue;
    row.intersectingBoneIds.push(bone.id);
    report.pairs.push({organId:organ.id,organName:organ.name,organSystem:organ.system,defaultHidden:row.defaultHidden,
      boneId:bone.id,boneName:bone.name,boneSystem:bone.system,...triangleCrossings(organ.g,bone.g)});
  }
  report.rows.push(row);
  if(report.rows.length%25===0)console.log(JSON.stringify({processed:report.rows.length,intersectingPairs:report.pairs.length}));
}
assert.equal(report.scope.evaluatedPairs,301*321);
const active=report.pairs.filter(pair=>!pair.defaultHidden);
report.summary={allIntersectingPairs:report.pairs.length,defaultIntersectingPairs:active.length,
  defaultIntersectingOrganSurfaces:new Set(active.map(pair=>pair.organId)).size,
  defaultBorrowedBonePairs:active.filter(pair=>pair.boneSystem==='borrowed').length,
  defaultNativeBonePairs:active.filter(pair=>pair.boneSystem!=='borrowed').length,
  strictDefaultPairs:active.filter(pair=>pair.strictPlaneStraddlingPairs>0).length};
for(const path of ['scripts/audit-female-organ-bone-relations.mjs','scripts/lib/triangle-crossings.mjs',
  'src/female-arm-registration.ts','src/female-foot-registration.ts','src/female-cord-registration.ts',
  'src/female-source-restoration.ts','src/female-knee-source-restoration.ts','src/female-pelvic-bindings.ts',
  'data/catalog/female-arm-registration.json','data/catalog/female-foot-registration.json',
  'data/catalog/female-cord-registration.json','data/catalog/female-pelvic-bindings.json','package-lock.json'])bytes(path);
report.files=[...hashes].map(([path,sha256])=>({path,sha256}));
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));
for(const part of [...organs,...bones])part.g.dispose();
