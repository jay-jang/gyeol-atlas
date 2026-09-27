// Offline source-preserving initial-frame experiment. No runtime export.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeVertices,mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {fitSimilarity} from './lib/similarity-fit.mjs';
import {fitRigid} from './lib/rigid-fit.mjs';
import {referencedVertices,surfaceProbe} from './lib/surface-containment.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';
import {applyFemaleSourceRestoration} from '../src/female-source-restoration.ts';
import {resolveFemaleBrainGeometryPart} from '../src/female-brain-bindings.ts';

const root=process.argv[2];assert.ok(root);assert.equal(process.argv.length,3);
const out='.cache/knee-initial',files=new Map();fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>{const b=fs.readFileSync(p);files.set(p,sha(b));return b;},json=p=>JSON.parse(read(p));
const source=json('docs/anatomy-alignment/donor-source-comparison.json'),oldFits=json('docs/anatomy-alignment/hierarchy-joint-bone-surface-fits.json');
const membership=json('docs/anatomy-alignment/hra-bone-targets.json'),atlas=json('public/models/female/atlas-female.json');
assert.equal(files.get('public/models/female/atlas-female.json'),membership.atlasSha256);
for(const f of json('data/catalog/female-atlas-source.json').files)assert.equal(sha(read(f.path)),f.sha256);
const packing=json('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative,zipped=read('.cache/donor-fidelity/source-full.bin.gz');assert.equal(sha(zipped),packing.sha256);
const raw=gunzipSync(zipped),chunks=atlas.chunks.map(c=>gunzipSync(read(`public/models/female/${path.basename(c.gzip)}`)));
const catalog=new Map(json('data/female-atlas-structures.json').map(p=>[p.id,p])),byId=new Map(atlas.parts.map(p=>[p.id,p]));
const restoration=json('data/catalog/female-source-restoration.json'),restorationBytes=gunzipSync(read(`public/${restoration.url}`));
const restorationBuffer=restorationBytes.buffer.slice(restorationBytes.byteOffset,restorationBytes.byteOffset+restorationBytes.byteLength);
const finish=g=>{g.computeBoundingBox();g.boundsTree=new MeshBVH(g,{indirect:true});return g;};
function decoded(b,p){
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i)),1));return g;
}
const runtime=atlas.parts.map(p=>{
  const q=resolveFemaleBrainGeometryPart(p,'female',byId),g=decoded(chunks[q.chunk],q);
  applyFemaleSourceRestoration(g,'female',p.id,p.system,restorationBuffer);applyFemaleArmRegistration(g,'female',p.id,p.system);applyFemaleFootRegistration(g,'female',p.id,p.system);
  return {id:p.id,name:p.name,system:p.system,layer:catalog.get(p.id).layer,g:finish(g)};
});assert.equal(runtime.length,1220);
const runtimeMap=new Map(runtime.map(p=>[p.id,p])),point=new Vector3(),loader=new STLLoader();
const bufferHash=a=>sha(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
const legacyMatrix=group=>{const f=source.fits[group];return new Matrix4().set(...f.rows[0].map(v=>v*f.scale),f.offset[0],...f.rows[1].map(v=>v*f.scale),f.offset[1],...f.rows[2].map(v=>v*f.scale),f.offset[2],0,0,0,1);};
const previousMatrix=(side,mode)=>new Matrix4().fromArray(oldFits.fits.find(f=>f.side===side&&f.mode===mode).sourceToAtlasMatrix);
function original(side,kind,structure){
  const f=source.files.find(f=>f.side===side&&f.kind===kind&&f.structure===structure);assert.ok(f);
  const b=read(path.join(root,f.file));assert.equal(sha(b),f.sha256);
  const g=loader.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));g.scale(.001,.001,.001);g.deleteAttribute('normal');
  const merged=mergeVertices(g,1e-9);g.dispose();return finish(merged);
}
const select=(a,n)=>a.length<=n?a:Array.from({length:n},(_,i)=>a[Math.floor(i*(a.length-1)/(n-1))]);
function distances(g,target,ids=referencedVertices(g,Infinity)){
  const d=ids.map(i=>target.boundsTree.closestPointToPoint(point.fromBufferAttribute(g.attributes.position,i)).distance*1000).sort((a,b)=>a-b);
  assert.ok(d.length);return {vertices:d.length,minimumMm:d[0],medianMm:d[Math.floor(d.length*.5)],p95Mm:d[Math.floor(d.length*.95)],maximumMm:d.at(-1)};
}
const options={kneeHalfBandMm:70,samplesPerGroup:400,maximumIterations:160,convergenceDeltaMetres:1e-9,scaleBounds:[.8,1.2]};
const report={createdAt:new Date().toISOString(),status:'OFFLINE INITIAL-FRAME EXPERIMENT; NO RUNTIME EXPORT',options,sides:[],evaluations:[],limitations:[
  'Knee region is a fixed geometric Y band in the prior whole-leg pose, not an anatomical landmark assignment.',
  'Closest-surface fits are one-way, equally sampled by group rather than area; two seeds are not a global-optimum search.',
  'The HRA Femur is its full 16-piece published hierarchy, including cartilage/attachment surfaces, not exclusively bone tissue.',
  'Same-side common similarity preserves source relationships in real arithmetic but does not certify attachments to fixed HRA or the other side.',
  'Current-runtime crossings use simplified baseline geometry. Full-source legacy and new poses are distinguished in skin and pair comparisons.',
  'Skin containment, surface crossing and held-out ligament distances are numerical screens, not anatomical or clinical approval.',
  'All 50 thigh/shank muscles are tested including normally hidden meshes; 26 hip muscles and all other overview tissues stay fixed. Separate CT/male details are not included.'
]};
const muscles=source.muscles.filter(m=>m.fitGroup.endsWith('-thigh')||m.fitGroup.endsWith('-shank')).map(m=>{
  const p=packing.parts.find(p=>p.id===m.id);assert.ok(p);const g=finish(decoded(raw,p));assert.equal(referencedVertices(g,Infinity).length,p.vertexCount);
  return {...m,side:m.fitGroup.split('-')[0],raw:g,legacy:finish(g.clone().applyMatrix4(legacyMatrix(m.fitGroup)))};
});assert.equal(muscles.length,50);
const calf=new Set(json('docs/anatomy-alignment/calf-bone-fixed.json').binary.parts.map(p=>p.id));
for(const side of ['left','right']){
  const bones=['Femur','Patella','Tibia','Fibula'].map(name=>{
    const members=membership.targets.find(t=>t.side===side&&t.bone===name).members;
    return {name,raw:original(side,'bone',name),target:finish(mergeGeometries(members.map(p=>runtimeMap.get(p.id).g))),targetIds:members.map(p=>p.id)};
  });
  const initial=previousMatrix(side,'whole-leg'),kneeY=bones.find(b=>b.name==='Tibia').target.boundingBox.max.y,band=[kneeY-.07,kneeY+.07];
  const groups=bones.map(b=>{
    const ids=referencedVertices(b.raw,Infinity).filter(i=>{const y=point.fromBufferAttribute(b.raw.attributes.position,i).applyMatrix4(initial).y;return y>=band[0]&&y<=band[1];});
    assert.ok(ids.length>=options.samplesPerGroup);
    return {name:`${b.name}-knee`,bone:b,eligible:ids.length,indices:select(ids,options.samplesPerGroup),allIndices:ids};
  });
  const fullGroups=bones.filter(b=>b.name!=='Patella').map(b=>{const ids=referencedVertices(b.raw,Infinity);return {name:`${b.name}-full`,bone:b,eligible:ids.length,indices:select(ids,options.samplesPerGroup)};});
  const row={side,kneeBandMetres:band,selectionFrame:initial.toArray(),groups:[...groups,...fullGroups].map(({name,eligible,indices})=>({name,eligible,indices})),fits:[],frames:[]};
  for(const mode of ['knee-only','knee-balanced','knee-fixed-scale'])for(const seed of ['shank','whole-leg']){
    const chosen=mode==='knee-balanced'?[...groups,...fullGroups]:groups,samples=chosen.flatMap(g=>g.indices.map(i=>({p:new Vector3().fromBufferAttribute(g.bone.raw.attributes.position,i),bone:g.bone}))),transform=previousMatrix(side,seed),history=[];
    const fixedScale=Math.cbrt(initial.determinant());
    if(mode==='knee-fixed-scale'){
      const mean=samples.reduce((p,s)=>p.add(s.p),new Vector3()).multiplyScalar(1/samples.length),oldMean=mean.clone().applyMatrix4(transform),ratio=fixedScale/Math.cbrt(transform.determinant());
      transform.scale(new Vector3(ratio,ratio,ratio));const shift=oldMean.sub(mean.clone().applyMatrix4(transform));transform.elements[12]+=shift.x;transform.elements[13]+=shift.y;transform.elements[14]+=shift.z;
    }
    let previous=Infinity,termination='iteration-limit';
    const measure=()=>Math.sqrt(samples.reduce((n,s)=>n+s.bone.target.boundsTree.closestPointToPoint(s.p.clone().applyMatrix4(transform)).distance**2,0)/samples.length);
    for(let i=0;i<options.maximumIterations;i++){
      const from=[],onto=[];let sum=0;
      for(const s of samples){const p=s.p.clone().applyMatrix4(transform),hit=s.bone.target.boundsTree.closestPointToPoint(p);from.push(p);onto.push(hit.point.clone());sum+=hit.distance**2;}
      const rms=Math.sqrt(sum/samples.length);assert.ok(rms<=previous+1e-10);history.push(rms*1000);
      if(Math.abs(previous-rms)<options.convergenceDeltaMetres){termination='rms-delta';break;}previous=rms;
      transform.premultiply(mode==='knee-fixed-scale'?fitRigid(from,onto):fitSimilarity(from,onto));const scale=Math.cbrt(transform.determinant());assert.ok(scale>=.8&&scale<=1.2);
      if(mode==='knee-fixed-scale')assert.ok(Math.abs(scale-fixedScale)<1e-12);
    }
    row.fits.push({mode,seed,samples:samples.length,termination,historyMm:history,finalRmsMm:1000*measure(),matrix:transform.toArray(),scale:Math.cbrt(transform.determinant())});
  }
  const frames=[['calf-common',previousMatrix(side,'shank')],['whole-leg',initial],...['knee-only','knee-balanced','knee-fixed-scale'].map(mode=>[mode,new Matrix4().fromArray(row.fits.filter(f=>f.mode===mode).toSorted((a,b)=>a.finalRmsMm-b.finalRmsMm)[0].matrix)])];
  const ligamentIds=side==='left'?{ACL:'HRAF0934',PCL:'HRAF0935',MCL:'HRAF0933',LCL:'HRAF0931'}:{ACL:'HRAF0905',PCL:'HRAF0906',MCL:'HRAF0904',LCL:'HRAF0908'};
  const ligaments=Object.entries(ligamentIds).map(([name,id])=>({name,id,raw:original(side,'ligament',name),target:runtimeMap.get(id).g}));
  for(const [mode,transform] of frames){
    const frame={mode,matrix:transform.toArray(),bones:[],ligaments:[]};
    for(const b of bones){
      const g=finish(b.raw.clone().applyMatrix4(transform));frame.bones.push({name:b.name,targetIds:b.targetIds,forward:distances(g,b.target),reverse:distances(b.target,g),kneeForward:distances(g,b.target,groups.find(g=>g.bone===b).allIndices)});g.dispose();
    }
    for(const l of ligaments){const g=finish(l.raw.clone().applyMatrix4(transform));frame.ligaments.push({name:l.name,id:l.id,forward:distances(g,l.target),reverse:distances(l.target,g)});g.dispose();}
    row.frames.push(frame);
  }
  report.sides.push(row);console.log(JSON.stringify({side,fits:row.fits.map(({mode,seed,termination,finalRmsMm,scale})=>({mode,seed,termination,finalRmsMm,scale}))}));
  bones.forEach(b=>{b.raw.dispose();b.target.dispose();});ligaments.forEach(l=>l.raw.dispose());
}
const skin=runtimeMap.get('HRAF0003'),probe=surfaceProbe(skin.g,.002),changedIds=new Set(muscles.map(m=>m.id));
const tally=()=>({inside:0,outside:0,'surface-band':0,ambiguous:0,maximumOutsideMm:0}),count=(r,c)=>{r[c.kind]++;if(c.kind==='outside')r.maximumOutsideMm=Math.max(r.maximumOutsideMm,c.distance*1000);};
const baseline=new Map(),legacySkin=new Map();
for(const m of muscles){const rows=[];for(let i=0;i<m.legacy.attributes.position.count;i++)rows.push(probe.classify(point.fromBufferAttribute(m.legacy.attributes.position,i)));legacySkin.set(m.id,rows);}
const crosses=(a,b)=>a.boundingBox.intersectsBox(b.boundingBox)&&a.boundsTree.intersectsGeometry(b,new Matrix4());
const legacyMap=new Map(muscles.map(m=>[m.id,m.legacy]));
const muscleMap=new Map(muscles.map(m=>[m.id,m]));
for(let i=0;i<runtime.length;i++)for(let j=i+1;j<runtime.length;j++){
  const a=runtime[i],b=runtime[j];if(!changedIds.has(a.id)&&!changedIds.has(b.id))continue;
  const ma=muscleMap.get(a.id),mb=muscleMap.get(b.id);
  baseline.set(`${a.id}/${b.id}`,{current:crosses(a.g,b.g),legacy:crosses(legacyMap.get(a.id)||a.g,legacyMap.get(b.id)||b.g),sourceSameSide:ma&&mb&&ma.side===mb.side?crosses(ma.raw,mb.raw):null});
}
assert.equal(baseline.size,50*1170+50*49/2);
for(const mode of ['calf-common','whole-leg','knee-only','knee-balanced','knee-fixed-scale']){
  const moved=new Map(),evaluation={mode,muscles:[],relations:[],summary:{uniquePairs:baseline.size,currentPairs:0,legacyPairs:0,afterPairs:0,newCurrentPairs:0,newLegacyPairs:0,removedCurrentPairs:0,removedLegacyPairs:0,newCurrentByOtherLayer:{},newLegacyByOtherLayer:{}}};
  for(const m of muscles){
    const frame=report.sides.find(s=>s.side===m.side).frames.find(f=>f.mode===mode);
    const transform=mode==='calf-common'&&!calf.has(m.id)?legacyMatrix(m.fitGroup):new Matrix4().fromArray(frame.matrix),g=finish(m.raw.clone().applyMatrix4(transform));moved.set(m.id,g);
    const r={id:m.id,name:m.name,side:m.side,matrix:transform.toArray(),vertices:g.attributes.position.count,indexReferences:g.index.count,positionsSha256:bufferHash(g.attributes.position.array),indicesSha256:bufferHash(g.index.array),legacy:tally(),after:tally(),newOutside:0,worsenedOutside:0};
    for(let i=0;i<r.vertices;i++){const a=legacySkin.get(m.id)[i],b=probe.classify(point.fromBufferAttribute(g.attributes.position,i));count(r.legacy,a);count(r.after,b);r.newOutside+=b.kind==='outside'&&a.kind!=='outside';r.worsenedOutside+=a.kind==='outside'&&b.kind==='outside'&&b.distance>a.distance+1e-6;}
    evaluation.muscles.push(r);
  }
  for(let i=0;i<runtime.length;i++)for(let j=i+1;j<runtime.length;j++){
    const a=runtime[i],b=runtime[j];if(!changedIds.has(a.id)&&!changedIds.has(b.id))continue;
    const before=baseline.get(`${a.id}/${b.id}`),afterA=moved.get(a.id)||a.g,afterB=moved.get(b.id)||b.g,after=crosses(afterA,afterB),s=evaluation.summary;
    s.currentPairs+=before.current;s.legacyPairs+=before.legacy;s.afterPairs+=after;s.newCurrentPairs+=!before.current&&after;s.newLegacyPairs+=!before.legacy&&after;s.removedCurrentPairs+=before.current&&!after;s.removedLegacyPairs+=before.legacy&&!after;
    // Preserve raw-source-only crossings too, so a removed source relation
    // cannot disappear from the evidence merely because both baselines lack it.
    if(!before.current&&!before.legacy&&!after&&!before.sourceSameSide)continue;
    const bothChanged=changedIds.has(a.id)&&changedIds.has(b.id),r={ids:[a.id,b.id],names:[a.name,b.name],layers:[a.layer,b.layer],bothChanged,...before,after};
    if(after&&(!before.current||!before.legacy)){
      r.crossing=triangleCrossings(afterA,afterB);r.witness=meshCrossingWitness(afterA,afterB);
      if(r.crossing.strictPlaneStraddlingPairs>0)assert.ok(r.witness);
      const layer=bothChanged?'changed-muscle-pair':changedIds.has(a.id)?b.layer:a.layer;
      if(!before.current)s.newCurrentByOtherLayer[layer]=(s.newCurrentByOtherLayer[layer]||0)+1;
      if(!before.legacy)s.newLegacyByOtherLayer[layer]=(s.newLegacyByOtherLayer[layer]||0)+1;
    }
    evaluation.relations.push(r);
  }
  evaluation.summary.vertices=evaluation.muscles.reduce((n,m)=>n+m.vertices,0);
  for(const key of ['newOutside','worsenedOutside'])evaluation.summary[key]=evaluation.muscles.reduce((n,m)=>n+m[key],0);
  evaluation.summary.legacyOutside=evaluation.muscles.reduce((n,m)=>n+m.legacy.outside,0);evaluation.summary.afterOutside=evaluation.muscles.reduce((n,m)=>n+m.after.outside,0);evaluation.summary.ambiguous=evaluation.muscles.reduce((n,m)=>n+m.after.ambiguous,0);
  report.evaluations.push(evaluation);moved.forEach(g=>g.dispose());console.log(JSON.stringify({mode,...evaluation.summary}));fs.writeFileSync(`${out}/report.partial.json`,JSON.stringify(report,null,2)+'\n');
}
for(const p of ['scripts/experiment-knee-initial.mjs','scripts/lib/similarity-fit.mjs','scripts/lib/rigid-fit.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-crossings.mjs','scripts/lib/triangle-witness.mjs','src/female-arm-registration.ts','src/female-foot-registration.ts','src/female-source-restoration.ts','src/female-brain-bindings.ts','data/catalog/female-arm-registration.json','data/catalog/female-foot-registration.json','data/catalog/female-brain-bindings.json','package-lock.json'])read(p);
report.files=[...files].map(([file,sha256])=>({file,sha256}));fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');
probe.dispose();runtime.forEach(p=>p.g.dispose());muscles.forEach(m=>{m.raw.dispose();m.legacy.dispose();});
