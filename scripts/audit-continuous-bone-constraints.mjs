// Evaluate the existing rejected muscle field on its actual source bones.
// No fit optimization, vertex export, or runtime geometry modification.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {surfaceFrameField} from './lib/surface-frame-field.mjs';
import {referencedVertices} from './lib/surface-containment.mjs';

const root=process.argv[2];assert.ok(root,'Pass the extracted Final STL directory');
const files=new Map(),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>{const bytes=fs.readFileSync(file);files.set(file,sha(bytes));return bytes;};
const json=file=>JSON.parse(read(file));
const candidate=json('docs/anatomy-alignment/continuous-hip-per-side.json');
assert.equal(candidate.perSide,true);assert.equal(candidate.hipSurface,true);
const source=json('docs/anatomy-alignment/donor-source-comparison.json');
const membership=json('docs/anatomy-alignment/hra-bone-targets.json');
const hips=json('docs/anatomy-alignment/hip-surface-fits.json');
const atlas=json('public/models/female/atlas-female.json');
assert.equal(files.get('public/models/female/atlas-female.json'),membership.atlasSha256);
for(const f of json('data/catalog/female-atlas-source.json').files)assert.equal(sha(read(f.path)),f.sha256);
// Pin the field implementation and all inputs used by the original candidate.
for(const f of candidate.files)assert.equal(sha(read(f.path)),f.sha256,f.path);
const chunks=atlas.chunks.map(c=>gunzipSync(read(`public/models/female/${path.basename(c.gzip)}`)));
const bones=new Map(),frames=[];
for(const frame of candidate.frames){
  const pieces=[];
  for(const name of frame.bones){
    const record=source.files.find(f=>f.kind==='bone'&&f.side===frame.side&&f.structure===name);assert.ok(record);
    const bytes=read(path.join(root,record.file));assert.equal(sha(bytes),record.sha256);
    const raw=new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    raw.scale(.001,.001,.001);raw.deleteAttribute('normal');
    const geometry=mergeVertices(raw,1e-8);raw.dispose();
    const key=`${frame.side}-${name}`;assert.ok(!bones.has(key));
    bones.set(key,{geometry,record,frame});pieces.push(geometry);
  }
  const geometry=mergeGeometries(pieces);geometry.boundsTree=new MeshBVH(geometry);
  frames.push({side:frame.side,group:frame.group,geometry,matrix:new Matrix4().fromArray(frame.matrix),nearest:p=>geometry.boundsTree.closestPointToPoint(p)});
}
assert.equal(bones.size,10);
const fields=Object.fromEntries(['left','right'].map(side=>[side,surfaceFrameField(frames.filter(f=>f.side===side),candidate.regularizationMm/1000,candidate.kernel)]));
// Independently ensure these reconstructed fields reproduce the serialized
// muscle candidate at every recorded maximum-outside witness (where present).
const binary=read(candidate.binary.path);assert.equal(sha(binary),candidate.binary.sha256);
const packed=gunzipSync(binary);let reproducedMuscleWitnesses=0;
for(const row of candidate.rows){
  const witness=row.maximumOutsideWitness;if(!witness)continue;
  const mapped=fields[row.sourceSide](new Vector3(...witness.sourcePointMetres)).point.toArray().map(Math.fround);
  assert.deepEqual(mapped,witness.candidatePointMetres);
  const part=candidate.binary.parts.find(p=>p.id===row.id);assert.ok(part);
  assert.deepEqual(mapped,[0,1,2].map(k=>packed.readFloatLE(part.positions+4*(witness.vertex*3+k))));
  reproducedMuscleWitnesses++;
}
function targetGeometry(ids){
  const pieces=ids.map(id=>{
    const part=atlas.parts.find(p=>p.id===id);assert.ok(part);
    const bytes=chunks[part.chunk],g=new BufferGeometry();
    g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>bytes.readFloatLE(part.positions+4*i)),3));
    g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>bytes.readUInt32LE(part.indices+4*i)),1));return g;
  });
  const g=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());g.boundsTree=new MeshBVH(g);return g;
}
function stats(values){
  assert.ok(values.length>0&&values.every(Number.isFinite));values.sort((a,b)=>a-b);
  return {vertices:values.length,medianMm:values[Math.floor(values.length*.5)],p95Mm:values[Math.floor(values.length*.95)],maximumMm:values.at(-1)};
}
function distance(g,target){
  const p=new Vector3(),values=[];let witness=null;
  for(const vertex of referencedVertices(g,Infinity)){
    p.fromBufferAttribute(g.attributes.position,vertex);
    const nearest=target.boundsTree.closestPointToPoint(p),mm=nearest.distance*1000;values.push(mm);
    if(!witness||mm>witness.distanceMm)witness={vertex,pointMetres:p.toArray(),nearestMetres:nearest.point.toArray(),distanceMm:mm};
  }
  return {...stats(values),maximumWitness:witness};
}
const rows=[];
for(const {geometry,record,frame} of bones.values()){
  const {side,structure:name}=record,matrix=new Matrix4().fromArray(frame.matrix),field=fields[side];
  const targetIds=name==='Pelvis'?hips.fits.find(f=>f.side===side).targetIds:membership.targets.find(t=>t.side===side&&t.bone===name).members.map(m=>m.id);
  const target=targetGeometry(targetIds),own=geometry.clone().applyMatrix4(matrix),blended=geometry.clone();
  const p=new Vector3(),q=new Vector3(),drift=[];let witness=null,minimumDeterminant=Infinity,maximumDeterminant=-Infinity,nonpositiveDeterminants=0;
  for(const vertex of referencedVertices(geometry,Infinity)){
    p.fromBufferAttribute(geometry.attributes.position,vertex);const mapped=field(p);
    q.copy(p).applyMatrix4(matrix);
    const mm=q.distanceTo(mapped.point)*1000;drift.push(mm);
    // Three's Float32 storage is retained for all actual surface comparisons.
    blended.attributes.position.setXYZ(vertex,...mapped.point.toArray());
    minimumDeterminant=Math.min(minimumDeterminant,mapped.determinant);maximumDeterminant=Math.max(maximumDeterminant,mapped.determinant);
    if(mapped.determinant<=0)nonpositiveDeterminants++;
    if(!witness||mm>witness.distanceMm)witness={vertex,sourcePointMetres:p.toArray(),ownFramePointMetres:q.toArray(),fieldPointMetres:mapped.point.toArray(),distanceMm:mm,weights:mapped.weights,frameOrder:frames.filter(f=>f.side===side).map(f=>f.group),sourceSurfaceDistancesMetres:mapped.distancesMetres};
  }
  assert.equal(drift.length,geometry.attributes.position.count);
  own.boundsTree=new MeshBVH(own);blended.boundsTree=new MeshBVH(blended);
  const row={side,name,frame:frame.group,targetIds,sourceVertices:drift.length,
    ownFrame:{sourceToTarget:distance(own,target),targetToSource:distance(target,own)},
    blendedField:{sourceToTarget:distance(blended,target),targetToSource:distance(target,blended)},
    displacementFromOwnFrame:{...stats(drift),maximumWitness:witness},
    jacobian:{minimumDeterminant,maximumDeterminant,nonpositiveDeterminants}};
  rows.push(row);console.log(JSON.stringify({side,name,drift95:row.displacementFromOwnFrame.p95Mm,driftMax:witness.distanceMm,ownForward95:row.ownFrame.sourceToTarget.p95Mm,fieldForward95:row.blendedField.sourceToTarget.p95Mm,nonpositiveDeterminants}));
  target.dispose();own.dispose();blended.dispose();
}
for(const file of ['scripts/audit-continuous-bone-constraints.mjs','scripts/lib/surface-frame-field.mjs','scripts/lib/surface-containment.mjs','package-lock.json'])read(file);
const result={createdAt:new Date().toISOString(),status:'DIAGNOSTIC ONLY; existing rejected candidate remains unexported',
  method:'Existing per-side Gaussian field evaluated on all indexed source vertices of its 10 anchor bones; compared to each own fitted frame and corresponding HRA composite surfaces in both directions.',
  kernel:candidate.kernel,regularizationMm:candidate.regularizationMm,reproducedMuscleWitnesses,rows,
  summary:{bones:rows.length,sourceVertices:rows.reduce((n,r)=>n+r.sourceVertices,0),
    maximumFrameDisplacementMm:Math.max(...rows.map(r=>r.displacementFromOwnFrame.maximumMm)),
    nonpositiveDeterminants:rows.reduce((n,r)=>n+r.jacobian.nonpositiveDeterminants,0),
    worsenedForwardP95:rows.filter(r=>r.blendedField.sourceToTarget.p95Mm>r.ownFrame.sourceToTarget.p95Mm+1e-6).length,
    worsenedReverseP95:rows.filter(r=>r.blendedField.targetToSource.p95Mm>r.ownFrame.targetToSource.p95Mm+1e-6).length},
  limitations:['The common field is evaluated on source bones diagnostically; deployed HRA bones were not transformed.',
    'Own fitted frames are candidates, not ground-truth anatomical landmarks. Drift measures non-interpolation, not a clinical error threshold.',
    'The field interpolates affine frames softly; no bone constraint was enforced by its original implementation.',
    'Drift compares double-precision field/frame evaluation. Surface distances compare Float32 meshes at all referenced vertices, not continuous Hausdorff distance.',
    'Targets retain original HRA composite membership, including femoral cartilage and attachments, not pure bone-only segmentation.',
    'No muscle attachment, skin, nerve, tissue intersection or clinical validation is performed by this diagnostic.'],
  files:[...files].map(([file,sha256])=>({file,sha256}))};
fs.mkdirSync('.cache/donor-continuous',{recursive:true});
fs.writeFileSync('.cache/donor-continuous/bone-constraints.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.summary));
for(const {geometry} of bones.values())geometry.dispose();frames.forEach(f=>f.geometry.dispose());
