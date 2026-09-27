// Offline check of the grid-shift candidate against all other displayed HRA parts.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';
import {applyFemaleCordRegistration} from '../src/female-cord-registration.ts';
import {resolveFemaleBrainGeometryPart} from '../src/female-brain-bindings.ts';
import {applyFemaleSourceRestoration} from '../src/female-source-restoration.ts';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';

const hashes=new Map(),hash=b=>createHash('sha256').update(b).digest('hex');
const read=file=>{const b=fs.readFileSync(file);hashes.set(file,hash(b));return b;};
const json=file=>JSON.parse(read(file));
const source=json('data/catalog/female-atlas-source.json');
for(const file of source.files)assert.equal(hash(read(file.path)),file.sha256,file.path);
const atlas=json('public/models/female/atlas-female.json'),catalog=json('data/female-atlas-structures.json');
const restoration=json('data/catalog/female-source-restoration.json');
const restored=gunzipSync(read(`public/${restoration.url}`)),restoredBuffer=restored.buffer.slice(restored.byteOffset,restored.byteOffset+restored.byteLength);
const candidateReport=json('docs/anatomy-alignment/cord-section-grid-shift.json');
const candidate=JSON.parse(gunzipSync(read(candidateReport.geometryFile)));
assert.equal(hashes.get(candidateReport.geometryFile),candidateReport.files.find(f=>f.file===candidateReport.geometryFile).sha256);
const originalReport=json('docs/anatomy-alignment/neural-component-source.json');
const original=JSON.parse(gunzipSync(read(originalReport.geometryFile)));
const runtime=new Map(original.filter(p=>p.kind==='cord').map(p=>[p.id,p.runtime]));
const proposed=new Map(candidate.filter(p=>p.kind==='cord').map(p=>[p.id,p.runtime]));
const moved=new Set(candidateReport.changed.filter(r=>r.mode==='runtime'&&r.moved).map(r=>r.id));
assert.equal(moved.size,15);
const catalogById=new Map(catalog.map(p=>[p.id,p]));
const partById=new Map(atlas.parts.map(p=>[p.id,p]));
const buffers=new Map();
function raw(part){
  const q=resolveFemaleBrainGeometryPart(part,'female',partById);
  if(!buffers.has(q.chunk)){
    const chunk=atlas.chunks[q.chunk],zip=read(`public/models/female/${chunk.gzip.split('/').pop()}`);
    assert.equal(zip.length,chunk.gzipBytes);const bytes=gunzipSync(zip);assert.equal(bytes.length,chunk.bytes);buffers.set(q.chunk,bytes);
  }
  const data=buffers.get(q.chunk);
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(Float32Array.from({length:q.vertexCount*3},(_,i)=>data.readFloatLE(q.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:q.indexCount},(_,i)=>data.readUInt32LE(q.indices+4*i)),1));
  applyFemaleSourceRestoration(g,'female',part.id,part.system,restoredBuffer);
  applyFemaleArmRegistration(g,'female',part.id,part.system);applyFemaleFootRegistration(g,'female',part.id,part.system);
  g.computeBoundingBox();return g;
}
function fromStored(data){
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(Float32Array.from(data.positions),3));g.setIndex(data.indices);g.computeBoundingBox();return g;
}
function bvh(g){if(!g.boundsTree)g.boundsTree=new MeshBVH(g);return g;}
const cord=[];
for(const id of moved){
  const actual=raw(partById.get(id)),known=runtime.get(id),newData=proposed.get(id);
  assert.deepEqual([...actual.attributes.position.array],known.positions,`${id} current runtime source mismatch`);
  assert.deepEqual([...actual.index.array],known.indices,`${id} current runtime indices mismatch`);
  const displayed=actual.clone();assert.equal(applyFemaleCordRegistration(displayed,'female',id,'nervous'),true);
  assert.deepEqual([...displayed.attributes.position.array],newData.positions,`${id} displayed candidate mismatch`);
  displayed.dispose();
  cord.push({id,original:actual,candidate:fromStored(newData)});
}
const all=[];
for(const part of atlas.parts){
  if(runtime.has(part.id))continue;
  const g=raw(part),label=catalogById.get(part.id);assert.ok(label);
  all.push({id:part.id,layer:label.layer,name:part.name,g});
}
assert.equal(cord.length,15);assert.equal(all.length,1191);
const rows=[];let potential=0;
for(const c of cord){
  for(const p of all){
    const oldBox=c.original.boundingBox.intersectsBox(p.g.boundingBox),newBox=c.candidate.boundingBox.intersectsBox(p.g.boundingBox);
    if(!oldBox&&!newBox)continue;potential++;
    if(oldBox)bvh(c.original);if(newBox)bvh(c.candidate);bvh(p.g);
    const before=oldBox?meshCrossingWitness(c.original,p.g):null,after=newBox?meshCrossingWitness(c.candidate,p.g):null;
    if(before||after)rows.push({cordId:c.id,partId:p.id,partName:p.name,layer:p.layer,
      before:Boolean(before),after:Boolean(after),newWitness:after&&!before?after:null});
  }
  console.log(JSON.stringify({cordId:c.id,processed:rows.length,potential}));
}
const summary={candidateCordParts:cord.length,fixedParts:all.length,evaluatedPairs:cord.length*all.length,
  broadPhasePairs:potential,beforeCrossingPairs:rows.filter(r=>r.before).length,
  afterCrossingPairs:rows.filter(r=>r.after).length,newCrossingPairs:rows.filter(r=>r.after&&!r.before).length,
  resolvedCrossingPairs:rows.filter(r=>r.before&&!r.after).length};
for(const file of ['scripts/audit-cord-grid-neighbors.mjs','scripts/lib/triangle-witness.mjs','src/female-brain-bindings.ts',
  'src/female-arm-registration.ts','src/female-foot-registration.ts','src/female-cord-registration.ts',
  'data/catalog/female-cord-registration.json','src/female-source-restoration.ts'])read(file);
const report={status:'OFFLINE GEOMETRY DIAGNOSTIC; NOT ANATOMICAL APPROVAL OR A PUBLIC MODEL CHANGE',summary,rows,
  limitations:['Only strict transverse triangle surface crossings; complete containment, gap/attachment and distances are not checked.',
    'All 1191 fixed HRA parts are included, but independently displayed CT/male sources and clinical soft-tissue boundaries are not.',
    'Moved cord segments are compared against the exact pre-cord runtime geometry and the live registration output is independently matched to the offline candidate.'],
  files:[...hashes].map(([file,sha256])=>({file,sha256}))};
fs.writeFileSync('docs/anatomy-alignment/cord-section-grid-neighbors.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary));
for(const c of cord){c.original.dispose();c.candidate.dispose();}for(const p of all)p.g.dispose();
