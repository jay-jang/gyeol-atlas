// One proper affine frame for all76 source muscles, not separate left/right
// or psoas-only placement. HRA targets remain unchanged; candidate output only.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {lowerBodyPoseContext} from './lib/lower-body-pose-context.mjs';
import {fitRigid} from './lib/rigid-fit.mjs';
import {fitSimilarity} from './lib/similarity-fit.mjs';
import {referencedVertices,surfaceProbe} from './lib/surface-containment.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
import {areaSurfaceSamples} from './lib/area-surface-samples.mjs';
const ctx=lowerBodyPoseContext(process.argv[2]),{read,sha,finish,runtime,runtimeMap}=ctx,json=p=>JSON.parse(read(p)),out='.cache/shared-lumbar-leg-frame';fs.mkdirSync(out,{recursive:true});
const lumbar=json('docs/anatomy-alignment/lumbar-source-frames.json'),packedBytes=read(lumbar.partsFile);assert.equal(sha(packedBytes),lumbar.files.find(f=>f.file===lumbar.partsFile).sha256);const packed=JSON.parse(gunzipSync(packedBytes));
const geometry=p=>{const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(p.positions),3));g.setIndex(new BufferAttribute(new Uint32Array(p.indices),1));return g;},point=new Vector3(),identity=new Matrix4();
const pairs=ctx.bones.map(b=>({name:`${b.side}-${b.name}`,kind:'same-frame-denver',targetIds:b.targetIds,source:b.raw,target:b.target,training:true}));
for(const p of lumbar.parts)pairs.push({name:p.name,kind:'approximate-bonehub-to-denver',targetIds:[p.id],source:finish(geometry(packed.find(q=>q.id===p.name)).applyMatrix4(new Matrix4().fromArray(lumbar.denverMatrices.final))),target:finish(geometry(packed.find(q=>q.id===p.id))),training:p.training});
assert.equal(pairs.length,16);const training=pairs.filter(p=>p.training);assert.equal(training.length,14);
for(const p of training){p.sourceSampling=areaSurfaceSamples(p.source,512);p.targetSampling=areaSurfaceSamples(p.target,512);p.sourceSample=p.sourceSampling.samples.map(s=>new Vector3(...s.point));p.targetSample=p.targetSampling.samples.map(s=>new Vector3(...s.point));}
const options={samplesPerBoneDirection:512,retainedPerBoneDirection:409,iterations:160,maximumSampleChangeMetres:1e-8},frames=[];
for(const mode of ['rigid','similarity']){
  const fit=mode==='rigid'?fitRigid:fitSimilarity,centres=side=>training.map(p=>p[side].boundingBox.getCenter(new Vector3()));let matrix=fit(centres('source'),centres('target')),termination='iteration-limit';const initial=matrix.toArray(),history=[];
  for(let iteration=0;iteration<options.iterations;iteration++){
    const inverse=matrix.clone().invert(),from=[],onto=[];
    for(const p of training){
      const forward=p.sourceSample.map(source=>{const hit=p.target.boundsTree.closestPointToPoint(source.clone().applyMatrix4(matrix));return {source,target:hit.point.clone(),distance:hit.distance};});
      const reverse=p.targetSample.map(target=>{const hit=p.source.boundsTree.closestPointToPoint(target.clone().applyMatrix4(inverse));return {source:hit.point.clone(),target,distance:hit.point.clone().applyMatrix4(matrix).distanceTo(target)};});
      for(const matches of [forward,reverse])for(const p of matches.sort((a,b)=>a.distance-b.distance).slice(0,options.retainedPerBoneDirection)){from.push(p.source);onto.push(p.target);}
    }
    const next=fit(from,onto);let change=0;for(const p of training)for(const v of p.sourceSample)change=Math.max(change,v.clone().applyMatrix4(matrix).distanceTo(v.clone().applyMatrix4(next)));matrix=next;history.push({iteration,maximumSampleChangeMm:change*1000,scale:Math.cbrt(matrix.determinant()),correspondences:from.length});
    if(iteration%20===0)console.log(JSON.stringify({mode,...history.at(-1)}));if(change<options.maximumSampleChangeMetres){termination='maximum-sample-change-threshold';break;}
  }
  frames.push({mode,matrix,initial,history,termination});
}
const stats=a=>{a.sort((a,b)=>a-b);return {count:a.length,rmsMm:Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length)*1000,p95Mm:a[Math.floor(a.length*.95)]*1000,maximumMm:a.at(-1)*1000};};
const distance=(g,target)=>stats(referencedVertices(g,Infinity).map(i=>target.boundsTree.closestPointToPoint(point.fromBufferAttribute(g.attributes.position,i)).distance));
const report={createdAt:new Date().toISOString(),status:'SHARED FRAME CANDIDATES ONLY; NO RUNTIME EXPORT',options,training:training.map(p=>p.name),heldOut:pairs.filter(p=>!p.training).map(p=>p.name),lumbarSourceFrame:lumbar.denverMatrices.final,sourceBones:pairs.map(p=>({name:p.name,kind:p.kind,targetIds:p.targetIds,training:p.training,sourceVertices:p.source.attributes.position.count,sourceIndices:p.source.index.count,targetVertices:p.target.attributes.position.count})),legacyMuscles:[],candidates:[],limitations:[
  'One common proper rigid/similarity maps all76 Denver muscles on both sides and all diagnostic source bones. It is not a nonrigid anatomical registration.',
  'Six BoneHub lumbar surfaces first use an approximate BoneHub-to-Denver frame, with residual source disagreement. Other ten source bones share Denver coordinates.',
  'L2-L5 and ten bilateral lower-limb bones train. L1/L6 remain excluded from initialization and optimization; muscles, skin and other organs/vessels/nerves are not fit targets.',
  'Deterministic triangle-area-stratified samples count exact duplicate triangles once; they do not union partially overlapping or internal surfaces. Trimming alters that distribution. Samples are not clinical landmarks; numeric stopping is not global optimality.',
  'Common exact affine maps preserve source relationships mathematically, but serialized Float32 triangles are checked separately. Source relationships themselves are not certified normal anatomy.',
  'All actual HRA anatomy is fixed. Source bones are diagnostic and are never substituted into the atlas.'
]};
report.sampling=training.map(p=>({name:p.name,source:p.sourceSampling,target:p.targetSampling}));
const changed=new Set(ctx.muscles.map(m=>m.id)),probe=surfaceProbe(runtimeMap.get('HRAF0003').g,.002),tally=()=>({inside:0,outside:0,'surface-band':0,ambiguous:0,maximumOutsideMm:0}),count=(r,c)=>{r[c.kind]++;if(c.kind==='outside')r.maximumOutsideMm=Math.max(r.maximumOutsideMm,c.distance*1000);};
const legacy=new Map(),legacyClassifications=new Map();
for(const m of ctx.muscles){const f=ctx.source.fits[m.fitGroup],matrix=new Matrix4().set(...f.rows[0].map(v=>v*f.scale),f.offset[0],...f.rows[1].map(v=>v*f.scale),f.offset[1],...f.rows[2].map(v=>v*f.scale),f.offset[2],0,0,0,1),g=finish(m.raw.clone().applyMatrix4(matrix)),row={id:m.id,side:m.side,fitGroup:m.fitGroup,matrix:matrix.toArray(),vertices:m.record.vertexCount,skin:tally()},classes=[];for(let i=0;i<m.record.vertexCount;i++){const c=probe.classify(point.fromBufferAttribute(g.attributes.position,i));count(row.skin,c);classes.push(c);}legacy.set(m.id,g);legacyClassifications.set(m.id,classes);report.legacyMuscles.push(row);}
console.log(JSON.stringify({legacyOutside:report.legacyMuscles.reduce((s,m)=>s+m.skin.outside,0)}));
const crosses=(a,b)=>a.boundingBox.intersectsBox(b.boundingBox)&&a.boundsTree.intersectsGeometry(b,identity),sourceMuscleMap=new Map(ctx.muscles.map(m=>[m.id,m]));
const baselineRelations=[];for(let i=0;i<runtime.length;i++)for(let j=i+1;j<runtime.length;j++){const a=runtime[i],b=runtime[j];if(!changed.has(a.id)&&!changed.has(b.id))continue;baselineRelations.push({ids:[a.id,b.id],names:[a.name,b.name],layers:[a.layer,b.layer],current:crosses(a.g,b.g),legacy:crosses(legacy.get(a.id)||a.g,legacy.get(b.id)||b.g),sourceInternal:changed.has(a.id)&&changed.has(b.id)?crosses(sourceMuscleMap.get(a.id).raw,sourceMuscleMap.get(b.id).raw):null});}assert.equal(baselineRelations.length,89794);
const sourceBoneRelations=[];for(const b of pairs)for(const m of ctx.muscles)sourceBoneRelations.push({bone:b.name,muscleId:m.id,source:crosses(m.raw,b.source)});assert.equal(sourceBoneRelations.length,1216);
for(const f of frames){
  const row={mode:f.mode,matrix:f.matrix.toArray(),initialMatrix:f.initial,scale:Math.cbrt(f.matrix.determinant()),fit:{history:f.history,termination:f.termination},bones:[],muscles:[],relations:[],sourceBoneRelations:[]},placedBones=new Map(),placed=new Map(),buffers=[],records=[];let offset=0;
  for(const p of pairs){const g=finish(p.source.clone().applyMatrix4(f.matrix));placedBones.set(p.name,g);row.bones.push({name:p.name,training:p.training,forward:distance(g,p.target),reverse:distance(p.target,g)});}
  for(const m of ctx.muscles){const g=finish(m.raw.clone().applyMatrix4(f.matrix)),r={id:m.id,name:m.name,side:m.side,vertices:m.record.vertexCount,indexReferences:m.record.indexCount,skin:tally(),newOutside:0,worsenedOutside:0};placed.set(m.id,g);for(let i=0;i<m.record.vertexCount;i++){const before=legacyClassifications.get(m.id)[i],after=probe.classify(point.fromBufferAttribute(g.attributes.position,i));count(r.skin,after);r.newOutside+=after.kind==='outside'&&before.kind!=='outside';r.worsenedOutside+=after.kind==='outside'&&before.kind==='outside'&&after.distance>before.distance+1e-6;}
    const positions=Buffer.from(g.attributes.position.array.buffer),indices=Buffer.from(g.index.array.buffer);r.positionsSha256=sha(positions);r.indicesSha256=sha(indices);records.push({id:m.id,positions:offset,indices:offset+positions.length,vertexCount:g.attributes.position.count,indexCount:g.index.count});offset+=positions.length+indices.length;buffers.push(positions,indices);row.muscles.push(r);console.log(JSON.stringify({mode:f.mode,id:m.id,outside:r.skin.outside,newOutside:r.newOutside}));}
  for(const baseline of baselineRelations){const [a,b]=baseline.ids,ga=placed.get(a)||runtimeMap.get(a).g,gb=placed.get(b)||runtimeMap.get(b).g,after=crosses(ga,gb);if(!after&&!baseline.current&&!baseline.legacy&&!baseline.sourceInternal)continue;const p={...baseline,after};if(after&&!baseline.legacy)p.interiorWitness=meshCrossingWitness(ga,gb);row.relations.push(p);}
  for(const p of sourceBoneRelations){const ga=placed.get(p.muscleId),gb=placedBones.get(p.bone),after=crosses(ga,gb),r={...p,after};if(after&&!p.source)r.interiorWitness=meshCrossingWitness(ga,gb);row.sourceBoneRelations.push(r);}
  const compressed=gzipSync(Buffer.concat(buffers),{level:9});fs.writeFileSync(`${out}/${f.mode}.bin.gz`,compressed);row.binary={path:`${out}/${f.mode}.bin.gz`,sha256:sha(compressed),gzipBytes:compressed.length,bytes:offset,records};
  row.summary={meshes:76,vertices:row.muscles.reduce((s,m)=>s+m.vertices,0),examinedPairs:baselineRelations.length,legacyOutside:report.legacyMuscles.reduce((s,m)=>s+m.skin.outside,0),afterOutside:row.muscles.reduce((s,m)=>s+m.skin.outside,0),legacyAmbiguous:report.legacyMuscles.reduce((s,m)=>s+m.skin.ambiguous,0),afterAmbiguous:row.muscles.reduce((s,m)=>s+m.skin.ambiguous,0),newOutside:row.muscles.reduce((s,m)=>s+m.newOutside,0),worsenedOutside:row.muscles.reduce((s,m)=>s+m.worsenedOutside,0)};
  for(const state of ['current','legacy','after'])row.summary[`${state}Pairs`]=row.relations.filter(p=>p[state]).length;for(const state of ['current','legacy'])row.summary[`newAgainst_${state}`]=row.relations.filter(p=>p.after&&!p[state]).length;
  row.summary.sourceInternalPairs=baselineRelations.filter(p=>p.sourceInternal).length;row.summary.afterInternalPairs=row.relations.filter(p=>p.sourceInternal!==null&&p.after).length;row.summary.newInternalPairs=row.relations.filter(p=>p.sourceInternal===false&&p.after).length;row.summary.removedInternalPairs=row.relations.filter(p=>p.sourceInternal&&!p.after).length;row.summary.sourceBonePairs=sourceBoneRelations.filter(p=>p.source).length;row.summary.mappedSourceBonePairs=row.sourceBoneRelations.filter(p=>p.after).length;row.summary.newSourceBonePairs=row.sourceBoneRelations.filter(p=>p.after&&!p.source).length;row.summary.removedSourceBonePairs=row.sourceBoneRelations.filter(p=>p.source&&!p.after).length;
  report.candidates.push(row);console.log(JSON.stringify({mode:f.mode,...row.summary}));for(const g of placed.values())g.dispose();for(const g of placedBones.values())g.dispose();
}
for(const file of ['scripts/fit-shared-lumbar-leg-frame.mjs','scripts/lib/area-surface-samples.mjs','scripts/lib/rigid-fit.mjs','scripts/lib/similarity-fit.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-witness.mjs'])read(file);report.files=[...ctx.files].map(([file,sha256])=>({file,sha256}));fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');probe.dispose();
