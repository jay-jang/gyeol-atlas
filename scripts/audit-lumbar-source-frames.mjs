// Native female lumbar source-frame diagnostic. Implied duplicated spine poses
// are numerical probes of muscle transforms, not extra bones shown in the app.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {Box3,Matrix4,Vector3} from 'three';
import {NodeIO} from '@gltf-transform/core';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {lowerBodyPoseContext} from './lib/lower-body-pose-context.mjs';
import {officialMeshes} from './lib/official-meshes.mjs';
import {exactPositionComponents} from './lib/exact-position-components.mjs';
import {fitRigid} from './lib/rigid-fit.mjs';
import {fitSimilarity} from './lib/similarity-fit.mjs';
import {referencedVertices,surfaceProbe} from './lib/surface-containment.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
const root=process.argv[2];assert.ok(root);assert.equal(process.argv.length,3);
const out='.cache/lumbar-source-frames';fs.mkdirSync(out,{recursive:true});
const ctx=lowerBodyPoseContext(root),{read,sha,finish,runtime,runtimeMap}=ctx,json=p=>JSON.parse(read(p)),point=new Vector3(),identity=new Matrix4();
const inventory=json('docs/anatomy-alignment/bonehub-female-inventory.json'),receipt=json('docs/anatomy-alignment/bonehub-female-receipt.json'),spec=json('data/catalog/female-knee-source-restoration.json');
const stageFiles={final:'docs/anatomy-alignment/bonehub-denver-final-frame.json',original:'docs/anatomy-alignment/bonehub-denver-original-frame.json'};
const denverMatrices=Object.fromEntries(Object.entries(stageFiles).map(([name,file])=>{const d=json(file),matrix=new Matrix4().fromArray(d.matrixColumnMajor);for(const k of [12,13,14])matrix.elements[k]*=.001;assert.ok(matrix.determinant()>0);return [name,matrix];}));
const sourceBytes=read(spec.sourceFile);assert.equal(sha(sourceBytes),spec.sourceSha256);
const names=Array.from({length:6},(_,i)=>`VH_F_lumbar_vertebra_${i+1}`),official=officialMeshes(sourceBytes,names,spec.translationFromSkin),document=await new NodeIO().readBinary(sourceBytes);
const sourceLoader=new STLLoader(),pairs=[];let decoderPositionScalars=0,decoderIndices=0;
for(let level=1;level<=6;level++){
  const name=`VERTEBRA_L${level}`,part=inventory.parts.find(p=>p.name===name);assert.ok(part);const file=receipt.files.find(f=>f.path===part.file);assert.ok(file);const bytes=read(file.local);assert.equal(sha(bytes),part.sha256);
  const parsed=sourceLoader.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),{geometry:g,components}=exactPositionComponents(parsed);parsed.dispose();g.scale(.001,.001,.001);finish(g);
  const id=`HRAF${String(856-level).padStart(4,'0')}`,sourceName=`VH_F_lumbar_vertebra_${level}`,target=finish(official.get(sourceName).geometry);assert.equal(ctx.atlas.parts.find(p=>p.id===id).conceptId,`HRA:lumbar_vertebra_${level}`);
  const nodes=document.getRoot().listNodes().filter(n=>n.getName()===sourceName);assert.equal(nodes.length,1);const node=nodes[0];assert.deepEqual(Array.from(node.getWorldMatrix()),identity.toArray());const primitives=node.getMesh().listPrimitives();assert.equal(primitives.length,1);const primitive=primitives[0],positions=primitive.getAttribute('POSITION').getArray(),indices=primitive.getIndices().getArray();
  assert.equal(positions.length,target.attributes.position.array.length);for(let i=0;i<positions.length;i++)assert.equal(Math.fround(positions[i]+spec.translationFromSkin[i%3]),target.attributes.position.array[i]);assert.deepEqual(Array.from(indices),Array.from(target.index.array));decoderPositionScalars+=positions.length;decoderIndices+=indices.length;
  pairs.push({name,id,sourceName,source:g,target,runtime:runtimeMap.get(id).g,sourceFile:file.local,sourceSha256:part.sha256,components,training:level>=2&&level<=5});
}
const stats=values=>{values.sort((a,b)=>a-b);return {count:values.length,rmsMm:Math.sqrt(values.reduce((n,v)=>n+v*v,0)/values.length)*1000,p95Mm:values[Math.floor(values.length*.95)]*1000,maximumMm:values.at(-1)*1000};};
const distance=(g,target)=>stats(referencedVertices(g,Infinity).map(i=>target.boundsTree.closestPointToPoint(point.fromBufferAttribute(g.attributes.position,i)).distance));
const options={samplesPerBoneDirection:512,retainedFraction:.8,iterations:160,maximumSampleChangeMetres:1e-8};
const training=pairs.filter(p=>p.training),centre=g=>g.boundingBox.getCenter(new Vector3()),mean=points=>points.reduce((sum,p)=>sum.add(p),new Vector3()).multiplyScalar(1/points.length);
const axis=new Matrix4().set(1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1),shift=mean(training.map(p=>centre(p.target))).sub(mean(training.map(p=>centre(p.source).applyMatrix4(axis))));
const initial=new Matrix4().makeTranslation(...shift.toArray()).multiply(axis),commonFrames=[];
for(const mode of ['rigid','similarity']){
  let matrix=initial.clone(),termination='iteration-limit';const history=[];
  for(let iteration=0;iteration<options.iterations;iteration++){
    const inverse=matrix.clone().invert(),from=[],onto=[];
    for(const p of training){
      const forward=referencedVertices(p.source,options.samplesPerBoneDirection).map(i=>{const source=new Vector3().fromBufferAttribute(p.source.attributes.position,i),hit=p.target.boundsTree.closestPointToPoint(source.clone().applyMatrix4(matrix));return {source,target:hit.point.clone(),distance:hit.distance};});
      const reverse=referencedVertices(p.target,options.samplesPerBoneDirection).map(i=>{const target=new Vector3().fromBufferAttribute(p.target.attributes.position,i),hit=p.source.boundsTree.closestPointToPoint(target.clone().applyMatrix4(inverse));return {source:hit.point.clone(),target,distance:hit.point.clone().applyMatrix4(matrix).distanceTo(target)};});
      assert.equal(forward.length,512);assert.equal(reverse.length,512);
      for(const matches of [forward,reverse])for(const m of matches.sort((a,b)=>a.distance-b.distance).slice(0,Math.floor(512*options.retainedFraction))){from.push(m.source);onto.push(m.target);}
    }
    const next=(mode==='rigid'?fitRigid:fitSimilarity)(from,onto);let change=0;
    for(const p of training)for(const i of referencedVertices(p.source,512)){const v=new Vector3().fromBufferAttribute(p.source.attributes.position,i);change=Math.max(change,v.clone().applyMatrix4(matrix).distanceTo(v.applyMatrix4(next)));}
    matrix=next;history.push({iteration,maximumSampleChangeMm:change*1000,scale:Math.cbrt(matrix.determinant()),correspondences:from.length});
    if(iteration%20===0)console.log(JSON.stringify({mode,...history.at(-1)}));if(change<options.maximumSampleChangeMetres){termination='maximum-sample-change-threshold';break;}
  }
  commonFrames.push({mode,matrix,history,termination});
}
const previous=json('docs/anatomy-alignment/lower-body-relational-pose.json'),frames=[];
const legacy=side=>{const f=ctx.source.fits[`${side}-hip`];return new Matrix4().set(...f.rows[0].map(v=>v*f.scale),f.offset[0],...f.rows[1].map(v=>v*f.scale),f.offset[1],...f.rows[2].map(v=>v*f.scale),f.offset[2],0,0,0,1);};
for(const family of ['legacy-hip','whole-leg','relational'])for(const side of ['left','right']){
  const prior=previous.sides.find(s=>s.side===side),muscleMatrix=family==='legacy-hip'?legacy(side):family==='whole-leg'?new Matrix4().fromArray(prior.initialMatrix):new Matrix4().fromArray(prior.adjustmentMatrix).multiply(new Matrix4().fromArray(prior.initialMatrix));
  frames.push({name:`${family}-${side}`,family,side,matrix:muscleMatrix.clone().multiply(denverMatrices.final)});
}
for(const frame of commonFrames)frames.push({name:`lumbar-${frame.mode}`,family:'shared-lumbar',matrix:frame.matrix,fit:{history:frame.history,termination:frame.termination}});
const report={createdAt:new Date().toISOString(),status:'SOURCE FRAME AND PSOAS CANDIDATES ONLY; NO RUNTIME EXPORT',options,sourceRevision:inventory.revision,officialSha256:spec.sourceSha256,officialTranslation:spec.translationFromSkin,decoderCheck:{meshes:6,positionScalars:decoderPositionScalars,indexReferences:decoderIndices,differences:0},denverMatrices:Object.fromEntries(Object.entries(denverMatrices).map(([name,m])=>[name,m.toArray()])),parts:[],frames:[],impliedSideDifferences:[],psoasCandidates:[],limitations:[
  'Implied left/right lumbar poses extend existing muscle transforms onto the same source spine; they are not duplicated spine meshes in the app or measured anatomical attachment points.',
  'The BoneHub-to-Denver frame is a prior approximate fit, with held-out discrepancies. It is not an exact common CT-coordinate conversion; sensitivity to its Final/Original fits is reported separately.',
  'Only same-labelled L1-L6 are paired; labels are preserved without interpreting the extra lumbar label as a clinical diagnosis. L2-L5 train, L1/L6 remain held out of initialization and fitting.',
  'Symmetric trimmed deterministic vertex ICP is not area weighted or an anatomical correspondence. Numerical stopping is not global optimality or clinical approval.',
  'Psoas candidates affect only two muscles; the other74 donor muscles, bones, organs, vessels, nerves and skin remain fixed. Separate side source relationships and femoral insertions are not thereby preserved.',
  'Geometric skin/triangle checks and source fidelity do not establish correct attachments or nerve courses.'
]};
for(const p of pairs)report.parts.push({name:p.name,id:p.id,sourceName:p.sourceName,sourceFile:p.sourceFile,sourceSha256:p.sourceSha256,sourceVertices:p.source.attributes.position.count,sourceIndices:p.source.index.count,targetVertices:p.target.attributes.position.count,targetIndices:p.target.index.count,runtimeVertices:p.runtime.attributes.position.count,sourceComponents:p.components,training:p.training,resolution:{runtimeToOfficial:distance(p.runtime,p.target),officialToRuntime:distance(p.target,p.runtime)}});
const placedFrames=new Map();
for(const f of frames){const placed=pairs.map(p=>finish(p.source.clone().applyMatrix4(f.matrix)));placedFrames.set(f.name,placed);const row={name:f.name,family:f.family,side:f.side,matrix:f.matrix.toArray(),scale:Math.cbrt(f.matrix.determinant()),fit:f.fit,bones:pairs.map((p,i)=>({name:p.name,id:p.id,training:p.training,forward:distance(placed[i],p.target),reverse:distance(p.target,placed[i])}))};report.frames.push(row);console.log(JSON.stringify({frame:f.name,p95:row.bones.map(b=>[b.name,b.forward.p95Mm,b.reverse.p95Mm])}));}
for(const family of ['legacy-hip','whole-leg','relational']){
  const a=frames.find(f=>f.name===`${family}-left`).matrix,b=frames.find(f=>f.name===`${family}-right`).matrix;
  report.impliedSideDifferences.push({family,bones:pairs.map(p=>{const values=referencedVertices(p.source,Infinity).map(i=>{const v=new Vector3().fromBufferAttribute(p.source.attributes.position,i);return v.clone().applyMatrix4(a).distanceTo(v.applyMatrix4(b));});const c=centre(p.source);return {name:p.name,centreSeparationMm:1000*c.clone().applyMatrix4(a).distanceTo(c.applyMatrix4(b)),...stats(values)};})});
}
const psoas=ctx.muscles.filter(m=>['VHF0034','VHF0072'].includes(m.id));assert.equal(psoas.length,2);const skinProbe=surfaceProbe(runtimeMap.get('HRAF0003').g,.002),changed=new Set(psoas.map(m=>m.id)),crosses=(a,b)=>a.boundingBox.intersectsBox(b.boundingBox)&&a.boundsTree.intersectsGeometry(b,identity);
const tally=()=>({inside:0,outside:0,'surface-band':0,ambiguous:0,maximumOutsideMm:0});
const count=(r,c)=>{r[c.kind]++;if(c.kind==='outside')r.maximumOutsideMm=Math.max(r.maximumOutsideMm,c.distance*1000);};
const baseline=new Map(psoas.map(m=>[m.id,finish(m.raw.clone().applyMatrix4(legacy(m.side)))]));
for(const frame of commonFrames){
  const sourceToAtlas=frame.matrix.clone().multiply(denverMatrices.final.clone().invert()),alternative=frame.matrix.clone().multiply(denverMatrices.original.clone().invert()),placed=new Map(),row={mode:frame.mode,sourceToAtlasMatrix:sourceToAtlas.toArray(),alternativeSourceToAtlasMatrix:alternative.toArray(),muscles:[],relations:[]},buffers=[],records=[];let offset=0;
  for(const m of psoas){const after=finish(m.raw.clone().applyMatrix4(sourceToAtlas)),other=finish(m.raw.clone().applyMatrix4(alternative)),before=baseline.get(m.id),r={id:m.id,name:m.name,vertices:m.record.vertexCount,indexReferences:m.record.indexCount,legacy:tally(),after:tally(),newOutside:0,worsenedOutside:0,sourceFrameSensitivity:null};const sensitivity=[];
    for(let i=0;i<m.record.vertexCount;i++){const a=skinProbe.classify(point.fromBufferAttribute(before.attributes.position,i)),b=skinProbe.classify(point.fromBufferAttribute(after.attributes.position,i));count(r.legacy,a);count(r.after,b);r.newOutside+=b.kind==='outside'&&a.kind!=='outside';r.worsenedOutside+=a.kind==='outside'&&b.kind==='outside'&&b.distance>a.distance+1e-6;sensitivity.push(new Vector3().fromBufferAttribute(after.attributes.position,i).distanceTo(point.fromBufferAttribute(other.attributes.position,i)));}
    r.sourceFrameSensitivity=stats(sensitivity);other.dispose();placed.set(m.id,after);
    const pos=after.attributes.position.array,idx=after.index.array,pb=Buffer.from(pos.buffer,pos.byteOffset,pos.byteLength),ib=Buffer.from(idx.buffer,idx.byteOffset,idx.byteLength);r.positionsSha256=sha(pb);r.indicesSha256=sha(ib);records.push({id:m.id,positions:offset,indices:offset+pb.length,vertexCount:pos.length/3,indexCount:idx.length});offset+=pb.length+ib.length;buffers.push(pb,ib);row.muscles.push(r);
  }
  let examinedPairs=0;
  for(let i=0;i<runtime.length;i++)for(let j=i+1;j<runtime.length;j++){const a=runtime[i],b=runtime[j];if(!changed.has(a.id)&&!changed.has(b.id))continue;examinedPairs++;const initialA=baseline.get(a.id)||a.g,initialB=baseline.get(b.id)||b.g,afterA=placed.get(a.id)||a.g,afterB=placed.get(b.id)||b.g,r={ids:[a.id,b.id],names:[a.name,b.name],layers:[a.layer,b.layer],current:crosses(a.g,b.g),legacy:crosses(initialA,initialB),after:crosses(afterA,afterB)};if(!r.current&&!r.legacy&&!r.after)continue;if(r.after&&!r.legacy)r.interiorWitness=meshCrossingWitness(afterA,afterB);row.relations.push(r);}
  assert.equal(examinedPairs,2437);row.summary={meshes:2,vertices:row.muscles.reduce((n,m)=>n+m.vertices,0),examinedPairs,legacyOutside:row.muscles.reduce((n,m)=>n+m.legacy.outside,0),afterOutside:row.muscles.reduce((n,m)=>n+m.after.outside,0),newOutside:row.muscles.reduce((n,m)=>n+m.newOutside,0),worsenedOutside:row.muscles.reduce((n,m)=>n+m.worsenedOutside,0)};
  for(const state of ['current','legacy','after'])row.summary[`${state}Pairs`]=row.relations.filter(p=>p[state]).length;for(const state of ['current','legacy'])row.summary[`newAgainst_${state}`]=row.relations.filter(p=>p.after&&!p[state]).length;
  const data=Buffer.concat(buffers);assert.equal(data.length,offset);const compressed=gzipSync(data,{level:9});fs.writeFileSync(`${out}/psoas-${frame.mode}.bin.gz`,compressed);row.binary={path:`${out}/psoas-${frame.mode}.bin.gz`,bytes:data.length,gzipBytes:compressed.length,sha256:sha(compressed),records};report.psoasCandidates.push(row);console.log(JSON.stringify({mode:frame.mode,...row.summary}));for(const g of placed.values())g.dispose();
}
const packedParts=pairs.flatMap(p=>[{id:p.name,kind:'bonehub',positions:Array.from(p.source.attributes.position.array),indices:Array.from(p.source.index.array)},{id:p.id,kind:'official',positions:Array.from(p.target.attributes.position.array),indices:Array.from(p.target.index.array)}]);fs.writeFileSync(`${out}/parts.json.gz`,gzipSync(JSON.stringify(packedParts)));read(`${out}/parts.json.gz`);report.partsFile=`${out}/parts.json.gz`;
for(const file of ['scripts/audit-lumbar-source-frames.mjs','scripts/lib/official-meshes.mjs','scripts/lib/exact-position-components.mjs','scripts/lib/rigid-fit.mjs','scripts/lib/similarity-fit.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-witness.mjs'])read(file);report.files=[...ctx.files].map(([file,sha256])=>({file,sha256}));fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');
skinProbe.dispose();for(const g of baseline.values())g.dispose();for(const group of placedFrames.values())for(const g of group)g.dispose();for(const p of pairs){p.source.dispose();p.target.dispose();}for(const r of runtime)r.g.dispose();for(const m of ctx.muscles){m.raw.dispose();m.initial.dispose();}for(const b of ctx.bones){b.raw.dispose();b.initial.dispose();b.target.dispose();}
