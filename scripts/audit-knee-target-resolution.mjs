// Factor target resolution at fixed coordinates; never export runtime changes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3,Triangle} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {officialMeshes} from './lib/official-meshes.mjs';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
import {applyFemaleSourceRestoration} from '../src/female-source-restoration.ts';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';
import {resolveFemaleBrainGeometryPart} from '../src/female-brain-bindings.ts';

const out='.cache/knee-target-resolution',files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');fs.mkdirSync(out,{recursive:true});
const read=file=>{const b=fs.readFileSync(file);files.set(file,sha(b));return b;},json=p=>JSON.parse(read(p));
const atlas=json('public/models/female/atlas-female.json'),catalog=new Map(json('data/female-atlas-structures.json').map(p=>[p.id,p]));
const membership=json('docs/anatomy-alignment/hra-bone-targets.json'),reference=json('docs/anatomy-alignment/hra-brain-source.json');assert.equal(files.get('public/models/female/atlas-female.json'),membership.atlasSha256);
const official=read(membership.sourceFile);assert.equal(sha(official),membership.sourceSha256);
const members=membership.targets.flatMap(t=>t.members.map(m=>({...m,side:t.side,bone:t.bone})));assert.equal(members.length,38);
const native=officialMeshes(official,members.map(m=>m.sourceName),reference.translationFromSkin);
for(const f of json('data/catalog/female-atlas-source.json').files)assert.equal(sha(read(f.path)),f.sha256);
const chunks=atlas.chunks.map(c=>gunzipSync(read(`public/models/female/${c.gzip.split('/').pop()}`))),byId=new Map(atlas.parts.map(p=>[p.id,p]));
const restoration=json('data/catalog/female-source-restoration.json'),restorationBytes=gunzipSync(read(`public/${restoration.url}`)),restored=restorationBytes.buffer.slice(restorationBytes.byteOffset,restorationBytes.byteOffset+restorationBytes.byteLength);
const finish=g=>{g.computeBoundingBox();g.boundsTree=new MeshBVH(g,{indirect:true});return g;};
function decoded(bytes,p){
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>bytes.readFloatLE(p.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>bytes.readUInt32LE(p.indices+4*i)),1));return g;
}
const runtime=atlas.parts.map(p=>{
  const q=resolveFemaleBrainGeometryPart(p,'female',byId),g=decoded(chunks[q.chunk],q);
  applyFemaleSourceRestoration(g,'female',p.id,p.system,restored);applyFemaleArmRegistration(g,'female',p.id,p.system);applyFemaleFootRegistration(g,'female',p.id,p.system);
  return {id:p.id,name:p.name,layer:catalog.get(p.id).layer,g:finish(g)};
}),runtimeMap=new Map(runtime.map(p=>[p.id,p]));assert.equal(runtime.length,1220);
const sources=new Map(members.map(m=>[m.id,finish(native.get(m.sourceName).geometry)])),point=new Vector3();
function metric(g,target,centroids=false){
  const values=[];let maximumWitness=null;
  const a=g.attributes.position,index=g.index.array,ids=centroids?Array.from({length:index.length/3},(_,i)=>i):referencedVertices(g,Infinity);
  for(const i of ids){
    if(centroids){point.set(0,0,0);for(let j=0;j<3;j++)point.add(new Vector3().fromBufferAttribute(a,index[3*i+j]));point.multiplyScalar(1/3);}else point.fromBufferAttribute(a,i);
    const hit=target.boundsTree.closestPointToPoint(point),mm=1000*hit.distance;values.push(mm);
    if(!maximumWitness||mm>maximumWitness.distanceMm)maximumWitness={index:i,kind:centroids?'triangle-centroid':'vertex',pointMetres:point.toArray(),nearestPointMetres:hit.point.toArray(),distanceMm:mm};
  }
  values.sort((a,b)=>a-b);assert.ok(values.length);return {count:values.length,medianMm:values[Math.floor(values.length*.5)],p95Mm:values[Math.floor(values.length*.95)],maximumMm:values.at(-1),maximumWitness};
}
function exhaustive(w,target){
  const tri=new Triangle(),p=new Vector3(...w.pointMetres),nearest=new Vector3(),a=target.attributes.position,index=target.index.array;let distance=Infinity,triangle=-1;
  for(let i=0;i<index.length;i+=3){tri.a.fromBufferAttribute(a,index[i]);tri.b.fromBufferAttribute(a,index[i+1]);tri.c.fromBufferAttribute(a,index[i+2]);tri.closestPointToPoint(p,nearest);const d=p.distanceTo(nearest);if(d<distance){distance=d;triangle=i/3;}}
  const residualMm=Math.abs(distance*1000-w.distanceMm);assert.ok(residualMm<1e-8);return {triangles:index.length/3,triangle,distanceMm:distance*1000,residualMm};
}
function comparison(original,packed){
  const forward=metric(original,packed),reverse=metric(packed,original),centroidForward=metric(original,packed,true),centroidReverse=metric(packed,original,true);
  return {forward,reverse,centroidForward,centroidReverse,maximumWitnessChecks:[exhaustive(forward.maximumWitness,packed),exhaustive(reverse.maximumWitness,original),exhaustive(centroidForward.maximumWitness,packed),exhaustive(centroidReverse.maximumWitness,original)]};
}
const probe=surfaceProbe(runtimeMap.get('HRAF0003').g,.002);
function skin(g){const r={vertices:0,inside:0,outside:0,'surface-band':0,ambiguous:0};for(const i of referencedVertices(g,Infinity)){r.vertices++;r[probe.classify(point.fromBufferAttribute(g.attributes.position,i)).kind]++;}return r;}
const report={createdAt:new Date().toISOString(),status:'FIXED-POSE TARGET RESOLUTION AUDIT; NO RUNTIME EXPORT',sourceFile:membership.sourceFile,sourceSha256:sha(official),translationFromSkin:reference.translationFromSkin,parts:[],composites:[],muscleStates:[],runtimeRelations:[],limitations:[
  'The exact prior common skin translation is retained. No fitting, scaling, reflection or node reassignment is performed.',
  'Vertex and triangle-centroid distances are finite evaluation sets, not continuous Hausdorff bounds.',
  'Official Femur hierarchy includes source-labelled cartilage and insertion surfaces, not pure bone alone.',
  'Original geometry is a source-fidelity reference, not independent anatomical or clinical ground truth.',
  'Crossing checks report surface relations, not solid containment or penetration depth. No crossing is not proof of correct attachment.',
  'Muscle states retain their exact prior saved matrices and full source triangles. Restoring a target surface cannot approve their remaining skin or fixed-tissue failures.',
  'Whole-runtime comparison changes only these 38 source surfaces; all other 1182 overview meshes retain current runtime geometry, including existing source/arm/foot/brain corrections.'
]};
const binary=[],records=[];let offset=0;
for(const m of members){
  const s=native.get(m.sourceName),g=sources.get(m.id),p=byId.get(m.id),packed=runtimeMap.get(m.id).g;assert.equal(s.nodeIndex,m.nodeIndex);assert.ok(g.attributes.normal);
  const boundsResidualMm=Math.max(...[g.boundingBox.min.toArray(),g.boundingBox.max.toArray()].flatMap((v,i)=>v.map((x,k)=>Math.abs(x-p.bounds[i][k])*1000)));assert.ok(boundsResidualMm<.01);
  const position=Buffer.from(g.attributes.position.array.buffer,g.attributes.position.array.byteOffset,g.attributes.position.array.byteLength),normal=Buffer.from(g.attributes.normal.array.buffer,g.attributes.normal.array.byteOffset,g.attributes.normal.array.byteLength),indices=Buffer.from(Uint32Array.from(g.index.array).buffer);
  records.push({...m,vertexCount:g.attributes.position.count,indexCount:g.index.count,positions:offset,normals:offset+position.length,indices:offset+position.length+normal.length,worldMatrix:s.worldMatrix});binary.push(position,normal,indices);offset+=position.length+normal.length+indices.length;
  const row={...m,sourceVertices:g.attributes.position.count,packedVertices:packed.attributes.position.count,sourceIndexReferences:g.index.count,packedIndexReferences:packed.index.count,boundsResidualMm,skinPacked:skin(packed),skinOriginal:skin(g),...comparison(g,packed)};report.parts.push(row);
}
for(const t of membership.targets){
  const a=finish(mergeGeometries(t.members.map(m=>sources.get(m.id)))),b=finish(mergeGeometries(t.members.map(m=>runtimeMap.get(m.id).g)));
  report.composites.push({side:t.side,bone:t.bone,ids:t.members.map(m=>m.id),...comparison(a,b)});a.dispose();b.dispose();
}
const crossing=(a,b)=>a.boundingBox.intersectsBox(b.boundingBox)&&a.boundsTree.intersectsGeometry(b,new Matrix4());
function relation(a,b){
  if(!crossing(a,b))return null;
  const counts=triangleCrossings(a,b),witness=meshCrossingWitness(a,b);
  // Plane-straddling and strict segment/triangle-interior tests have different
  // edge tolerances. Retain a missing witness explicitly, never call it verified.
  return {...counts,witness,strictCountWithoutInteriorWitness:counts.strictPlaneStraddlingPairs>0&&!witness};
}
const frameReport=json('docs/anatomy-alignment/knee-initial.json'),packing=json('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative,sourceZip=read('.cache/donor-fidelity/source-full.bin.gz');assert.equal(sha(sourceZip),packing.sha256);const raw=gunzipSync(sourceZip);
for(const state of ['current',...frameReport.evaluations.map(e=>e.mode)]){
  const evaluation=frameReport.evaluations.find(e=>e.mode===state),muscles=new Map(frameReport.evaluations[0].muscles.map(m=>{
    const g=state==='current'?runtimeMap.get(m.id).g:finish(decoded(raw,packing.parts.find(p=>p.id===m.id)).applyMatrix4(new Matrix4().fromArray(evaluation.muscles.find(p=>p.id===m.id).matrix)));
    return [m.id,g];
  })),rows=[];let examinedPairs=0;
  for(const [muscleId,g] of muscles)for(const target of members){
    examinedPairs++;const packed=relation(g,runtimeMap.get(target.id).g),original=relation(g,sources.get(target.id));if(packed||original)rows.push({muscleId,muscleName:byId.get(muscleId).name,targetId:target.id,targetName:target.name,packed,original});
  }
  const summary={examinedPairs,packedPairs:rows.filter(r=>r.packed).length,originalPairs:rows.filter(r=>r.original).length,packedOnlyPairs:rows.filter(r=>r.packed&&!r.original).length,originalOnlyPairs:rows.filter(r=>!r.packed&&r.original).length};assert.equal(examinedPairs,1900);
  report.muscleStates.push({state,summary,rows});if(state!=='current')muscles.forEach(g=>g.dispose());console.log(JSON.stringify({state,...summary}));
}
let runtimePairCount=0;
for(let i=0;i<runtime.length;i++)for(let j=i+1;j<runtime.length;j++){
  const a=runtime[i],b=runtime[j];if(!sources.has(a.id)&&!sources.has(b.id))continue;runtimePairCount++;
  const before=relation(a.g,b.g),after=relation(sources.get(a.id)||a.g,sources.get(b.id)||b.g);if(before||after)report.runtimeRelations.push({ids:[a.id,b.id],names:[a.name,b.name],layers:[a.layer,b.layer],bothChanged:sources.has(a.id)&&sources.has(b.id),before,after});
}
assert.equal(runtimePairCount,38*1182+38*37/2);
report.runtimeSummary={changedMeshes:38,uniquePairs:runtimePairCount,beforePairs:report.runtimeRelations.filter(r=>r.before).length,afterPairs:report.runtimeRelations.filter(r=>r.after).length,removedPairs:report.runtimeRelations.filter(r=>r.before&&!r.after).length,newPairs:report.runtimeRelations.filter(r=>!r.before&&r.after).length};
const uncompressed=Buffer.concat(binary),compressed=gzipSync(uncompressed,{level:9});assert.equal(uncompressed.length,offset);fs.writeFileSync(`${out}/original-targets.bin.gz`,compressed);report.binary={path:`${out}/original-targets.bin.gz`,bytes:uncompressed.length,gzipBytes:compressed.length,sha256:sha(compressed),records};
for(const file of ['scripts/audit-knee-target-resolution.mjs','scripts/lib/official-meshes.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-crossings.mjs','scripts/lib/triangle-witness.mjs','src/female-source-restoration.ts','src/female-arm-registration.ts','src/female-foot-registration.ts','src/female-brain-bindings.ts','data/catalog/female-arm-registration.json','data/catalog/female-foot-registration.json','data/catalog/female-brain-bindings.json','package-lock.json'])read(file);
report.files=[...files].map(([file,sha256])=>({file,sha256}));fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({runtime:report.runtimeSummary,skin:report.parts.reduce((r,p)=>[r[0]+p.skinPacked.outside,r[1]+p.skinOriginal.outside,r[2]+p.skinOriginal.ambiguous],[0,0,0]),distances:report.composites.map(p=>({side:p.side,bone:p.bone,forward95:p.forward.p95Mm,forwardMax:p.forward.maximumMm,reverse95:p.reverse.p95Mm,reverseMax:p.reverse.maximumMm}))}));
probe.dispose();runtime.forEach(p=>p.g.dispose());sources.forEach(g=>g.dispose());
