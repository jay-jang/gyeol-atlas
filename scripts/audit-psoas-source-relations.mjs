// Separate same-file-frame source relationships from approximate cross-source
// lumbar relationships and fixed HRA targets. Nothing is exported to runtime.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {lowerBodyPoseContext} from './lib/lower-body-pose-context.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
import {closestSurfacePair} from './lib/closest-surface-pair.mjs';
const ctx=lowerBodyPoseContext(process.argv[2]),{read,sha,finish}=ctx,json=p=>JSON.parse(read(p)),out='.cache/psoas-source-relations';fs.mkdirSync(out,{recursive:true});
const priorFile='docs/anatomy-alignment/lumbar-source-frames.json',prior=json(priorFile),packed=JSON.parse(gunzipSync(read(prior.partsFile))),identity=new Matrix4();
assert.equal(sha(read(prior.partsFile)),prior.files.find(f=>f.file===prior.partsFile).sha256);
const geometry=p=>{const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(p.positions),3));g.setIndex(new BufferAttribute(new Uint32Array(p.indices),1));return finish(g);};
const psoas=ctx.muscles.filter(m=>['VHF0034','VHF0072'].includes(m.id)),changed=new Set(psoas.map(m=>m.id));
const candidates=prior.psoasCandidates.map(c=>{const zip=read(c.binary.path);assert.equal(sha(zip),c.binary.sha256);const bytes=gunzipSync(zip);return {...c,geometries:new Map(c.binary.records.map(p=>[p.id,geometry({positions:Array.from({length:p.vertexCount*3},(_,i)=>bytes.readFloatLE(p.positions+4*i)),indices:Array.from({length:p.indexCount},(_,i)=>bytes.readUInt32LE(p.indices+4*i))})]))};});
const crosses=(a,b)=>a.boundingBox.intersectsBox(b.boundingBox)&&a.boundsTree.intersectsGeometry(b,identity);
function relation(a,b){const crossing=crosses(a,b),witness=crossing?meshCrossingWitness(a,b):null;return {crossing,witness,...closestSurfacePair(a,b)};}
const report={createdAt:new Date().toISOString(),status:'SOURCE RELATION DIAGNOSTIC ONLY; NO RUNTIME EXPORT',priorFile,priorSha256:sha(read(priorFile)),sourceMuscleRelations:[],sourceBoneRelations:[],approximateLumbarRelations:[],hraLumbarRelations:[],newCandidateAttribution:[],limitations:[
  'Denver muscle/bone records share the source frame. BoneHub lumbar comparisons require an approximate inter-source frame; they are not exact original muscle-spine observations.',
  'A source crossing does not establish normal anatomy, and a new crossing alone does not establish abnormal attachment. Triangle witnesses establish finite surface intersections only.',
  'Bone closest-surface points are geometric extrema, not anatomical attachment landmarks or insertion distances.',
  'Pelvis/Femur source surfaces are whole bones while HRA targets combine hierarchy parts; attribution is at whole-bone scope, not one-to-one subpart identity.',
  'No source ureter, vein or intervertebral disk is present here; those new relationships remain unclassified against source anatomy.'
]};
// Every pair involving either psoas in the76 same-frame full-resolution muscles.
let musclePairs=0;
for(let i=0;i<ctx.muscles.length;i++)for(let j=i+1;j<ctx.muscles.length;j++){
  const a=ctx.muscles[i],b=ctx.muscles[j];if(!changed.has(a.id)&&!changed.has(b.id))continue;musclePairs++;
  const source=crosses(a.raw,b.raw),states=candidates.map(c=>({mode:c.mode,previous:c.relations.find(r=>r.ids.includes(a.id)&&r.ids.includes(b.id))}));
  if(!source&&!states.some(s=>s.previous))continue;
  report.sourceMuscleRelations.push({ids:[a.id,b.id],names:[a.name,b.name],source:relation(a.raw,b.raw),states:states.map(s=>({mode:s.mode,current:!!s.previous?.current,legacy:!!s.previous?.legacy,after:!!s.previous?.after}))});
}
assert.equal(musclePairs,149);report.examinedSourceMusclePairs=musclePairs;
console.log('Compared all149 same-frame source muscle pairs.');
for(const b of ctx.bones.filter(b=>['Pelvis','Femur'].includes(b.name)))for(const m of psoas){
  const row={side:b.side,bone:b.name,muscleId:m.id,muscleSide:m.side,targetIds:b.targetIds,source:relation(m.raw,b.raw),current:relation(ctx.runtimeMap.get(m.id).g,b.target),candidates:[]};
  for(const c of candidates)row.candidates.push({mode:c.mode,relation:relation(c.geometries.get(m.id),b.target)});report.sourceBoneRelations.push(row);console.log(`Compared ${b.side} ${b.name} / ${m.id}.`);
}
for(const p of prior.parts){
  const source=geometry(packed.find(q=>q.id===p.name)),official=geometry(packed.find(q=>q.id===p.id));
  for(const stage of ['final','original']){const mapped=finish(source.clone().applyMatrix4(new Matrix4().fromArray(prior.denverMatrices[stage])));for(const m of psoas)report.approximateLumbarRelations.push({level:p.name,id:p.id,muscleId:m.id,stage,relation:relation(m.raw,mapped)});mapped.dispose();}
  for(const m of psoas){const row={level:p.name,id:p.id,muscleId:m.id,currentRuntime:relation(ctx.runtimeMap.get(m.id).g,ctx.runtimeMap.get(p.id).g),currentOfficial:relation(ctx.runtimeMap.get(m.id).g,official),candidates:[]};for(const c of candidates)row.candidates.push({mode:c.mode,runtime:relation(c.geometries.get(m.id),ctx.runtimeMap.get(p.id).g),official:relation(c.geometries.get(m.id),official)});report.hraLumbarRelations.push(row);}
  source.dispose();official.dispose();console.log(`Compared ${p.name} source/HRA relationships.`);
}
for(const c of candidates){const added=c.relations.filter(p=>p.after&&!p.legacy),rows=[];
  for(const pair of added){const muscleId=pair.ids.find(id=>changed.has(id)),targetId=pair.ids.find(id=>id!==muscleId),lumbar=report.approximateLumbarRelations.filter(p=>p.id===targetId&&p.muscleId===muscleId),bone=report.sourceBoneRelations.find(p=>p.muscleId===muscleId&&p.targetIds.includes(targetId)),muscle=report.sourceMuscleRelations.find(p=>p.ids.includes(muscleId)&&p.ids.includes(targetId));
    rows.push({ids:pair.ids,names:pair.names,sourceKind:lumbar.length?'approximate-cross-source-lumbar':bone?'same-frame-whole-bone':muscle?'same-frame-muscle':'unavailable',sourceCrossing:lumbar.length?Object.fromEntries(lumbar.map(p=>[p.stage,p.relation.crossing])):bone?bone.source.crossing:muscle?muscle.source.crossing:null,sourceWitness:lumbar.length?Object.fromEntries(lumbar.map(p=>[p.stage,!!p.relation.witness])):bone?!!bone.source.witness:muscle?!!muscle.source.witness:null});
  }report.newCandidateAttribution.push({mode:c.mode,pairs:rows});
}
report.summary={examinedSourceMusclePairs:musclePairs,sourceMuscleCrossings:report.sourceMuscleRelations.filter(p=>p.source.crossing).length,exactSourceBonePairs:report.sourceBoneRelations.length,exactSourceBoneCrossings:report.sourceBoneRelations.filter(p=>p.source.crossing).length,approximateLumbarPairs:report.approximateLumbarRelations.length,approximateLumbarCrossings:report.approximateLumbarRelations.filter(p=>p.relation.crossing).length,hraLumbarPairs:report.hraLumbarRelations.length};
for(const file of ['scripts/audit-psoas-source-relations.mjs','scripts/lib/triangle-witness.mjs','scripts/lib/closest-surface-pair.mjs'])read(file);report.files=[...ctx.files].map(([file,sha256])=>({file,sha256}));fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
