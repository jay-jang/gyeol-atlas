// Separate official source intersections from simplification and donor fitting.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {officialMeshes} from './lib/official-meshes.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';

const files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const read=file=>{const bytes=fs.readFileSync(file);files.set(file,sha(bytes));return bytes;},json=file=>JSON.parse(read(file));
const hips=json('docs/anatomy-alignment/hip-surface-fits.json'),membership=json('docs/anatomy-alignment/hra-bone-targets.json');
const reference=json('docs/anatomy-alignment/hra-brain-source.json'),atlas=json('public/models/female/atlas-female.json');
assert.equal(files.get('public/models/female/atlas-female.json'),membership.atlasSha256);
for(const f of json('data/catalog/female-atlas-source.json').files)assert.equal(sha(read(f.path)),f.sha256);
const ids=['left','right'].flatMap(side=>[...hips.fits.find(f=>f.side===side).targetIds,...membership.targets.find(t=>t.side===side&&t.bone==='Femur').members.map(m=>m.id)]);
assert.equal(ids.length,44);assert.equal(new Set(ids).size,44);
const parts=ids.map(id=>{const p=atlas.parts.find(p=>p.id===id);assert.ok(p);return p;});
const name=p=>`VH_F_${p.conceptId.replace(/^HRA:/,'')}`;
// Runtime-restored pubic/ischial parts come from v1.5; ilia and femora from v1.10.
const isOld=p=>/^HRA:(pubis|ischium)_/.test(p.conceptId);
assert.equal(parts.filter(isOld).length,8);
const sources=new Map();
for(const [file,selected] of [
  ['.cache/hip-registration/hra-united-female-v1.5.glb',parts.filter(isOld)],
  ['.cache/neural-bone/hra-united-female-v1.10.glb',parts.filter(p=>!isOld(p))],
]){
  const bytes=read(file),pin=hips.files.find(f=>f.path===file);assert.ok(pin);assert.equal(sha(bytes),pin.sha256);
  for(const [key,value] of officialMeshes(bytes,selected.map(name),reference.translationFromSkin))sources.set(key,{...value,file});
}
const chunks=atlas.chunks.map(c=>gunzipSync(read(`public/models/female/${path.basename(c.gzip)}`)));
const finish=g=>{g.computeBoundingBox();g.boundsTree=new MeshBVH(g);return g;};
const geometries=new Map(),sourceRecords=[];
for(const p of parts){
  const s=sources.get(name(p));assert.ok(s);const original=finish(s.geometry),bytes=chunks[p.chunk],packed=new BufferGeometry();
  packed.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>bytes.readFloatLE(p.positions+4*i)),3));
  packed.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>bytes.readUInt32LE(p.indices+4*i)),1));finish(packed);
  const bounds=[original.boundingBox.min.toArray(),original.boundingBox.max.toArray()];
  const boundsResidualMm=Math.max(...bounds.flatMap((row,i)=>row.map((v,j)=>Math.abs(v-p.bounds[i][j])*1000)));
  assert.ok(boundsResidualMm<.01,`${p.id} frame mismatch`);
  geometries.set(p.id,{original,packed});
  sourceRecords.push({id:p.id,name:p.name,conceptId:p.conceptId,sourceName:s.name,sourceFile:s.file,nodeIndex:s.nodeIndex,worldMatrix:s.worldMatrix,boundsResidualMm,sourceVertices:original.attributes.position.count,sourceTriangles:original.index.count/3,packedVertices:p.vertexCount,packedTriangles:p.indexCount/3});
}
const crossing=(a,b)=>a.boundingBox.intersectsBox(b.boundingBox)?meshCrossingWitness(a,b):null;
const pairs=[];
for(const side of ['left','right']){
  const pelvic=hips.fits.find(f=>f.side===side).targetIds,femoral=membership.targets.find(t=>t.side===side&&t.bone==='Femur').members.map(m=>m.id);
  for(const a of pelvic)for(const b of femoral){
    const first=geometries.get(a),second=geometries.get(b);
    const row={side,ids:[a,b],original:crossing(first.original,second.original),packed:crossing(first.packed,second.packed),
      originalPelvisPackedFemur:crossing(first.original,second.packed),packedPelvisOriginalFemur:crossing(first.packed,second.original)};
    pairs.push(row);if(row.original||row.packed)console.log(JSON.stringify(row));
  }
}
assert.equal(pairs.length,192);
for(const file of ['scripts/audit-hra-hip-crossings.mjs','scripts/lib/official-meshes.mjs','scripts/lib/triangle-witness.mjs','package-lock.json'])read(file);
const summary={parts:44,pairs:192,originalWitnessPairs:pairs.filter(p=>p.original).length,packedWitnessPairs:pairs.filter(p=>p.packed).length,newPackedWitnessPairs:pairs.filter(p=>!p.original&&p.packed).length};
const report={createdAt:new Date().toISOString(),status:'SOURCE/DELIVERY DIAGNOSTIC ONLY; no geometry changes',summary,translationFromSkin:reference.translationFromSkin,sourceRecords,pairs,
  limitations:['Same-side pelvic six-part versus femoral sixteen-part composites only; femoral hierarchy includes cartilage and attachment surfaces.',
    'Each positive result is the first segment/triangle interior witness with >1 micrometre plane straddling, not total crossing triangles or penetration depth.',
    'No witness does not prove disjoint solids; coplanar contacts, sub-tolerance intersections and containment are outside this predicate.',
    'Official geometry is in its original scene world frame plus the existing common skin translation, serialized to Float32 for comparison.',
    'No donor fitting, clinical anatomical assessment, muscle attachment or organ/nerve verification is performed here.'],files:[...files].map(([file,sha256])=>({file,sha256}))};
fs.mkdirSync('.cache/donor-bone-interpolating',{recursive:true});fs.writeFileSync('.cache/donor-bone-interpolating/hra-hip-crossings.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary));for(const {original,packed} of geometries.values()){original.dispose();packed.dispose();}
