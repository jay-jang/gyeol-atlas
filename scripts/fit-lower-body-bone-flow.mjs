// Candidate only: a common per-side flow across pelvis, thigh and calf.
// Native runtime bones remain fixed; the mapped donor bones are diagnostics.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeVertices,mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {fitCompactFlow} from './lib/fit-compact-flow.mjs';
import {mapCompactDisplacements} from './lib/compact-displacement.mjs';
import {referencedVertices,surfaceProbe} from './lib/surface-containment.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';
import {applyFemaleSourceRestoration} from '../src/female-source-restoration.ts';
import {applyFemaleKneeSourceRestoration} from '../src/female-knee-source-restoration.ts';
import {resolveFemaleBrainGeometryPart} from '../src/female-brain-bindings.ts';
const root=process.argv[2];assert.ok(root);assert.equal(process.argv.length,3);
const out='.cache/lower-body-bone-flow';fs.mkdirSync(out,{recursive:true});
const files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>{const b=fs.readFileSync(p);files.set(p,sha(b));return b;},json=p=>JSON.parse(read(p));
const source=json('docs/anatomy-alignment/donor-source-comparison.json'),membership=json('docs/anatomy-alignment/hra-bone-targets.json'),hips=json('docs/anatomy-alignment/hip-surface-fits.json');
const fits=json('docs/anatomy-alignment/hierarchy-joint-bone-surface-fits.json'),atlas=json('public/models/female/atlas-female.json');
assert.equal(files.get('public/models/female/atlas-female.json'),membership.atlasSha256);
const packing=json('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative,zip=read('.cache/donor-fidelity/source-full.bin.gz');assert.equal(sha(zip),packing.sha256);const raw=gunzipSync(zip);
const chunks=atlas.chunks.map(c=>gunzipSync(read(`public/models/female/${path.basename(c.gzip)}`))),byId=new Map(atlas.parts.map(p=>[p.id,p]));
const patchBuffers=['female-source-restoration','female-knee-source-restoration'].map(name=>{const s=json(`data/catalog/${name}.json`),b=read(`public/${s.url}`);assert.equal(sha(b),s.sha256);const data=gunzipSync(b);return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);});
const catalog=new Map(json('data/female-atlas-structures.json').map(p=>[p.id,p]));
const finish=g=>{g.computeBoundingBox();g.boundsTree=new MeshBVH(g,{indirect:true});return g;};
function decoded(b,p){const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+i*4)),3));g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+i*4)),1));return g;}
const runtime=atlas.parts.map(p=>{
  const q=resolveFemaleBrainGeometryPart(p,'female',byId),g=decoded(chunks[q.chunk],q);
  applyFemaleSourceRestoration(g,'female',p.id,p.system,patchBuffers[0]);applyFemaleKneeSourceRestoration(g,'female',p.id,p.system,patchBuffers[1]);
  applyFemaleArmRegistration(g,'female',p.id,p.system);applyFemaleFootRegistration(g,'female',p.id,p.system);g.deleteAttribute('normal');
  return {id:p.id,name:p.name,layer:catalog.get(p.id).layer,g:finish(g)};
});assert.equal(runtime.length,1220);const runtimeMap=new Map(runtime.map(p=>[p.id,p]));
const loader=new STLLoader(),point=new Vector3();
function original(side,kind,name){const f=source.files.find(f=>f.side===side&&f.kind===kind&&f.structure===name);assert.ok(f);const b=read(path.join(root,f.file));assert.equal(sha(b),f.sha256);const g=loader.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));g.scale(.001,.001,.001);g.deleteAttribute('normal');const welded=mergeVertices(g,1e-9);g.dispose();return finish(welded);}
const select=(a,n)=>a.length<=n?a:Array.from({length:n},(_,i)=>a[Math.floor(i*(a.length-1)/(n-1))]);
const hashArray=a=>sha(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
const bytesOf=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
function mapped(g,initial,steps){const result=g.clone(),a=result.attributes.position;for(let i=0;i<a.count;i++)a.setXYZ(i,...mapCompactDisplacements(point.fromBufferAttribute(g.attributes.position,i),initial,steps).point.toArray());return finish(result);}
function distances(g,target){const values=referencedVertices(g,Infinity).map(i=>target.boundsTree.closestPointToPoint(point.fromBufferAttribute(g.attributes.position,i)).distance*1000).sort((a,b)=>a-b);return {vertices:values.length,medianMm:values[Math.floor(values.length*.5)],p95Mm:values[Math.floor(values.length*.95)],maximumMm:values.at(-1)};}
const options={iterations:240,radii:[.04,.08,.16,.32],maximumBound:.15,maximumDisplacement:.003,regularization:1e-5,centresPerGroup:12,samplesPerBone:300};
const report={createdAt:new Date().toISOString(),status:'EXPERIMENTAL; NO RUNTIME EXPORT',options,sides:[],muscles:[],relations:[],limitations:[
  'One common spatial map per side covers all38 donor muscles including hip muscles. Two side maps and interfaces with unchanged HRA tissues are NOT guaranteed compatible.',
  'Five source bone surfaces per side drive one-way equally weighted deterministic vertex closest-point objectives. These are not area-weighted anatomical landmark correspondences.',
  'All muscles, all skin and all ligament surfaces are held out of fitting. Source bone shape is deformed in the diagnostic, not preserved rigidly or exported to runtime.',
  'Continuous compact steps have derivative bound below one. This does not establish biomechanical plausibility, Float32 triangle topology, source-to-target attachment accuracy or clinical validity.',
  'All metrics refer to full referenced vertices, not continuous surface bounds. Jacobians are reported on deterministic muscle samples only.',
  'HRA bone targets include original source-labelled cartilage and inner surfaces. The current source-restored knees and ilium are included.',
  'Broad triangle surface intersections include tangencies and point contacts; strict interior witnesses are recorded separately without assuming one must exist.'
]};
const flows=new Map();
for(const side of ['left','right']){
  const initial=new Matrix4().fromArray(fits.fits.find(f=>f.side===side&&f.mode==='whole-leg').sourceToAtlasMatrix);assert.ok(initial.determinant()>0);
  const bones=['Pelvis','Femur','Patella','Tibia','Fibula'].map(name=>{
    const ids=name==='Pelvis'?hips.fits.find(f=>f.side===side).targetIds:membership.targets.find(t=>t.side===side&&t.bone===name).members.map(p=>p.id);
    return {name,ids,raw:original(side,'bone',name),target:finish(mergeGeometries(ids.map(id=>runtimeMap.get(id).g)))};
  });
  const controls=bones.map(b=>{const indices=select(referencedVertices(b.raw,Infinity),options.samplesPerBone);return {name:b.name,indices,weight:1/5,points:indices.map(i=>new Vector3().fromBufferAttribute(b.raw.attributes.position,i).applyMatrix4(initial)),closest:p=>b.target.boundsTree.closestPointToPoint(p).point};});
  const fit=fitCompactFlow(controls,options,r=>console.log(JSON.stringify({side,iteration:r.iteration,rmsMm:1000*Math.sqrt(r.loss),stepBound:r.stepBound})));
  const row={side,initialMatrix:initial.toArray(),...fit,controls:controls.map(c=>({name:c.name,indices:c.indices,weight:c.weight})),bones:[],ligaments:[]};flows.set(side,{initial,steps:fit.steps});
  for(const b of bones){const before=mapped(b.raw,initial,[]),after=mapped(b.raw,initial,fit.steps);row.bones.push({name:b.name,targetIds:b.ids,vertices:after.attributes.position.count,before:{forward:distances(before,b.target),reverse:distances(b.target,before)},after:{forward:distances(after,b.target),reverse:distances(b.target,after)},positionsSha256:hashArray(after.attributes.position.array)});before.dispose();after.dispose();b.raw.dispose();b.target.dispose();}
  const ligamentIds=side==='left'?{ACL:'HRAF0934',PCL:'HRAF0935',MCL:'HRAF0933',LCL:'HRAF0931'}:{ACL:'HRAF0905',PCL:'HRAF0906',MCL:'HRAF0904',LCL:'HRAF0908'};
  for(const [name,id] of Object.entries(ligamentIds)){const g=original(side,'ligament',name),before=mapped(g,initial,[]),after=mapped(g,initial,fit.steps),target=runtimeMap.get(id).g;row.ligaments.push({name,id,before:{forward:distances(before,target),reverse:distances(target,before)},after:{forward:distances(after,target),reverse:distances(target,after)}});g.dispose();before.dispose();after.dispose();}
  report.sides.push(row);fs.writeFileSync(`${out}/fit.partial.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({side,termination:row.termination,beforeRmsMm:1000*Math.sqrt(row.history[0].loss),afterRmsMm:1000*Math.sqrt(row.final.loss),boneP95:row.bones.map(b=>[b.name,b.before.forward.p95Mm,b.after.forward.p95Mm])}));
}
const probe=surfaceProbe(runtimeMap.get('HRAF0003').g,.002),geometries=new Map(),binary=[],records=[];let offset=0;
const tally=()=>({inside:0,outside:0,'surface-band':0,ambiguous:0,maximumOutsideMm:0});
const count=(r,c)=>{r[c.kind]++;if(c.kind==='outside')r.maximumOutsideMm=Math.max(r.maximumOutsideMm,c.distance*1000);};
for(const m of source.muscles){
  const side=m.fitGroup.split('-')[0],flow=flows.get(side);assert.ok(flow);const p=packing.parts.find(p=>p.id===m.id),g=finish(decoded(raw,p));assert.equal(referencedVertices(g,Infinity).length,p.vertexCount);
  const f=source.fits[m.fitGroup],legacyMatrix=new Matrix4().set(...f.rows[0].map(v=>v*f.scale),f.offset[0],...f.rows[1].map(v=>v*f.scale),f.offset[1],...f.rows[2].map(v=>v*f.scale),f.offset[2],0,0,0,1);
  const legacy=mapped(g,legacyMatrix,[]),initial=mapped(g,flow.initial,[]),after=mapped(g,flow.initial,flow.steps);
  const r={id:m.id,name:m.name,side,vertices:p.vertexCount,indexReferences:p.indexCount,legacy:tally(),initial:tally(),after:tally(),newLegacyOutside:0,worsenedLegacyOutside:0,newInitialOutside:0,worsenedInitialOutside:0,positionsSha256:hashArray(after.attributes.position.array),indicesSha256:hashArray(after.index.array)};
  for(let i=0;i<p.vertexCount;i++){
    const a=probe.classify(point.fromBufferAttribute(legacy.attributes.position,i)),b=probe.classify(point.fromBufferAttribute(initial.attributes.position,i)),c=probe.classify(point.fromBufferAttribute(after.attributes.position,i));count(r.legacy,a);count(r.initial,b);count(r.after,c);
    r.newLegacyOutside+=c.kind==='outside'&&a.kind!=='outside';r.newInitialOutside+=c.kind==='outside'&&b.kind!=='outside';
    r.worsenedLegacyOutside+=c.kind==='outside'&&a.kind==='outside'&&c.distance>a.distance+1e-6;r.worsenedInitialOutside+=c.kind==='outside'&&b.kind==='outside'&&c.distance>b.distance+1e-6;
  }
  r.jacobianSamples=select(Array.from({length:p.vertexCount},(_,i)=>i),128).map(i=>{const mapped=mapCompactDisplacements(point.fromBufferAttribute(g.attributes.position,i),flow.initial,flow.steps,true);assert.ok(mapped.determinant>0&&Number.isFinite(mapped.determinant));return {vertex:i,determinant:mapped.determinant,frobeniusNorm:Math.hypot(...mapped.jacobian.elements)};});
  const pos=bytesOf(after.attributes.position.array),idx=bytesOf(after.index.array);records.push({id:m.id,name:m.name,positions:offset,indices:offset+pos.length,vertexCount:p.vertexCount,indexCount:p.indexCount});offset+=pos.length+idx.length;binary.push(pos,idx);
  report.muscles.push(r);geometries.set(m.id,{side,raw:g,legacy,initial,after});console.log(JSON.stringify({id:m.id,outside:[r.legacy.outside,r.initial.outside,r.after.outside],new:r.newLegacyOutside}));
}
assert.equal(geometries.size,76);
const crosses=(a,b)=>a.boundingBox.intersectsBox(b.boundingBox)&&a.boundsTree.intersectsGeometry(b,new Matrix4());
let examinedPairs=0;
for(let i=0;i<runtime.length;i++)for(let j=i+1;j<runtime.length;j++){
  const a=runtime[i],b=runtime[j],ma=geometries.get(a.id),mb=geometries.get(b.id);if(!ma&&!mb)continue;examinedPairs++;
  const r={ids:[a.id,b.id],names:[a.name,b.name],layers:[a.layer,b.layer],bothChanged:Boolean(ma&&mb),sourceSameSide:ma&&mb&&ma.side===mb.side?crosses(ma.raw,mb.raw):null,current:crosses(a.g,b.g)};
  for(const state of ['legacy','initial','after'])r[state]=crosses(ma?.[state]||a.g,mb?.[state]||b.g);
  if(!r.current&&!r.legacy&&!r.initial&&!r.after&&!r.sourceSameSide)continue;
  if(r.after&&(!r.current||!r.initial)){r.interiorWitness=meshCrossingWitness(ma?.after||a.g,mb?.after||b.g);r.noInteriorWitness=!r.interiorWitness;}
  report.relations.push(r);
}
assert.equal(examinedPairs,76*1144+76*75/2);
report.summary={meshes:76,vertices:report.muscles.reduce((n,m)=>n+m.vertices,0),examinedPairs};
for(const state of ['legacy','initial','after']){report.summary[`${state}Outside`]=report.muscles.reduce((n,m)=>n+m[state].outside,0);report.summary[`${state}Ambiguous`]=report.muscles.reduce((n,m)=>n+m[state].ambiguous,0);}
for(const key of ['newLegacyOutside','worsenedLegacyOutside','newInitialOutside','worsenedInitialOutside'])report.summary[key]=report.muscles.reduce((n,m)=>n+m[key],0);
for(const state of ['current','legacy','initial','after'])report.summary[`${state}Pairs`]=report.relations.filter(r=>r[state]).length;
for(const state of ['current','legacy','initial'])report.summary[`newAgainst_${state}`]=report.relations.filter(r=>r.after&&!r[state]).length;
report.summary.newSameSideSourcePairs=report.relations.filter(r=>r.sourceSameSide===false&&r.after).length;
report.status='NOT APPROVED: inspect held-out skin, ligament, shape and whole-runtime relations; NO RUNTIME EXPORT';
const data=Buffer.concat(binary);assert.equal(data.length,offset);const zipped=gzipSync(data,{level:9});fs.writeFileSync(`${out}/candidate.bin.gz`,zipped);report.binary={path:`${out}/candidate.bin.gz`,bytes:data.length,gzipBytes:zipped.length,sha256:sha(zipped),records};
for(const p of ['scripts/fit-lower-body-bone-flow.mjs','scripts/lib/fit-compact-flow.mjs','scripts/lib/compact-displacement.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-witness.mjs','src/female-arm-registration.ts','src/female-foot-registration.ts','src/female-source-restoration.ts','src/female-knee-source-restoration.ts','src/female-brain-bindings.ts','data/catalog/female-arm-registration.json','data/catalog/female-foot-registration.json','data/catalog/female-brain-bindings.json','package-lock.json'])read(p);
report.files=[...files].map(([file,sha256])=>({file,sha256}));fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
probe.dispose();runtime.forEach(p=>p.g.dispose());for(const m of geometries.values())for(const k of ['raw','legacy','initial','after'])m[k].dispose();
