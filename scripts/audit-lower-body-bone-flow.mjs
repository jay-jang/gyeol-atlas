// Independent scalar field replay; source/native bone relations are separate.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeVertices,mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
const root=process.argv[2];assert.ok(root);const out='.cache/lower-body-bone-flow';
const sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p));
const reportBytes=read(`${out}/report.json`),report=JSON.parse(reportBytes);for(const f of report.files)assert.equal(sha(read(f.file)),f.sha256,f.file);
const source=json('docs/anatomy-alignment/donor-source-comparison.json'),packing=json('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative;
const sourceZip=read('.cache/donor-fidelity/source-full.bin.gz'),candidateZip=read(report.binary.path);assert.equal(sha(sourceZip),packing.sha256);assert.equal(sha(candidateZip),report.binary.sha256);
const raw=gunzipSync(sourceZip),saved=gunzipSync(candidateZip),atlas=json('public/models/female/atlas-female.json');
const result={createdAt:new Date().toISOString(),reportSha256:sha(reportBytes),binarySha256:sha(candidateZip),vertices:0,indexReferences:0,coordinateDifferences:0,maximumStepBound:0,boneReadbacks:[],boneMuscleRelations:[],limitations:[
  'Scalar replay is independent of the flow mapper and optimizer, but source bone parsing uses the same STLLoader and mergeVertices utilities.',
  'Native targets are the current runtime-restored surfaces. Source bone and native HRA crossings are not interchangeable tissue relations or clinical approval.',
  'Surface intersections include point/tangent contact. Witnesses establish one strict triangle-interior intersection only, not volume penetration or normal attachment.',
  'Unchanged nerves, vessels and opposite-side interfaces are not independently rescreened here; the producer whole-atlas screen remains a separate result.'
]};
function replay(v,side){
  const m=side.initialMatrix;let [x,y,z]=v;
  [x,y,z]=[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
  for(const s of side.steps){const dx=x-s.centre[0],dy=y-s.centre[1],dz=z-s.centre[2],r2=dx*dx+dy*dy+dz*dz;if(r2>=s.radius*s.radius)continue;const t=Math.sqrt(r2)/s.radius,u=1-t,k=u*u*u*u*(4*t+1);x+=k*s.displacement[0];y+=k*s.displacement[1];z+=k*s.displacement[2];}
  return [Math.fround(x),Math.fround(y),Math.fround(z)];
}
for(const s of report.sides)for(const step of s.steps){const b=135*Math.hypot(...step.displacement)/(64*step.radius);assert.ok(b<=report.options.maximumBound+1e-14);assert.ok(Math.abs(b-step.lipschitzBound)<1e-14);result.maximumStepBound=Math.max(result.maximumStepBound,b);}
const finish=g=>{g.computeBoundingBox();g.boundsTree=new MeshBVH(g,{indirect:true});return g;};
function decoded(b,p){const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),3));g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i)),1));return finish(g);}
const muscles=new Map();
for(const p of report.binary.records){
  const original=packing.parts.find(q=>q.id===p.id),row=report.muscles.find(m=>m.id===p.id),side=report.sides.find(s=>s.side===row.side);assert.equal(p.vertexCount,original.vertexCount);assert.equal(p.indexCount,original.indexCount);
  for(let i=0;i<p.vertexCount;i++){const v=Array.from({length:3},(_,k)=>raw.readFloatLE(original.positions+4*(3*i+k))),mapped=replay(v,side);for(let k=0;k<3;k++){const value=saved.readFloatLE(p.positions+4*(3*i+k));result.coordinateDifferences+=value!==mapped[k];assert.equal(value,mapped[k],`${p.id}/${i}/${k}`);}}
  for(let i=0;i<p.indexCount;i++)assert.equal(saved.readUInt32LE(p.indices+4*i),raw.readUInt32LE(original.indices+4*i));
  assert.equal(sha(saved.subarray(p.positions,p.positions+p.vertexCount*12)),row.positionsSha256);assert.equal(sha(saved.subarray(p.indices,p.indices+p.indexCount*4)),row.indicesSha256);
  result.vertices+=p.vertexCount;result.indexReferences+=p.indexCount;muscles.set(p.id,{side:row.side,name:row.name,raw:decoded(raw,original),after:decoded(saved,p)});
}
const chunks=atlas.chunks.map(c=>gunzipSync(read(`public/models/female/${path.basename(c.gzip)}`)));
const patches=['female-source-restoration','female-knee-source-restoration'].map(name=>{const spec=json(`data/catalog/${name}.json`),b=read(`public/${spec.url}`);assert.equal(sha(b),spec.sha256);return {spec,bytes:gunzipSync(b)};});
function native(id){for(const {spec,bytes} of patches){const p=spec.records.find(r=>r.id===id);if(p)return decoded(bytes,p);}const p=atlas.parts.find(r=>r.id===id);assert.ok(p&&['skeletal','connective'].includes(p.system));return decoded(chunks[p.chunk],p);}
const loader=new STLLoader();
function relation(a,b){if(!a.boundingBox.intersectsBox(b.boundingBox)||!a.boundsTree.intersectsGeometry(b,new Matrix4()))return null;return {witness:meshCrossingWitness(a,b)};}
for(const side of report.sides)for(const bone of side.bones){
  const sourceFile=source.files.find(f=>f.side===side.side&&f.kind==='bone'&&f.structure===bone.name),bytes=read(path.join(root,sourceFile.file));assert.equal(sha(bytes),sourceFile.sha256);
  const parsed=loader.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));parsed.scale(.001,.001,.001);parsed.deleteAttribute('normal');const original=finish(mergeVertices(parsed,1e-9));parsed.dispose();
  const moved=original.clone(),pos=moved.attributes.position,p=new Vector3();for(let i=0;i<pos.count;i++)pos.setXYZ(i,...replay(p.fromBufferAttribute(original.attributes.position,i).toArray(),side));finish(moved);
  const hash=sha(Buffer.from(pos.array.buffer,pos.array.byteOffset,pos.array.byteLength));assert.equal(hash,bone.positionsSha256);result.boneReadbacks.push({side:side.side,name:bone.name,vertices:pos.count,positionsSha256:hash});
  const parts=bone.targetIds.map(native),target=finish(mergeGeometries(parts));parts.forEach(g=>g.dispose());
  for(const [id,muscle] of muscles){if(muscle.side!==side.side)continue;
    const rawRelation=relation(muscle.raw,original),mappedSource=relation(muscle.after,moved),nativeTarget=relation(muscle.after,target);
    result.boneMuscleRelations.push({side:side.side,bone:bone.name,targetIds:bone.targetIds,muscleId:id,muscleName:muscle.name,source:rawRelation,mappedSource,nativeTarget});
  }
  original.dispose();moved.dispose();target.dispose();
}
assert.equal(result.boneMuscleRelations.length,380);
result.relationSummary={examinedPairs:380,sourcePairs:result.boneMuscleRelations.filter(r=>r.source).length,mappedSourcePairs:result.boneMuscleRelations.filter(r=>r.mappedSource).length,nativeTargetPairs:result.boneMuscleRelations.filter(r=>r.nativeTarget).length,
  newMappedSourcePairs:result.boneMuscleRelations.filter(r=>!r.source&&r.mappedSource).length,removedMappedSourcePairs:result.boneMuscleRelations.filter(r=>r.source&&!r.mappedSource).length,
  nativeTargetWithoutSourcePair:result.boneMuscleRelations.filter(r=>!r.source&&r.nativeTarget).length,nativeTargetWithSourcePair:result.boneMuscleRelations.filter(r=>r.source&&r.nativeTarget).length};
result.scriptSha256=sha(read('scripts/audit-lower-body-bone-flow.mjs'));fs.writeFileSync(`${out}/readback.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,boneReadbacks:result.boneReadbacks.length,boneMuscleRelations:result.boneMuscleRelations.length}));for(const m of muscles.values()){m.raw.dispose();m.after.dispose();}
