// Private candidate: source envelope drives a single common flow, with all
// placed source bones and every unchanged non-skin runtime surface protected.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeVertices,mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {fitProtectedFlow} from './lib/fit-protected-flow.mjs';
import {mapCompactDisplacements} from './lib/compact-displacement.mjs';
import {referencedVertices,surfaceProbe} from './lib/surface-containment.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';
import {applyFemaleSourceRestoration} from '../src/female-source-restoration.ts';
import {applyFemaleKneeSourceRestoration} from '../src/female-knee-source-restoration.ts';
import {resolveFemaleBrainGeometryPart} from '../src/female-brain-bindings.ts';
const [originalRoot,finalRoot]=process.argv.slice(2);assert.ok(originalRoot&&finalRoot);assert.equal(process.argv.length,4);
const out='.cache/lower-body-protected-flow';fs.mkdirSync(out,{recursive:true});
const files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>{const b=fs.readFileSync(p);files.set(p,sha(b));return b;},json=p=>JSON.parse(read(p));
const source=json('docs/anatomy-alignment/donor-source-comparison.json'),previous=json('docs/anatomy-alignment/lower-body-bone-flow.json');
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
const runtimeMap=new Map(runtime.map(p=>[p.id,p])),changed=new Set(source.muscles.map(m=>m.id)),point=new Vector3(),identity=new Matrix4();
const hashArray=a=>sha(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
function mapped(g,matrix,steps){const result=g.clone(),a=result.attributes.position;for(let i=0;i<a.count;i++)a.setXYZ(i,...mapCompactDisplacements(point.fromBufferAttribute(g.attributes.position,i),matrix,steps).point.toArray());return finish(result);}
const initialMatrices=new Map(previous.sides.map(s=>[s.side,new Matrix4().fromArray(s.initialMatrix)]));
const muscles=source.muscles.map(m=>{const side=m.fitGroup.split('-')[0],record=packing.parts.find(p=>p.id===m.id),g=finish(decoded(raw,record));return {...m,side,record,raw:g,initial:mapped(g,initialMatrices.get(side),[])};});
const loader=new STLLoader();
function stl(file,expected){const b=read(file);assert.equal(sha(b),expected);const g=loader.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));g.scale(.001,.001,.001);g.deleteAttribute('normal');const welded=mergeVertices(g,1e-9);g.dispose();return finish(welded);}
const bones=[];
for(const side of ['left','right'])for(const name of ['Pelvis','Femur','Patella','Tibia','Fibula']){
  const file=source.files.find(f=>f.side===side&&f.kind==='bone'&&f.structure===name);assert.ok(file);
  const g=stl(path.join(finalRoot,file.file),file.sha256);bones.push({side,name,raw:g,initial:mapped(g,initialMatrices.get(side),[])});
}
const fixed=runtime.filter(p=>!changed.has(p.id)&&p.id!=='HRAF0003');assert.equal(fixed.length,1143);
const protectedGeometry=finish(mergeGeometries([...fixed.map(p=>p.g),...bones.map(b=>b.initial)]));
const skin=runtimeMap.get('HRAF0003').g,probe=surfaceProbe(skin,.002);
const receipt=json('docs/anatomy-alignment/donor-original-receipt.json'),envelopeRecord=receipt.combined.find(r=>r.entry.endsWith('/VHF_Both_All.stl'));assert.ok(envelopeRecord);
const envelope=stl(path.join(originalRoot,envelopeRecord.entry),envelopeRecord.sha256);assert.equal(envelope.attributes.position.count,326280);
const rawBoneSides=new Map(['left','right'].map(side=>[side,finish(mergeGeometries(bones.filter(b=>b.side===side).map(b=>b.raw)))]));
const yMin=Math.min(...muscles.map(m=>m.initial.boundingBox.min.y))-.02,yMax=Math.max(...muscles.map(m=>m.initial.boundingBox.max.y))+.02;
const envelopeSamples=[];
// Deterministic candidates over the full envelope, then geometric eligibility.
// This is a control point cloud, not a stitched/reconstructed skin surface.
for(const vertex of referencedVertices(envelope,4096)){
  const p=new Vector3().fromBufferAttribute(envelope.attributes.position,vertex);
  const left=rawBoneSides.get('left').boundsTree.closestPointToPoint(p).distance,right=rawBoneSides.get('right').boundsTree.closestPointToPoint(p).distance;
  const side=left<=right?'left':'right',placed=p.clone().applyMatrix4(initialMatrices.get(side));
  if(placed.y<yMin||placed.y>yMax)continue;
  envelopeSamples.push({vertex,side,initial:placed.toArray()});
}
assert.ok(envelopeSamples.length>2000);
const options={iterations:480,centresPerRound:48,maximumRadius:.16,minimumRadius:.003,margin:1e-6,maximumBound:.15,maximumDisplacement:.003,regularization:1e-5};
const fit=fitProtectedFlow(envelopeSamples.map(s=>new Vector3(...s.initial)),p=>skin.boundsTree.closestPointToPoint(p).point,p=>protectedGeometry.boundsTree.closestPointToPoint(p).distance,options,r=>console.log(JSON.stringify({iteration:r.iteration,rmsMm:1000*Math.sqrt(r.loss)})));
const report={createdAt:new Date().toISOString(),status:'CANDIDATE ONLY; no runtime export',options,initialMatrices:[...initialMatrices].map(([side,m])=>({side,matrix:m.toArray()})),envelope:{vertexCount:envelope.attributes.position.count,yMin,yMax,samples:envelopeSamples},fit,fixedIds:fixed.map(p=>p.id),protectedIndexReferences:protectedGeometry.index.count,bones:[],muscles:[],relations:[],sourceBoneRelations:[],limitations:[
  'The same post-placement flow acts on all76 muscles. Initial side-specific similarity maps are not a single continuous donor-to-atlas map.',
  'Source envelope samples drive the objective. All muscle vertices are held out, but the envelope eligibility y range comes from placed muscle bounds. Sampling is deterministic, not area weighted.',
  'Envelope left/right assignment is nearest raw source bone group; placed controls are a point cloud, not a continuous skin remesh or anatomical landmark set.',
  'Protected surfaces include all1143 unchanged non-skin runtime meshes and all10 placed source bones. Protecting their positions preserves their existing errors, not correct anatomy.',
  'Disjoint support balls and continuous invertibility do not certify straight Float32 triangle relations or biological deformation. Full stored mesh crossings remain separate.',
  'Initial source-bone and HRA surface disagreement remains; neither source bones nor HRA are replaced or relabeled.',
  'Skin containment, intersections and numerical fit are diagnostic, not clinical attachment or nerve-course approval.'
]};
fs.writeFileSync(`${out}/fit.partial.json`,JSON.stringify(report,null,2)+'\n');
// Independent scalar replay of the post-placement flow on fixed input vertices.
function replay(x,y,z){for(const s of fit.steps){const dx=x-s.centre[0],dy=y-s.centre[1],dz=z-s.centre[2],r2=dx*dx+dy*dy+dz*dz;if(r2>=s.radius*s.radius)continue;const t=Math.sqrt(r2)/s.radius,u=1-t,k=u*u*u*u*(4*t+1);x+=k*s.displacement[0];y+=k*s.displacement[1];z+=k*s.displacement[2];}return [x,y,z];}
let protectedVertices=0,protectedDifferences=0,maximumClearanceDifference=0;
for(const s of fit.steps){const d=protectedGeometry.boundsTree.closestPointToPoint(new Vector3(...s.centre)).distance;maximumClearanceDifference=Math.max(maximumClearanceDifference,Math.abs(d-s.protectedDistance));assert.ok(d-s.radius>=options.margin-1e-12);}
for(const g of [...fixed.map(p=>p.g),...bones.map(b=>b.initial)]){const a=g.attributes.position;for(let i=0;i<a.count;i++){const v=[a.getX(i),a.getY(i),a.getZ(i)],m=replay(...v);protectedVertices++;for(let k=0;k<3;k++){protectedDifferences+=v[k]!==m[k];assert.equal(m[k],v[k]);}}}
report.protectionReadback={vertices:protectedVertices,coordinateDifferences:protectedDifferences,maximumClearanceDifference,supportQueries:fit.steps.length};
const tally=()=>({inside:0,outside:0,'surface-band':0,ambiguous:0,maximumOutsideMm:0}),count=(r,c)=>{r[c.kind]++;if(c.kind==='outside')r.maximumOutsideMm=Math.max(r.maximumOutsideMm,c.distance*1000);};
const buffers=[],records=[];let offset=0,readbackDifferences=0;
for(const m of muscles){
  // Apply to stored common initial coordinates so every held-out geometry uses
  // exactly the same starting space as the protected source bones.
  m.after=mapped(m.initial,identity,fit.steps);
  const row={id:m.id,name:m.name,side:m.side,vertices:m.record.vertexCount,indexReferences:m.record.indexCount,initial:tally(),after:tally(),newOutside:0,worsenedOutside:0,jacobianSamples:[]};
  const a=m.initial.attributes.position,b=m.after.attributes.position;
  for(let i=0;i<a.count;i++){
    const before=probe.classify(point.fromBufferAttribute(a,i)),after=probe.classify(point.fromBufferAttribute(b,i));count(row.initial,before);count(row.after,after);
    row.newOutside+=after.kind==='outside'&&before.kind!=='outside';row.worsenedOutside+=after.kind==='outside'&&before.kind==='outside'&&after.distance>before.distance+1e-6;
    const v=replay(a.getX(i),a.getY(i),a.getZ(i));for(let k=0;k<3;k++){readbackDifferences+=b.array[3*i+k]!==Math.fround(v[k]);assert.equal(b.array[3*i+k],Math.fround(v[k]));}
  }
  for(const i of referencedVertices(m.initial,128)){const mapped=mapCompactDisplacements(point.fromBufferAttribute(a,i),identity,fit.steps,true);assert.ok(mapped.determinant>0);row.jacobianSamples.push({vertex:i,determinant:mapped.determinant});}
  const positions=Buffer.from(b.array.buffer,b.array.byteOffset,b.array.byteLength),indices=Buffer.from(m.after.index.array.buffer,m.after.index.array.byteOffset,m.after.index.array.byteLength);
  row.positionsSha256=sha(positions);row.indicesSha256=sha(indices);assert.equal(hashArray(m.after.index.array),hashArray(m.raw.index.array));
  records.push({id:m.id,name:m.name,positions:offset,indices:offset+positions.length,vertexCount:b.count,indexCount:m.after.index.count});offset+=positions.length+indices.length;buffers.push(positions,indices);report.muscles.push(row);
  console.log(JSON.stringify({id:m.id,outside:[row.initial.outside,row.after.outside],newOutside:row.newOutside}));
}
const crosses=(a,b)=>a.boundingBox.intersectsBox(b.boundingBox)&&a.boundsTree.intersectsGeometry(b,identity),muscleMap=new Map(muscles.map(m=>[m.id,m]));
let examinedPairs=0;
for(let i=0;i<runtime.length;i++)for(let j=i+1;j<runtime.length;j++){
  const a=runtime[i],b=runtime[j],ma=muscleMap.get(a.id),mb=muscleMap.get(b.id);if(!ma&&!mb)continue;examinedPairs++;
  const row={ids:[a.id,b.id],names:[a.name,b.name],layers:[a.layer,b.layer],sourceSameSide:ma&&mb&&ma.side===mb.side?crosses(ma.raw,mb.raw):null,current:crosses(a.g,b.g),initial:crosses(ma?.initial||a.g,mb?.initial||b.g),after:crosses(ma?.after||a.g,mb?.after||b.g)};
  if(!row.current&&!row.initial&&!row.after&&!row.sourceSameSide)continue;
  if(row.after&&!row.initial)row.interiorWitness=meshCrossingWitness(ma?.after||a.g,mb?.after||b.g);
  report.relations.push(row);
}
for(const b of bones){
  report.bones.push({side:b.side,name:b.name,vertices:b.initial.attributes.position.count,positionsSha256:hashArray(b.initial.attributes.position.array)});
  for(const m of muscles.filter(m=>m.side===b.side)){
    const sourceCrosses=crosses(m.raw,b.raw),initialCrosses=crosses(m.initial,b.initial),afterCrosses=crosses(m.after,b.initial);
    const row={side:b.side,bone:b.name,muscleId:m.id,source:sourceCrosses,initial:initialCrosses,after:afterCrosses};
    if(afterCrosses&&!initialCrosses)row.interiorWitness=meshCrossingWitness(m.after,b.initial);
    report.sourceBoneRelations.push(row);
  }
}
assert.equal(examinedPairs,89794);assert.equal(report.sourceBoneRelations.length,380);
report.summary={meshes:76,vertices:report.muscles.reduce((n,m)=>n+m.vertices,0),examinedPairs,initialOutside:report.muscles.reduce((n,m)=>n+m.initial.outside,0),afterOutside:report.muscles.reduce((n,m)=>n+m.after.outside,0),initialAmbiguous:report.muscles.reduce((n,m)=>n+m.initial.ambiguous,0),afterAmbiguous:report.muscles.reduce((n,m)=>n+m.after.ambiguous,0),newOutside:report.muscles.reduce((n,m)=>n+m.newOutside,0),worsenedOutside:report.muscles.reduce((n,m)=>n+m.worsenedOutside,0),readbackDifferences};
for(const state of ['current','initial','after'])report.summary[`${state}Pairs`]=report.relations.filter(r=>r[state]).length;
for(const state of ['current','initial'])report.summary[`newAgainst_${state}`]=report.relations.filter(r=>r.after&&!r[state]).length;
report.summary.sourceBonePairs=report.sourceBoneRelations.filter(r=>r.source).length;report.summary.initialBonePairs=report.sourceBoneRelations.filter(r=>r.initial).length;report.summary.afterBonePairs=report.sourceBoneRelations.filter(r=>r.after).length;report.summary.newBonePairs=report.sourceBoneRelations.filter(r=>r.after&&!r.initial).length;
report.status='NOT APPROVED: existing alignment and held-out tissue failures remain; NO RUNTIME EXPORT';
const data=Buffer.concat(buffers);assert.equal(data.length,offset);const compressed=gzipSync(data,{level:9});fs.writeFileSync(`${out}/candidate.bin.gz`,compressed);report.binary={path:`${out}/candidate.bin.gz`,bytes:data.length,gzipBytes:compressed.length,sha256:sha(compressed),records};
for(const file of ['scripts/fit-lower-body-protected-flow.mjs','scripts/lib/fit-protected-flow.mjs','scripts/lib/compact-displacement.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-witness.mjs','src/female-arm-registration.ts','src/female-foot-registration.ts','src/female-source-restoration.ts','src/female-knee-source-restoration.ts','src/female-brain-bindings.ts','data/catalog/female-arm-registration.json','data/catalog/female-foot-registration.json','data/catalog/female-brain-bindings.json','package-lock.json'])read(file);
report.files=[...files].map(([file,sha256])=>({file,sha256}));fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
probe.dispose();protectedGeometry.dispose();envelope.dispose();for(const g of rawBoneSides.values())g.dispose();runtime.forEach(p=>p.g.dispose());for(const b of bones){b.raw.dispose();b.initial.dispose();}for(const m of muscles){m.raw.dispose();m.initial.dispose();m.after.dispose();}
