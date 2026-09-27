// Diagnose intersections introduced by the independently prescribed frames.
// Positive evidence is a transverse segment/triangle interior witness;
// absence is not a proof of solid separation or anatomical correctness.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Matrix4} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
const root=process.argv[2];assert.ok(root,'Pass extracted Final STL directory');
const files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const read=file=>{const bytes=fs.readFileSync(file);files.set(file,sha(bytes));return bytes;};
const json=file=>JSON.parse(read(file));
const source=json('docs/anatomy-alignment/donor-source-comparison.json');
const candidate=json('docs/anatomy-alignment/bone-interpolating-candidate.json');
for(const f of candidate.files)assert.equal(sha(read(f.file)),f.sha256);
const finish=g=>{g.computeBoundingBox();g.boundsTree=new MeshBVH(g);return g;};
const bones=[];
for(const frame of candidate.frames)for(const name of frame.bones){
  const record=source.files.find(f=>f.kind==='bone'&&f.side===frame.side&&f.structure===name);assert.ok(record);
  const bytes=read(path.join(root,record.file));assert.equal(sha(bytes),record.sha256);
  const raw=new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  raw.scale(.001,.001,.001);raw.deleteAttribute('normal');const original=mergeVertices(raw,1e-8);raw.dispose();
  const placed=original.clone().applyMatrix4(new Matrix4().fromArray(frame.matrix));
  bones.push({id:`${frame.side}-${name}`,frame:`${frame.side}-${frame.group}`,original:finish(original),placed:finish(placed)});
}
assert.equal(bones.length,10);
const crossing=(a,b)=>a.boundingBox.intersectsBox(b.boundingBox)?meshCrossingWitness(a,b):null;
const pairs=[];
for(let a=0;a<bones.length;a++)for(let b=a+1;b<bones.length;b++){
  const first=bones[a],second=bones[b];
  const row={ids:[first.id,second.id],frames:[first.frame,second.frame],original:crossing(first.original,second.original),prescribed:crossing(first.placed,second.placed)};
  row.newWitness=!row.original&&Boolean(row.prescribed);pairs.push(row);
  if(row.original||row.prescribed)console.log(JSON.stringify(row));
}
assert.equal(pairs.length,45);
for(const file of ['scripts/audit-prescribed-bone-crossings.mjs','scripts/lib/triangle-witness.mjs','package-lock.json'])read(file);
const report={createdAt:new Date().toISOString(),status:'DIAGNOSTIC ONLY; no public geometry change',
  method:'All 45 unordered pairs of ten original source bones, before versus their own prescribed similarity frames. Segment and triangle interiors with >1 micrometre supporting-plane straddle; first witness only.',
  summary:{bones:10,pairs:45,originalWitnessPairs:pairs.filter(p=>p.original).length,prescribedWitnessPairs:pairs.filter(p=>p.prescribed).length,newWitnessPairs:pairs.filter(p=>p.newWitness).length},pairs,
  limitations:['A missing transverse witness does not exclude coplanar contact, sub-tolerance crossing or full solid containment.',
    'The supporting-plane straddle extent is NOT a penetration depth or distance between whole tissues.',
    'Source/placed meshes use Float32 coordinates; witnesses describe these meshes, not an exact continuous or clinical anatomy.',
    'These are prescribed donor bone frames, not deployed HRA bones. No muscle surface, nerve or attachment is examined here.'],
  files:[...files].map(([file,sha256])=>({file,sha256}))};
fs.mkdirSync('.cache/donor-bone-interpolating',{recursive:true});
fs.writeFileSync('.cache/donor-bone-interpolating/prescribed-crossings.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));bones.forEach(b=>{b.original.dispose();b.placed.dispose();});
