// Rigid post-placement experiment: no independent muscle deformation, no
// universal "all nerves/vessels must be outside muscles" objective.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {Box3,Matrix4,Vector3} from 'three';
import {lowerBodyPoseContext} from './lib/lower-body-pose-context.mjs';
import {rigidPose,searchRigidPose} from './lib/bounded-rigid-pose.mjs';
import {referencedVertices,surfaceProbe,surfaceTopology} from './lib/surface-containment.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
const root=process.argv[2];assert.ok(root);assert.equal(process.argv.length,3);
const out='.cache/lower-body-relational-pose';fs.mkdirSync(out,{recursive:true});
const ctx=lowerBodyPoseContext(root),{runtime,runtimeMap,muscles,bones,finish,sha}=ctx,point=new Vector3(),identity=new Matrix4();
const options={iterations:80,translationBound:.02,rotationBound:5*Math.PI/180,translationStep:.002,rotationStep:.01,halvings:4,boneSamples:200,muscleSamples:64,relationSamples:256,bandMetres:.002,weights:{bone:1,skin:4,relation:20}};
const report={createdAt:new Date().toISOString(),status:'EXPERIMENTAL INITIAL POSE; NO RUNTIME EXPORT',options,sides:[],muscles:[],relations:[],sourceBoneRelations:[],limitations:[
  'One proper rigid adjustment per side is composed after the previous source-to-atlas similarity. Neither muscle-specific shape distortion nor a new scale is fitted.',
  'The exclusion term is limited to each psoas major with its same-side ureter and common iliac vein. It is a numerical hypothesis, not a clinical zero-overlap rule or proof these fixed HRA targets are correct.',
  'Neural and vascular passage through muscles can be normal; other tissues are held out, not subjected to a universal exclusion objective.',
  'Closed edge topology does not prove absence of self-intersection or anatomical validity. Three-ray disagreement makes a tested objective inadmissible rather than silently inside/outside.',
  'Controls are deterministic vertex samples, not area-weighted anatomical landmarks. Only one initial pose per side is searched within20mm/5degree bounds.',
  'The objective uses rigidly transformed continuous initial Float32 triangle surfaces; final stored Float32 meshes and all full-body relations are checked separately.',
  'A lower weighted objective does not approve skin containment, attachments, anatomy, opposite-side continuity or nerve courses.'
],sourceContext:[{url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC8867435/',reason:'Direct cadaver study of complex and variable psoas neurovascular relations; prevents universal muscle-exclusion claims.'},{url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC13238165/',reason:'Cadaveric atlas describes the medial psoas plane and adjacent iliac vessels/ureter; no patient-specific clearance threshold is inferred.'}]};
const skin=runtimeMap.get('HRAF0003').g,skinProbe=surfaceProbe(skin,options.bandMetres);
for(const m of muscles){m.topology=surfaceTopology(m.raw);assert.equal(m.topology.boundaryEdges,0);assert.equal(m.topology.nonManifoldEdges,0);assert.equal(m.topology.degenerateTriangles,0);assert.equal(m.topology.connectedComponents,1);}
for(const side of ['left','right']){
  const own=muscles.filter(m=>m.side===side),ownBones=bones.filter(b=>b.side===side),bounds=new Box3();ownBones.forEach(b=>bounds.union(b.initial.boundingBox));const pivot=bounds.getCenter(new Vector3());
  const boneControls=ownBones.map(b=>({bone:b,indices:referencedVertices(b.initial,options.boneSamples)}));
  const skinControls=own.flatMap(m=>referencedVertices(m.initial,options.muscleSamples).map(vertex=>({id:m.id,vertex,point:new Vector3().fromBufferAttribute(m.initial.attributes.position,vertex)})));
  const psoas=own.find(m=>m.id===(side==='left'?'VHF0034':'VHF0072'));assert.ok(psoas);
  const probe=surfaceProbe(psoas.initial,options.bandMetres),ids=side==='left'?['HRAF0608','HRAF0653']:['HRAF0592','HRAF0654'];
  const relationControls=ids.map(id=>{const g=runtimeMap.get(id).g,indices=referencedVertices(g,options.relationSamples);return {id,indices,points:indices.map(i=>new Vector3().fromBufferAttribute(g.attributes.position,i))};});
  let invalidEvaluations=0;
  function evaluate(parameters){
    const matrix=rigidPose(parameters,pivot),inverse=matrix.clone().invert();let boneSum=0,skinSum=0,relationSum=0,skinOutside=0,insidePoints=0,ambiguous=0;
    for(const c of boneControls)for(const i of c.indices){const p=point.fromBufferAttribute(c.bone.initial.attributes.position,i).applyMatrix4(matrix);boneSum+=c.bone.target.boundsTree.closestPointToPoint(p).distance**2/c.indices.length/boneControls.length;}
    for(const c of skinControls){const result=skinProbe.classify(point.copy(c.point).applyMatrix4(matrix));ambiguous+=result.kind==='ambiguous';if(result.kind==='outside'){skinOutside++;skinSum+=(result.distance-options.bandMetres)**2/skinControls.length;}}
    for(const c of relationControls)for(const p of c.points){const q=point.copy(p).applyMatrix4(inverse);if(!psoas.initial.boundingBox.containsPoint(q))continue;const result=probe.classify(q);ambiguous+=result.kind==='ambiguous';if(result.kind==='inside'){insidePoints++;relationSum+=(result.distance-options.bandMetres)**2/c.points.length/relationControls.length;}}
    if(ambiguous)invalidEvaluations++;
    return {loss:ambiguous?Infinity:options.weights.bone*boneSum+options.weights.skin*skinSum+options.weights.relation*relationSum,boneMeanSquaredMetres:boneSum,skinOutsideMeanSquaredMetres:skinSum,relationInsideMeanSquaredMetres:relationSum,skinOutside,insidePoints,ambiguous};
  }
  const fit=searchRigidPose(evaluate,options,r=>console.log(JSON.stringify({side,...r}))),matrix=rigidPose(fit.parameters,pivot);
  const row={side,pivot:pivot.toArray(),initialMatrix:ctx.initialMatrices.get(side).toArray(),adjustmentMatrix:matrix.toArray(),fit,invalidEvaluations,boneControls:boneControls.map(c=>({name:c.bone.name,indices:c.indices})),skinControls:skinControls.map(({id,vertex})=>({id,vertex})),relationControls:relationControls.map(c=>({muscleId:psoas.id,id:c.id,indices:c.indices})),bones:[],relationFullVertices:[]};
  for(const m of own)m.after=finish(m.initial.clone().applyMatrix4(matrix));
  for(const b of ownBones){b.after=finish(b.initial.clone().applyMatrix4(matrix));const distances=(g,target)=>{const d=referencedVertices(g,Infinity).map(i=>target.boundsTree.closestPointToPoint(point.fromBufferAttribute(g.attributes.position,i)).distance*1000).sort((a,b)=>a-b);return {vertices:d.length,p95Mm:d[Math.floor(d.length*.95)],maximumMm:d.at(-1)};};row.bones.push({name:b.name,targetIds:b.targetIds,initial:{forward:distances(b.initial,b.target),reverse:distances(b.target,b.initial)},after:{forward:distances(b.after,b.target),reverse:distances(b.target,b.after)}});}
  const afterProbe=surfaceProbe(psoas.after,options.bandMetres);
  for(const id of ids){const g=runtimeMap.get(id).g,r={id,muscleId:psoas.id,vertices:0,initialInside:0,afterInside:0,initialAmbiguous:0,afterAmbiguous:0,initialMaximumInsideMm:0,afterMaximumInsideMm:0};for(const i of referencedVertices(g,Infinity)){r.vertices++;for(const [state,classifier] of [['initial',probe],['after',afterProbe]]){const c=classifier.classify(point.fromBufferAttribute(g.attributes.position,i));r[`${state}Inside`]+=c.kind==='inside';r[`${state}Ambiguous`]+=c.kind==='ambiguous';if(c.kind==='inside')r[`${state}MaximumInsideMm`]=Math.max(r[`${state}MaximumInsideMm`],c.distance*1000);}}row.relationFullVertices.push(r);}
  probe.dispose();afterProbe.dispose();report.sides.push(row);fs.writeFileSync(`${out}/fit.partial.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({side,fit:fit.final,parameters:fit.parameters,relations:row.relationFullVertices}));
}
const tally=()=>({inside:0,outside:0,'surface-band':0,ambiguous:0,maximumOutsideMm:0}),count=(r,c)=>{r[c.kind]++;if(c.kind==='outside')r.maximumOutsideMm=Math.max(r.maximumOutsideMm,c.distance*1000);};
const buffers=[],records=[];let offset=0;
for(const m of muscles){
  const r={id:m.id,name:m.name,side:m.side,vertices:m.record.vertexCount,indexReferences:m.record.indexCount,sourceTopology:m.topology,initial:tally(),after:tally(),newOutside:0,worsenedOutside:0};
  for(let i=0;i<m.record.vertexCount;i++){const a=skinProbe.classify(point.fromBufferAttribute(m.initial.attributes.position,i)),b=skinProbe.classify(point.fromBufferAttribute(m.after.attributes.position,i));count(r.initial,a);count(r.after,b);r.newOutside+=b.kind==='outside'&&a.kind!=='outside';r.worsenedOutside+=a.kind==='outside'&&b.kind==='outside'&&b.distance>a.distance+1e-6;}
  const position=m.after.attributes.position.array,index=m.after.index.array,pos=Buffer.from(position.buffer,position.byteOffset,position.byteLength),idx=Buffer.from(index.buffer,index.byteOffset,index.byteLength);r.positionsSha256=sha(pos);r.indicesSha256=sha(idx);
  records.push({id:m.id,name:m.name,positions:offset,indices:offset+pos.length,vertexCount:m.record.vertexCount,indexCount:m.record.indexCount});offset+=pos.length+idx.length;buffers.push(pos,idx);report.muscles.push(r);console.log(JSON.stringify({id:m.id,outside:[r.initial.outside,r.after.outside],new:r.newOutside}));
}
const muscleMap=new Map(muscles.map(m=>[m.id,m])),crosses=(a,b)=>a.boundingBox.intersectsBox(b.boundingBox)&&a.boundsTree.intersectsGeometry(b,identity);let examinedPairs=0;
for(let i=0;i<runtime.length;i++)for(let j=i+1;j<runtime.length;j++){
  const a=runtime[i],b=runtime[j],ma=muscleMap.get(a.id),mb=muscleMap.get(b.id);if(!ma&&!mb)continue;examinedPairs++;
  const r={ids:[a.id,b.id],names:[a.name,b.name],layers:[a.layer,b.layer],sourceSameSide:ma&&mb&&ma.side===mb.side?crosses(ma.raw,mb.raw):null,current:crosses(a.g,b.g),initial:crosses(ma?.initial||a.g,mb?.initial||b.g),after:crosses(ma?.after||a.g,mb?.after||b.g)};
  if(!r.current&&!r.initial&&!r.after&&!r.sourceSameSide)continue;if(r.after&&!r.initial)r.interiorWitness=meshCrossingWitness(ma?.after||a.g,mb?.after||b.g);report.relations.push(r);
}
for(const b of bones)for(const m of muscles.filter(m=>m.side===b.side)){const r={side:b.side,bone:b.name,muscleId:m.id,source:crosses(m.raw,b.raw),initial:crosses(m.initial,b.initial),after:crosses(m.after,b.after)};if(r.after&&!r.initial)r.interiorWitness=meshCrossingWitness(m.after,b.after);report.sourceBoneRelations.push(r);}
assert.equal(examinedPairs,89794);assert.equal(report.sourceBoneRelations.length,380);
report.summary={meshes:76,vertices:report.muscles.reduce((n,m)=>n+m.vertices,0),examinedPairs};for(const state of ['initial','after'])for(const field of ['outside','ambiguous'])report.summary[`${state}${field[0].toUpperCase()+field.slice(1)}`]=report.muscles.reduce((n,m)=>n+m[state][field],0);
for(const field of ['newOutside','worsenedOutside'])report.summary[field]=report.muscles.reduce((n,m)=>n+m[field],0);
for(const state of ['current','initial','after'])report.summary[`${state}Pairs`]=report.relations.filter(r=>r[state]).length;
for(const state of ['current','initial'])report.summary[`newAgainst_${state}`]=report.relations.filter(r=>r.after&&!r[state]).length;
for(const state of ['source','initial','after'])report.summary[`${state}BonePairs`]=report.sourceBoneRelations.filter(r=>r[state]).length;
report.summary.newBonePairs=report.sourceBoneRelations.filter(r=>r.after&&!r.initial).length;
report.status='NOT APPROVED: limited relational objective is not whole-body anatomical registration; NO RUNTIME EXPORT';
const data=Buffer.concat(buffers);assert.equal(data.length,offset);const compressed=gzipSync(data,{level:9});fs.writeFileSync(`${out}/candidate.bin.gz`,compressed);report.binary={path:`${out}/candidate.bin.gz`,bytes:data.length,gzipBytes:compressed.length,sha256:sha(compressed),records};
for(const file of ['scripts/fit-lower-body-relational-pose.mjs','scripts/lib/bounded-rigid-pose.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-witness.mjs'])ctx.read(file);report.files=[...ctx.files].map(([file,sha256])=>({file,sha256}));fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
skinProbe.dispose();for(const r of runtime)r.g.dispose();for(const m of muscles)for(const k of ['raw','initial','after'])m[k].dispose();for(const b of bones)for(const k of ['raw','initial','after','target'])b[k].dispose();
