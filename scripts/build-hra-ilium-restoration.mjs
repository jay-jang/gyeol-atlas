// Restore a single original surface, with no fitting/simplification. Candidate
// output only by default; --export writes the verified source-fidelity asset.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {officialMeshes} from './lib/official-meshes.mjs';
import {surfaceProbe} from './lib/surface-containment.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';
const args=process.argv.slice(2);assert.ok(args.every(a=>a==='--export'));
const files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const read=file=>{const b=fs.readFileSync(file);files.set(file,sha(b));return b;},json=file=>JSON.parse(read(file));
const atlas=json('public/models/female/atlas-female.json'),reference=json('docs/anatomy-alignment/hra-brain-source.json');
for(const f of json('data/catalog/female-atlas-source.json').files)assert.equal(sha(read(f.path)),f.sha256);
const sourceFile='.cache/neural-bone/hra-united-female-v1.10.glb',source=read(sourceFile);
assert.equal(sha(source),reference.files.find(f=>f.path===sourceFile).sha256);
const id='HRAF0827',part=atlas.parts.find(p=>p.id===id);assert.equal(part.conceptId,'HRA:ilium_compact_bone_R');
const original=officialMeshes(source,['VH_F_ilium_compact_bone_R'],reference.translationFromSkin).get('VH_F_ilium_compact_bone_R');
const g=original.geometry;assert.ok(g.attributes.normal);
const chunks=atlas.chunks.map(c=>gunzipSync(read(`public/models/female/${c.gzip.split('/').pop()}`)));
function packed(p){
  const b=chunks[p.chunk],geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),3));
  geometry.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i)),1));return geometry;
}
const skin=packed(atlas.parts.find(p=>p.id==='HRAF0003')),probe=surfaceProbe(skin);
const originalPosition=g.attributes.position,old=packed(part),skinCounts=geometry=>{
  const counts={inside:0,outside:0,'surface-band':0,ambiguous:0};
  const point=new Vector3();
  for(let i=0;i<geometry.attributes.position.count;i++)counts[probe.classify(point.fromBufferAttribute(geometry.attributes.position,i)).kind]++;
  return counts;
};
const skinBefore=skinCounts(old),skinAfter=skinCounts(g);
assert.equal(skinAfter.outside,0);assert.equal(skinAfter.ambiguous,0);
const finish=geometry=>{geometry.computeBoundingBox();geometry.boundsTree=new MeshBVH(geometry);return geometry;};
// Clone before BVH construction so the serialized original index order stays intact.
const before=finish(old.clone()),after=finish(g.clone()),relations=[];
for(const p of atlas.parts){
  if(p.id===id)continue;
  const other=packed(p);
  applyFemaleArmRegistration(other,'female',p.id,p.system);
  applyFemaleFootRegistration(other,'female',p.id,p.system);
  other.computeBoundingBox();
  if(!before.boundingBox.intersectsBox(other.boundingBox)&&!after.boundingBox.intersectsBox(other.boundingBox)){other.dispose();continue;}
  finish(other);
  const a=before.boundingBox.intersectsBox(other.boundingBox)?meshCrossingWitness(before,other):null;
  const b=after.boundingBox.intersectsBox(other.boundingBox)?meshCrossingWitness(after,other):null;
  if(a||b)relations.push({id:p.id,name:p.name,system:p.system,before:a,after:b});other.dispose();
}
const fixed=relations.find(r=>r.id==='HRAF0911');assert.ok(fixed?.before&&!fixed.after,'Known simplification-induced femur crossing must disappear');
const positions=Float32Array.from(originalPosition.array),normals=Float32Array.from(g.attributes.normal.array),indices=Uint32Array.from(g.index.array);
const binary=Buffer.concat([Buffer.from(positions.buffer),Buffer.from(normals.buffer),Buffer.from(indices.buffer)]),compressed=gzipSync(binary,{level:9});
const record={id,system:part.system,sourceName:original.name,sourceNodeIndex:original.nodeIndex,originalVertexCount:part.vertexCount,originalIndexCount:part.indexCount,
  vertexCount:positions.length/3,indexCount:indices.length,positions:0,normals:positions.byteLength,indices:positions.byteLength+normals.byteLength};
g.computeBoundingBox();
const manifest={version:'hra-right-ilium-source-1',sourceFile,sourceSha256:sha(source),translationFromSkin:reference.translationFromSkin,
  baselineAtlasSha256:files.get('public/models/female/atlas-female.json'),url:'models/female-source-restoration/right-ilium.bin.gz',bytes:binary.length,gzipBytes:compressed.length,sha256:sha(compressed),records:[record]};
for(const file of ['scripts/build-hra-ilium-restoration.mjs','scripts/lib/official-meshes.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-witness.mjs',
  'src/female-arm-registration.ts','src/female-foot-registration.ts','data/catalog/female-arm-registration.json','data/catalog/female-foot-registration.json','package-lock.json'])read(file);
const report={createdAt:new Date().toISOString(),status:'SOURCE FIDELITY RESTORATION CANDIDATE; runtime/visual verification still required',manifest,
  skinBefore,skinAfter,relations,summary:{examinedOtherParts:atlas.parts.length-1,beforeCrossingPairs:relations.filter(r=>r.before).length,afterCrossingPairs:relations.filter(r=>r.after).length,newCrossingPairs:relations.filter(r=>!r.before&&r.after).length,resolvedCrossingPairs:relations.filter(r=>r.before&&!r.after).length},
  limitations:['This restores official geometry, not a fitted anatomy correction. All other meshes stay in their existing runtime positions for this diagnostic.',
    'All 1219 other parts are considered, including normally hidden pregnancy/duplicate muscles, with existing static arm/toe runtime corrections applied.',
    'First transverse witness only per pair, not penetration depth or full containment. Original source intersections may remain.',
    'Positions and triangle index order match the original GLB under its world transform and existing common skin shift; normals use the world normal matrix and normalization.'],files:[...files].map(([file,sha256])=>({file,sha256}))};
fs.mkdirSync('.cache/hra-ilium-restoration',{recursive:true});
fs.writeFileSync('.cache/hra-ilium-restoration/right-ilium.bin.gz',compressed);fs.writeFileSync('.cache/hra-ilium-restoration/report.json',JSON.stringify(report,null,2)+'\n');
if(args.includes('--export')){
  assert.equal(report.summary.newCrossingPairs,0,'Do not export an unreviewed new crossing');
  fs.mkdirSync('public/models/female-source-restoration',{recursive:true});
  fs.writeFileSync('public/models/female-source-restoration/right-ilium.bin.gz',compressed);
  fs.writeFileSync('data/catalog/female-source-restoration.json',JSON.stringify(manifest,null,2)+'\n');
}
console.log(JSON.stringify({summary:report.summary,skinBefore,skinAfter,manifest,newPairs:relations.filter(r=>!r.before&&r.after).map(r=>({id:r.id,name:r.name}))},null,2));
probe.dispose();skin.dispose();g.dispose();old.dispose();before.dispose();after.dispose();
