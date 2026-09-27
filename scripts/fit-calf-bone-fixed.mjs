// Bone-fixed compact-support successor to the frozen common-displacement trial.
// Source bone surfaces stay fixed after the initial common shank fit. Every
// tissue on a side uses the same spatial steps; output remains private.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3,Matrix4} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeVertices,mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {referencedVertices,surfaceProbe} from './lib/surface-containment.mjs';
import {applyCompactDisplacement as applyDisplacement,mapCompactDisplacements as mapDisplacements,validateCompactStep as validateDisplacementStep,compactWeight} from './lib/compact-displacement.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';

const [originalRoot,finalRoot]=process.argv.slice(2);assert.ok(finalRoot);assert.equal(process.argv.length,4);
const out='.cache/calf-bone-fixed';fs.mkdirSync(out,{recursive:true});
const files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>{const b=fs.readFileSync(p);files.set(p,sha(b));return b;};
const json=p=>JSON.parse(read(p));
const atlas=json('public/models/female/atlas-female.json'),source=json('docs/anatomy-alignment/donor-source-comparison.json');
const fits=json('docs/anatomy-alignment/hierarchy-joint-bone-surface-fits.json'),membership=json('docs/anatomy-alignment/hra-bone-targets.json');
assert.equal(files.get('public/models/female/atlas-female.json'),membership.atlasSha256);
const originalReceipt=json('docs/anatomy-alignment/donor-original-receipt.json');
const packing=json('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative;
const packed=read('.cache/donor-fidelity/source-full.bin.gz');assert.equal(sha(packed),packing.sha256);const rawData=gunzipSync(packed);assert.equal(rawData.length,packing.bytes);
for(const f of json('data/catalog/female-atlas-source.json').files)assert.equal(sha(read(f.path)),f.sha256);
const chunks=new Map(),loader=new STLLoader(),point=new Vector3();
const finish=g=>{g.computeBoundingBox();g.boundsTree=new MeshBVH(g,{indirect:true});return g;};
const matrix=f=>new Matrix4().set(...f.rows[0].map(v=>v*f.scale),f.offset[0],...f.rows[1].map(v=>v*f.scale),f.offset[1],...f.rows[2].map(v=>v*f.scale),f.offset[2],0,0,0,1);
function stl(file,expected){
  const b=read(file);assert.equal(sha(b),expected);const raw=loader.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));raw.scale(.001,.001,.001);raw.deleteAttribute('normal');const g=mergeVertices(raw,1e-9);raw.dispose();return finish(g);
}
function sourceBone(side,name){const f=source.files.find(f=>f.side===side&&f.kind==='bone'&&f.structure===name);assert.ok(f);return stl(path.join(finalRoot,f.file),f.sha256);}
function atlasGeometry(id){
  const p=atlas.parts.find(p=>p.id===id);assert.ok(p);const c=atlas.chunks[p.chunk];
  if(!chunks.has(p.chunk))chunks.set(p.chunk,gunzipSync(read(`public/models/female/${path.basename(c.gzip)}`)));
  return decoded(chunks.get(p.chunk),p);
}
function decoded(b,p){
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i)),1));return finish(g);
}
const originalEnvelope=originalReceipt.combined.find(r=>r.entry.endsWith('/VHF_Both_All.stl'));assert.ok(originalEnvelope);
const envelope=stl(path.join(originalRoot,originalEnvelope.entry),originalEnvelope.sha256);assert.equal(envelope.attributes.position.count,326280);
const skin=atlasGeometry('HRAF0003'),probe=surfaceProbe(skin,.002);
const shankSources=Object.fromEntries(['left','right'].map(side=>{
  const pieces=['Tibia','Fibula'].map(name=>sourceBone(side,name)),g=finish(mergeGeometries(pieces));pieces.forEach(p=>p.dispose());return [side,g];
}));
const options={maximumIterations:240,maximumStepBound:.25,maximumStepDisplacementMm:5,maximumSupportMm:80,minimumSupportMm:3,supportMarginMicrometres:1,supportRadiusFractions:[1,.65],skinWeight:1,boneWeightEach:0,boneSamplesEach:400,skinSamples:1000,regularization:.00001,upperExtensionMm:70,lowerExtensionMm:40};
const report={createdAt:new Date().toISOString(),status:'EXPERIMENTAL; NO RUNTIME EXPORT',options,sides:[],
  limitations:[
    'Two side-specific maps, not a single whole-body map. Cross-side and unchanged-muscle interfaces are not certified by per-map injectivity.',
    'Each continuous step has a global derivative norm bound below one; this does not prove Float32 or straight-triangle topology preservation.',
    'Closest surfaces and deterministic vertex samples are numerical correspondences, not anatomical landmarks or area-weighted samples.',
    'One-way sampled skin objectives can distort tissue even with fixed source bones; full held-out distances, muscle skin and crossings remain necessary.',
    'Source skin selection is geometric; no new anatomical region labels are assigned. Source and target skin triangle interiors are not fitted.',
    'All muscles are held out of fitting. Skin containment and a positive Jacobian do not establish correct attachments, nerve courses or clinical anatomy.',
    'The full placed source Femur/Patella/Tibia/Fibula surfaces are protected. Their initial placement is only a candidate and is not made anatomically correct by freezing it.',
    'Bone samples have zero fit weight and are diagnostics only; local skin samples drive the optimization.',
    'Native HRA geometry remains fixed. Source bone diagnostics are not runtime replacements.',
    'Triangle crossings against full-body fixed tissues are not performed in this initial candidate screen.'
  ]};
const binary=[],binaryParts=[];let offset=0;
function savePart(p,g){
  const position=Buffer.from(g.attributes.position.array.buffer,g.attributes.position.array.byteOffset,g.attributes.position.array.byteLength);
  const index=Buffer.from(g.index.array.buffer,g.index.array.byteOffset,g.index.array.byteLength);
  binaryParts.push({id:p.id,name:p.name,positions:offset,indices:offset+position.length,vertexCount:g.attributes.position.count,indexCount:g.index.count});binary.push(Buffer.from(position),Buffer.from(index));offset+=position.length+index.length;
}
function mappedGeometry(g,initial,steps){
  const result=g.clone(),a=result.attributes.position;
  for(let i=0;i<a.count;i++){const mapped=mapDisplacements(point.fromBufferAttribute(g.attributes.position,i),initial,steps);a.setXYZ(i,...mapped.point.toArray());}
  return finish(result);
}
function stats(values){values.sort((a,b)=>a-b);return {vertices:values.length,minimumMm:values[0],medianMm:values[Math.floor(values.length*.5)],p95Mm:values[Math.floor(values.length*.95)],maximumMm:values.at(-1)};}
function residuals(g,target,indices=referencedVertices(g,Infinity)){return stats(indices.map(i=>target.boundsTree.closestPointToPoint(point.fromBufferAttribute(g.attributes.position,i)).distance*1000));}
const tally=()=>({inside:0,outside:0,'surface-band':0,ambiguous:0,maximumOutsideMm:0});
function count(row,c){row[c.kind]++;if(c.kind==='outside')row.maximumOutsideMm=Math.max(row.maximumOutsideMm,c.distance*1000);}
function cross(a,b){if(!a.boundingBox.intersectsBox(b.boundingBox)||!a.boundsTree.intersectsGeometry(b,new Matrix4()))return null;return triangleCrossings(a,b);}

for(const side of ['left','right']){
  const initial=new Matrix4().fromArray(fits.fits.find(f=>f.side===side&&f.mode==='shank').sourceToAtlasMatrix);assert.ok(initial.determinant()>0);
  const controls=['Femur','Patella','Tibia','Fibula'].map(name=>{
    const raw=sourceBone(side,name),members=membership.targets.find(t=>t.side===side&&t.bone===name).members;
    const pieces=members.map(p=>atlasGeometry(p.id)),target=finish(mergeGeometries(pieces));pieces.forEach(g=>g.dispose());
    return {name,raw,target,targetIds:members.map(p=>p.id),placed:finish(raw.clone().applyMatrix4(initial))};
  });
  const protectedSurfaces=controls.map(c=>({name:c.name,g:c.placed}));
  const tibia=controls.find(c=>c.name==='Tibia').target.boundingBox,yMin=tibia.min.y-options.lowerExtensionMm/1000,yMax=tibia.max.y+options.upperExtensionMm/1000;
  const sign=side==='left'?1:-1;
  // Original triangle coordinates are retained; only target triangle membership
  // is restricted, without cutting faces or inventing a cap at the boundary.
  const targetSkin=skin.clone(),targetIndices=[],a=skin.attributes.position,idx=skin.index.array;
  for(let i=0;i<idx.length;i+=3){
    const verts=[idx[i],idx[i+1],idx[i+2]].map(j=>new Vector3().fromBufferAttribute(a,j));
    if(verts.every(p=>p.x*sign>0)&&Math.max(...verts.map(p=>p.y))>=yMin-.02&&Math.min(...verts.map(p=>p.y))<=yMax+.02)targetIndices.push(...idx.slice(i,i+3));
  }
  assert.ok(targetIndices.length>1000);targetSkin.setIndex(new BufferAttribute(new Uint32Array(targetIndices),1));finish(targetSkin);
  const eligible=[];
  for(const i of referencedVertices(envelope,Infinity)){
    const p=new Vector3().fromBufferAttribute(envelope.attributes.position,i),placed=p.clone().applyMatrix4(initial);
    if(placed.y<yMin||placed.y>yMax)continue;
    const own=shankSources[side].boundsTree.closestPointToPoint(p).distance,other=shankSources[side==='left'?'right':'left'].boundsTree.closestPointToPoint(p).distance;
    if(own<other)eligible.push(i);
  }
  assert.ok(eligible.length>options.skinSamples);
  const select=(ids,n)=>ids.length<=n?ids:Array.from({length:n},(_,i)=>ids[Math.floor(i*(ids.length-1)/(n-1))]);
  const groups=controls.map(c=>{
    const ids=referencedVertices(c.placed,Infinity).filter(i=>c.name!=='Femur'||c.placed.attributes.position.getY(i)<=yMax);
    const chosen=select(ids,options.boneSamplesEach);assert.ok(chosen.length>=100);
    return {name:c.name,target:c.target,weight:options.boneWeightEach,eligible:ids.length,indices:chosen,points:chosen.map(i=>new Vector3().fromBufferAttribute(c.placed.attributes.position,i))};
  });
  const skinIndices=select(eligible,options.skinSamples);
  groups.push({name:'skin',target:targetSkin,weight:options.skinWeight,eligible:eligible.length,indices:skinIndices,points:skinIndices.map(i=>new Vector3().fromBufferAttribute(envelope.attributes.position,i).applyMatrix4(initial))});
  assert.equal(groups.reduce((n,g)=>n+g.weight,0),1);
  const samples=groups.flatMap(g=>g.points.map(p=>({point:p,group:g,weight:g.weight/g.points.length}))),steps=[],history=[];
  let termination='iteration-limit',lastLoss=Infinity;
  const measure=()=>{
    let loss=0;for(const s of samples){const hit=s.group.target.boundsTree.closestPointToPoint(s.point);s.residual=hit.point.clone().sub(s.point);s.errorSq=hit.distance**2;loss+=s.weight*s.errorSq;}return loss;
  };
  for(let iteration=0;iteration<options.maximumIterations;iteration++){
    const loss=measure();assert.ok(loss<=lastLoss+1e-13,'Closest-surface objective increased');lastLoss=loss;
    const centres=[];
    for(const g of groups.filter(g=>g.name==='skin')){
      const own=samples.filter(s=>s.group===g),worst=own.toSorted((a,b)=>b.errorSq-a.errorSq).slice(0,36);
      centres.push(...worst.map(s=>s.point.clone()),...select(own,36).map(s=>s.point.clone()));
    }
    let best=null;
    for(const centre of centres){
      const protectedDistances=protectedSurfaces.map(p=>{const hit=p.g.boundsTree.closestPointToPoint(centre);return {name:p.name,distanceMetres:hit.distance,nearestPointMetres:hit.point.toArray()};});
      const clearance=Math.min(...protectedDistances.map(p=>p.distanceMetres));
      for(const fraction of options.supportRadiusFractions){
        const radius=Math.min(options.maximumSupportMm/1000,clearance-options.supportMarginMicrometres*1e-6)*fraction;
        if(radius<options.minimumSupportMm/1000)continue;
        const numerator=new Vector3();let denominator=options.regularization;
        for(const s of samples){if(!s.weight)continue;const k=compactWeight(s.point.distanceTo(centre),radius);numerator.addScaledVector(s.residual,s.weight*k);denominator+=s.weight*k*k;}
        const d=numerator.clone().multiplyScalar(1/denominator),norm=d.length(),maximum=Math.min(options.maximumStepDisplacementMm/1000,options.maximumStepBound*radius*64/135);
        if(norm>maximum)d.multiplyScalar(maximum/norm);
        const reduction=2*d.dot(numerator)-d.lengthSq()*denominator;
        if(!best||reduction>best.reduction)best={centre:centre.toArray(),radius,displacement:d.toArray(),protectedDistances,reduction};
      }
    }
    if(!best){termination='no-admissible-support-ball';break;}
    const rmsByGroup=groups.map(g=>({name:g.name,rmsMm:1000*Math.sqrt(samples.filter(s=>s.group===g).reduce((n,s)=>n+s.errorSq,0)/g.points.length)}));
    history.push({iteration,weightedRmsMm:Math.sqrt(loss)*1000,groups:rmsByGroup,predictedRegularizedReductionMetresSquared:best.reduction});
    if(best.reduction<1e-12){termination='predicted-reduction-below-1e-12-m2';break;}
    const {reduction,...step}=best;step.lipschitzBound=validateDisplacementStep(step,options.maximumStepBound);steps.push(step);
    samples.forEach(s=>applyDisplacement(s.point,step));
    if(iteration%20===0)console.log(JSON.stringify({side,iteration,weightedRmsMm:Math.sqrt(loss)*1000,stepBound:step.lipschitzBound}));
  }
  const finalLoss=measure();assert.ok(finalLoss<=lastLoss+1e-13);
  const row={side,initialMatrix:initial.toArray(),termination,steps,history,finalWeightedRmsMm:1000*Math.sqrt(finalLoss),
    fitSamples:groups.map(g=>({name:g.name,weight:g.weight,eligible:g.eligible,samples:g.points.length,indices:g.indices})),
    skinSelection:{placedYBand:[yMin,yMax],sourceEligibleVertices:eligible.length,sourceIndexSha256:sha(Buffer.from(new Uint32Array(eligible).buffer)),targetTriangles:targetIndices.length/3,criterion:'source point nearer to same-side tibia/fibula surface than opposite side, inside placed Y band; target triangles entirely on same side and touching Y band plus 20mm'},bones:[],muscles:[]};
  const beforeEnvelope=finish(envelope.clone().applyMatrix4(initial));
  // All original envelope points are mapped, but distances are reported only
  // for the independently retained geometric calf selection, not whole skin.
  const afterEnvelope=mappedGeometry(envelope,initial,steps);
  row.envelope={before:residuals(beforeEnvelope,skin,eligible),after:residuals(afterEnvelope,skin,eligible)};
  beforeEnvelope.dispose();afterEnvelope.dispose();
  for(const c of controls){
    const after=mappedGeometry(c.raw,initial,steps);
    const beforePositions=c.placed.attributes.position.array,afterPositions=after.attributes.position.array;
    let changedCoordinates=0,maximumPositionDifferenceMetres=0;
    for(let i=0;i<beforePositions.length;i++){changedCoordinates+=beforePositions[i]!==afterPositions[i];maximumPositionDifferenceMetres=Math.max(maximumPositionDifferenceMetres,Math.abs(beforePositions[i]-afterPositions[i]));}
    assert.equal(changedCoordinates,0,'Protected source bones must remain byte-exact after Float32 packing');
    const beforeSha256=sha(Buffer.from(beforePositions.buffer,beforePositions.byteOffset,beforePositions.byteLength)),afterSha256=sha(Buffer.from(afterPositions.buffer,afterPositions.byteOffset,afterPositions.byteLength));assert.equal(beforeSha256,afterSha256);
    row.bones.push({name:c.name,targetIds:c.targetIds,preservation:{vertices:beforePositions.length/3,changedCoordinates,maximumPositionDifferenceMetres,beforeSha256,afterSha256},before:{forward:residuals(c.placed,c.target),reverse:residuals(c.target,c.placed)},after:{forward:residuals(after,c.target),reverse:residuals(c.target,after)}});
    after.dispose();
  }
  const selected=source.muscles.filter(m=>m.fitGroup.startsWith(`${side}-`)&&(m.fitGroup.endsWith('-shank')||/Gastrocnemius medial|Plantaris|Popliteus/.test(m.name)));assert.equal(selected.length,12);
  const muscleGeometries=[];
  for(const m of selected){
    const p=packing.parts.find(p=>p.id===m.id);assert.ok(p);const raw=decoded(rawData,p),after=raw.clone(),position=after.attributes.position;
    const current=matrix(source.fits[m.fitGroup]),r={id:m.id,name:m.name,vertices:p.vertexCount,before:tally(),after:tally(),newOutside:0,worsenedOutside:0,resolvedOutside:0,minimumDeterminant:Infinity,maximumDeterminant:-Infinity,maximumJacobianFrobeniusNorm:0};
    const used=referencedVertices(raw,Infinity);assert.equal(used.length,p.vertexCount,'Do not serialize untransformed orphan vertices');
    for(const i of used){
      point.fromBufferAttribute(raw.attributes.position,i);const mapped=mapDisplacements(point,initial,steps,true),before=point.clone().applyMatrix4(current);before.set(...before.toArray().map(Math.fround));
      position.setXYZ(i,...mapped.point.toArray());const saved=new Vector3().fromBufferAttribute(position,i),a=probe.classify(before),b=probe.classify(saved);count(r.before,a);count(r.after,b);
      r.newOutside+=b.kind==='outside'&&a.kind!=='outside';r.worsenedOutside+=b.kind==='outside'&&a.kind==='outside'&&b.distance>a.distance+1e-6;r.resolvedOutside+=a.kind==='outside'&&b.kind!=='outside';
      assert.ok(Number.isFinite(mapped.determinant)&&mapped.determinant>0);
      if(mapped.determinant<r.minimumDeterminant){r.minimumDeterminant=mapped.determinant;r.minimumWitness={vertex:i,sourcePointMetres:point.toArray(),mappedPointMetres:mapped.point.toArray(),jacobianColumnMajor:mapped.jacobian.toArray()};}
      r.maximumDeterminant=Math.max(r.maximumDeterminant,mapped.determinant);r.maximumJacobianFrobeniusNorm=Math.max(r.maximumJacobianFrobeniusNorm,Math.hypot(...mapped.jacobian.elements));
    }
    assert.equal(r.after.outside-r.before.outside,r.newOutside-r.resolvedOutside);finish(after);savePart(p,after);row.muscles.push(r);muscleGeometries.push({id:m.id,raw,after});
  }
  // Same-source pairs test whether straight, packed triangles preserve the
  // continuous shared-map relationship. These are not HRA collision checks.
  row.sourceMusclePairs=[];
  for(let i=0;i<muscleGeometries.length;i++)for(let j=i+1;j<muscleGeometries.length;j++){
    const a=muscleGeometries[i],b=muscleGeometries[j],before=cross(a.raw,b.raw),after=cross(a.after,b.after);
    row.sourceMusclePairs.push({ids:[a.id,b.id],before,after});
  }
  row.summary={meshes:12,vertices:row.muscles.reduce((n,m)=>n+m.vertices,0),beforeOutside:row.muscles.reduce((n,m)=>n+m.before.outside,0),afterOutside:row.muscles.reduce((n,m)=>n+m.after.outside,0),newOutside:row.muscles.reduce((n,m)=>n+m.newOutside,0),worsenedOutside:row.muscles.reduce((n,m)=>n+m.worsenedOutside,0),ambiguousAfter:row.muscles.reduce((n,m)=>n+m.after.ambiguous,0),minimumDeterminant:Math.min(...row.muscles.map(m=>m.minimumDeterminant)),maximumDeterminant:Math.max(...row.muscles.map(m=>m.maximumDeterminant)),newSourceMuscleCrossingPairs:row.sourceMusclePairs.filter(p=>!p.before&&p.after).length,
    newSourceStrictCrossingPairs:row.sourceMusclePairs.filter(p=>!(p.before?.strictPlaneStraddlingPairs>0)&&p.after?.strictPlaneStraddlingPairs>0).length,
    increasedSourcePlaneExtentPairs:row.sourceMusclePairs.filter(p=>(p.after?.maxTrianglePlaneStraddleExtentMm??0)>(p.before?.maxTrianglePlaneStraddleExtentMm??0)+.001).length};
  report.sides.push(row);console.log(JSON.stringify({side,termination,fitBefore:history[0].weightedRmsMm,fitAfter:row.finalWeightedRmsMm,envelope:row.envelope,summary:row.summary}));
  fs.writeFileSync(`${out}/report.partial.json`,JSON.stringify(report,null,2)+'\n');
  controls.forEach(c=>{c.raw.dispose();c.target.dispose();c.placed.dispose();});targetSkin.dispose();muscleGeometries.forEach(m=>{m.raw.dispose();m.after.dispose();});
}
report.status=report.sides.some(s=>s.summary.newOutside||s.summary.worsenedOutside||s.summary.ambiguousAfter||s.summary.newSourceMuscleCrossingPairs||s.summary.newSourceStrictCrossingPairs||s.summary.increasedSourcePlaneExtentPairs)?'REJECTED BY FULL MUSCLE SKIN/SOURCE-TRIANGLE SCREEN; NO RUNTIME EXPORT':'NOT APPROVED; full fixed-atlas tissue/attachment and visual checks still required';
const data=Buffer.concat(binary),compressed=gzipSync(data,{level:9});assert.equal(data.length,offset);fs.writeFileSync(`${out}/candidate.bin.gz`,compressed);
report.binary={path:`${out}/candidate.bin.gz`,bytes:data.length,gzipBytes:compressed.length,sha256:sha(compressed),parts:binaryParts};
for(const file of ['scripts/fit-calf-bone-fixed.mjs','scripts/lib/compact-displacement.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-crossings.mjs','package-lock.json'])read(file);
report.files=[...files].map(([file,sha256])=>({file,sha256}));fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');
probe.dispose();skin.dispose();envelope.dispose();Object.values(shankSources).forEach(g=>g.dispose());console.log(report.status);
