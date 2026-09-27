// Bone-only diagnostic. No deformation or muscle/atlas export is performed.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Matrix4,Vector3} from 'three';
import {lowerBodyPoseContext} from './lib/lower-body-pose-context.mjs';
import {areaSurfaceSamples} from './lib/area-surface-samples.mjs';
import {fitFixedPivot} from './lib/fixed-pivot-fit.mjs';
import {referencedVertices} from './lib/surface-containment.mjs';
const ctx=lowerBodyPoseContext(process.argv[2]),{read,sha,finish}=ctx,out='.cache/hip-cartilage-pivots';
fs.mkdirSync(out,{recursive:true});
const cartilage=JSON.parse(read(`${out}/report.json`)),lumbar=JSON.parse(read('docs/anatomy-alignment/lumbar-source-frames.json'));
const root=new Matrix4().fromArray(lumbar.psoasCandidates.find(p=>p.mode==='rigid').sourceToAtlasMatrix);
const bones=ctx.bones.map(b=>({...b,placed:finish(b.raw.clone().applyMatrix4(root)),training:['Femur','Tibia','Fibula'].includes(b.name)}));
for(const b of bones.filter(b=>b.training)){
  b.sourceSampling=areaSurfaceSamples(b.placed,512);b.targetSampling=areaSurfaceSamples(b.target,512);
  b.sourcePoints=b.sourceSampling.samples.map(s=>new Vector3(...s.point));b.targetPoints=b.targetSampling.samples.map(s=>new Vector3(...s.point));
}
const stats=a=>{a.sort((a,b)=>a-b);return {count:a.length,rmsMm:1000*Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length),p95Mm:1000*a[Math.floor(a.length*.95)],maximumMm:1000*a.at(-1)};};
const point=new Vector3(),distance=(a,b)=>stats(referencedVertices(a,Infinity).map(i=>b.boundsTree.closestPointToPoint(point.fromBufferAttribute(a.attributes.position,i)).distance));
const baseline=bones.map(b=>({side:b.side,name:b.name,training:b.training,targetIds:b.targetIds,sourceVertices:b.placed.attributes.position.count,targetVertices:b.target.attributes.position.count,forward:distance(b.placed,b.target),reverse:distance(b.target,b.placed)}));
const options={samplesPerBoneDirection:512,retainedPerBoneDirection:409,iterationLimit:200,maximumSampleChangeMetres:1e-8},candidates=[];
for(const side of ['left','right'])for(const pivotName of ['FemurHead','PelvisAcetabulum']){
  const entry=cartilage.parts.find(p=>p.side===side&&p.name===pivotName),pivot=new Vector3(...entry.fit.centre).applyMatrix4(root),training=bones.filter(b=>b.side===side&&b.training);
  let matrix=new Matrix4(),termination='iteration-limit';const history=[];
  for(let iteration=0;iteration<options.iterationLimit;iteration++){
    const inverse=matrix.clone().invert(),from=[],onto=[];
    for(const b of training){
      const forward=b.sourcePoints.map(source=>{const hit=b.target.boundsTree.closestPointToPoint(source.clone().applyMatrix4(matrix));return {source,target:hit.point.clone(),distance:hit.distance};});
      const reverse=b.targetPoints.map(target=>{const hit=b.placed.boundsTree.closestPointToPoint(target.clone().applyMatrix4(inverse));return {source:hit.point.clone(),target,distance:hit.distance};});
      for(const matches of [forward,reverse])for(const m of matches.sort((a,b)=>a.distance-b.distance).slice(0,options.retainedPerBoneDirection)){from.push(m.source);onto.push(m.target);}
    }
    const next=fitFixedPivot(from,onto,pivot);let change=0;
    for(const b of training)for(const p of b.sourcePoints)change=Math.max(change,p.clone().applyMatrix4(next).distanceTo(p.clone().applyMatrix4(matrix)));
    matrix=next;history.push({iteration,maximumSampleChangeMm:1000*change,correspondences:from.length});
    if(iteration%40===0)console.log(JSON.stringify({side,pivotName,...history.at(-1)}));
    if(change<options.maximumSampleChangeMetres){termination='maximum-sample-change-threshold';break;}
  }
  const evaluated=[];
  for(const b of bones.filter(b=>b.side===side)){
    // The pelvic root stays fixed. Patella is transported but never fit.
    const g=finish(b.placed.clone().applyMatrix4(b.name==='Pelvis'?new Matrix4():matrix));
    evaluated.push({name:b.name,training:b.training,transformed:b.name!=='Pelvis',forward:distance(g,b.target),reverse:distance(b.target,g)});g.dispose();
  }
  const e=matrix.elements,angleDegrees=Math.acos(Math.max(-1,Math.min(1,(e[0]+e[5]+e[10]-1)/2)))*180/Math.PI;
  const row={side,pivotName,sourcePivot:entry.fit.centre,pivot:pivot.toArray(),matrix:matrix.toArray(),determinant:matrix.determinant(),pivotMotionMm:1000*pivot.clone().applyMatrix4(matrix).distanceTo(pivot),angleDegrees,termination,history,bones:evaluated};
  assert.ok(Math.abs(row.determinant-1)<1e-10);assert.ok(row.pivotMotionMm<1e-8);candidates.push(row);console.log(JSON.stringify({side,pivotName,angleDegrees,termination,bones:evaluated}));
}
const sensitivity=['left','right'].map(side=>{
  const [a,b]=candidates.filter(c=>c.side===side),ma=new Matrix4().fromArray(a.matrix),mb=new Matrix4().fromArray(b.matrix),distances=[];
  for(const bone of bones.filter(b=>b.side===side&&b.name!=='Pelvis'))for(const i of referencedVertices(bone.placed,Infinity)){
    const p=new Vector3().fromBufferAttribute(bone.placed.attributes.position,i);distances.push(p.clone().applyMatrix4(ma).distanceTo(p.clone().applyMatrix4(mb)));
  }
  return {side,...stats(distances)};
});
for(const file of ['scripts/fit-hip-pivot-legs.mjs','scripts/lib/fixed-pivot-fit.mjs','scripts/lib/rigid-fit.mjs','scripts/lib/similarity-fit.mjs','scripts/lib/area-surface-samples.mjs','scripts/lib/surface-containment.mjs'])read(file);
fs.writeFileSync(`${out}/legs.json`,JSON.stringify({createdAt:new Date().toISOString(),status:'FIXED-PIVOT BONE DIAGNOSTIC ONLY; NO RUNTIME EXPORT',root:root.toArray(),rootScale:Math.cbrt(root.determinant()),cartilageReportSha256:sha(read(`${out}/report.json`)),options,baseline,candidates,sensitivity,sampling:bones.filter(b=>b.training).map(b=>({side:b.side,name:b.name,source:b.sourceSampling,target:b.targetSampling})),limitations:[
  'Lumbar root is fixed and includes inverse approximate BoneHub-to-Denver similarity. Its label rigid does not make the composed source-to-atlas matrix unit scale.',
  'Each leg uses one proper rotation around a source cartilage sphere estimate. No HRA hip landmark correspondence is available. These are not verified anatomical joint centres.',
  'Femur, Tibia and Fibula train together. Patella is transported but held out. Pelvis remains at the root and is not fit. Knees do not articulate separately.',
  'Nearest-surface trimmed ICP may reach a local stationary point. Failure here does not rule out every articulated registration.',
  'No muscle deformation is constructed; skin, organs, vessels, nerves and tissue crossings are not evaluated by this bone-only experiment. No release or clinical validation is claimed.'
],files:[...ctx.files].map(([file,sha256])=>({file,sha256}))},null,2)+'\n');
console.log(JSON.stringify({sensitivity}));
