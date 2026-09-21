// One shared similarity transform for the original lower-body envelope, bones
// and muscles. Diagnostic candidate only; never changes public atlas geometry.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeVertices,mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {fitSimilarity} from './lib/similarity-fit.mjs';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';

const [originalRoot,finalRoot]=process.argv.slice(2);assert.ok(finalRoot,'Pass original extraction root and Final STL root');
const files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>{const b=fs.readFileSync(p);files.set(p,sha(b));return b;};
const json=p=>JSON.parse(read(p));
const receipt=json('docs/anatomy-alignment/donor-original-receipt.json');
const source=json('docs/anatomy-alignment/donor-source-comparison.json');
const membership=json('docs/anatomy-alignment/hra-bone-targets.json');
const hips=json('docs/anatomy-alignment/hip-surface-fits.json');
const atlas=json('public/models/female/atlas-female.json');
for(const f of json('data/catalog/female-atlas-source.json').files)assert.equal(sha(read(f.path)),f.sha256);
const chunks=atlas.chunks.map(c=>gunzipSync(read(`public/models/female/${path.basename(c.gzip)}`)));
function packedGeometry(part){
  const data=chunks[part.chunk],g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>data.readFloatLE(part.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>data.readUInt32LE(part.indices+4*i)),1));return g;
}
function stl(file,expected){
  const data=read(file);assert.equal(sha(data),expected);
  const raw=new STLLoader().parse(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
  raw.scale(.001,.001,.001);raw.deleteAttribute('normal');const g=mergeVertices(raw,1e-9);raw.dispose();return g;
}
const envelopeRecord=receipt.combined.find(r=>r.entry.endsWith('/VHF_Both_All.stl'));
const envelope=stl(path.join(originalRoot,envelopeRecord.entry),envelopeRecord.sha256);envelope.computeBoundingBox();
assert.equal(envelope.attributes.position.count,326280,'Welding must retain the previously measured unique source vertices');
const skinPart=atlas.parts.find(p=>p.id==='HRAF0003'),skin=packedGeometry(skinPart);skin.boundsTree=new MeshBVH(skin);
const point=new Vector3(),matrix=f=>new Matrix4().set(...f.rows[0].map(v=>v*f.scale),f.offset[0],...f.rows[1].map(v=>v*f.scale),f.offset[1],...f.rows[2].map(v=>v*f.scale),f.offset[2],0,0,0,1);
const initial=matrix(source.fits['left-hip']),transform=initial.clone();
// The raw scan's superior cut cap is not an anatomical skin surface. Exclude
// only this explicitly recorded 10mm source-Z strip from optimization, while
// retaining ALL vertices in final distance diagnostics below.
const cutZ=envelope.boundingBox.max.z-.01;
const eligible=referencedVertices(envelope,Infinity).filter(i=>envelope.attributes.position.getZ(i)<cutZ);
const selected=Array.from({length:5000},(_,i)=>eligible[Math.floor(i*(eligible.length-1)/4999)]);
assert.equal(new Set(selected).size,5000);
const samples=selected.map(i=>new Vector3().fromBufferAttribute(envelope.attributes.position,i));
const history=[];let previous=Infinity,converged=false;
for(let iteration=0;iteration<200;iteration++){
  const from=[],onto=[];let error=0;
  for(const sample of samples){
    const p=sample.clone().applyMatrix4(transform),nearest=skin.boundsTree.closestPointToPoint(p);
    from.push(p);onto.push(nearest.point.clone());error+=nearest.distance**2;
  }
  const rms=Math.sqrt(error/samples.length);history.push(rms*1000);
  if(iteration%10===0)console.log(JSON.stringify({iteration,rmsMm:rms*1000}));
  if(Math.abs(previous-rms)<1e-8){converged=true;break;}previous=rms;
  transform.premultiply(fitSimilarity(from,onto));
  const scale=Math.cbrt(transform.determinant());assert.ok(scale>.8&&scale<1.2,'Unstable scale');
}
function distances(geometry,target,placement=new Matrix4(),indices=referencedVertices(geometry,Infinity)){
  const values=[];let witness=null;
  for(const vertex of indices){
    point.fromBufferAttribute(geometry.attributes.position,vertex).applyMatrix4(placement);
    const nearest=target.boundsTree.closestPointToPoint(point),mm=nearest.distance*1000;values.push(mm);
    if(!witness||mm>witness.distanceMm)witness={vertex,pointMetres:point.toArray(),nearestMetres:nearest.point.toArray(),distanceMm:mm};
  }
  values.sort((a,b)=>a-b);return {vertices:values.length,medianMm:values[Math.floor(values.length*.5)],p95Mm:values[Math.floor(values.length*.95)],maximumMm:values.at(-1),maximumWitness:witness};
}
const envelopeDistances={allVerticesBefore:distances(envelope,skin,initial),allVerticesAfter:distances(envelope,skin,transform),
  fitEligibleBefore:distances(envelope,skin,initial,eligible),fitEligibleAfter:distances(envelope,skin,transform,eligible)};
console.log(JSON.stringify({converged,scale:Math.cbrt(transform.determinant()),envelopeDistances}));
const bones=[];
for(const side of ['left','right'])for(const name of ['Pelvis','Femur','Patella','Tibia','Fibula']){
  const record=source.files.find(f=>f.kind==='bone'&&f.structure===name&&f.side===side);assert.ok(record);
  const donor=stl(path.join(finalRoot,record.file),record.sha256);
  const ids=name==='Pelvis'?hips.fits.find(f=>f.side===side).targetIds:membership.targets.find(t=>t.side===side&&t.bone===name).members.map(p=>p.id);
  const pieces=ids.map(id=>packedGeometry(atlas.parts.find(p=>p.id===id))),target=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());target.boundsTree=new MeshBVH(target);
  const placed=donor.clone().applyMatrix4(transform);placed.boundsTree=new MeshBVH(placed);
  bones.push({side,name,targetIds:ids,sourceToTarget:distances(donor,target,transform),targetToSource:distances(target,placed)});
  donor.dispose();target.dispose();placed.dispose();
}
const packing=json('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative;
const compressed=read('.cache/donor-fidelity/source-full.bin.gz');assert.equal(sha(compressed),packing.sha256);
const data=gunzipSync(compressed),candidate=Buffer.from(data);assert.equal(data.length,packing.bytes);
const probe=surfaceProbe(skin),rows=[],beforePoint=new Vector3(),afterPoint=new Vector3();
const tally=()=>({inside:0,outside:0,'surface-band':0,ambiguous:0,maximumOutsideMm:0});
function count(row,c){row[c.kind]++;if(c.kind==='outside')row.maximumOutsideMm=Math.max(row.maximumOutsideMm,c.distance*1000);}
for(const part of packing.parts){
  const old=matrix(source.fits[source.muscles.find(m=>m.id===part.id).fitGroup]);
  const row={id:part.id,name:part.name,vertices:part.vertexCount,before:tally(),after:tally(),newOutside:0,worsenedOutside:0,resolvedOutside:0,maximumOutsideWitness:null};
  for(let vertex=0;vertex<part.vertexCount;vertex++){
    point.set(...[0,1,2].map(k=>data.readFloatLE(part.positions+4*(vertex*3+k))));
    beforePoint.copy(point).applyMatrix4(old);beforePoint.set(...beforePoint.toArray().map(Math.fround));
    afterPoint.copy(point).applyMatrix4(transform);afterPoint.set(...afterPoint.toArray().map(Math.fround));
    for(let k=0;k<3;k++)candidate.writeFloatLE(afterPoint.getComponent(k),part.positions+4*(vertex*3+k));
    const a=probe.classify(beforePoint),b=probe.classify(afterPoint);count(row.before,a);count(row.after,b);
    if(b.kind==='outside'&&a.kind!=='outside')row.newOutside++;
    if(b.kind==='outside'&&a.kind==='outside'&&b.distance>a.distance+1e-6)row.worsenedOutside++;
    if(b.kind!=='outside'&&a.kind==='outside')row.resolvedOutside++;
    if(b.kind==='outside'&&(!row.maximumOutsideWitness||b.distance*1000>row.maximumOutsideWitness.distanceMm))row.maximumOutsideWitness={vertex,sourcePointMetres:point.toArray(),candidatePointMetres:afterPoint.toArray(),distanceMm:b.distance*1000};
  }
  assert.equal(row.after.outside-row.before.outside,row.newOutside-row.resolvedOutside);rows.push(row);
}
const summary={meshes:rows.length,vertices:rows.reduce((n,r)=>n+r.vertices,0),beforeOutside:rows.reduce((n,r)=>n+r.before.outside,0),afterOutside:rows.reduce((n,r)=>n+r.after.outside,0),newOutside:rows.reduce((n,r)=>n+r.newOutside,0),worsenedOutside:rows.reduce((n,r)=>n+r.worsenedOutside,0),maximumOutsideMm:Math.max(...rows.map(r=>r.after.maximumOutsideMm))};
const finalSampleRmsMm=Math.sqrt(samples.reduce((n,p)=>n+skin.boundsTree.closestPointToPoint(p.clone().applyMatrix4(transform)).distance**2,0)/samples.length)*1000;
for(const file of ['scripts/fit-donor-envelope.mjs','scripts/lib/similarity-fit.mjs','scripts/lib/surface-containment.mjs','package-lock.json'])read(file);
const out='.cache/donor-envelope-fit';fs.mkdirSync(out,{recursive:true});const zipped=gzipSync(candidate);fs.writeFileSync(`${out}/candidate.bin.gz`,zipped);
const report={createdAt:new Date().toISOString(),status:summary.newOutside||summary.worsenedOutside||!converged?'REJECTED; NO RUNTIME EXPORT':'NOT APPROVED; further bone, tissue, attachment and visual validation required',
  method:'One proper similarity transform estimated from donor All envelope to HRA skin; same matrix applied to all 76 source muscles and 10 bone diagnostics',
  converged,iterations:history.length,sampleRmsMm:history,finalSampleRmsMm,sourceToAtlasMatrix:transform.toArray(),initialMatrix:initial.toArray(),scale:Math.cbrt(transform.determinant()),
  fitSelection:{samples:selected.length,eligibleVertices:eligible.length,totalVertices:envelope.attributes.position.count,excludedSuperiorStripMm:10,sourceZCutMetres:cutZ},
  envelopeDistances,bones,summary,rows,binary:{path:`${out}/candidate.bin.gz`,sha256:sha(zipped),gzipBytes:zipped.length,bytes:candidate.length,parts:packing.parts},
  limitations:['One-way local closest-surface fit, not labelled skin correspondence, area-uniform sampling, or a global optimum.',
    'The superior cut strip is excluded only from fitting; all source envelope vertices are retained in reported full distances.',
    'Bone composite surfaces include the original subpart/cartilage hierarchy. Bone residuals are independent diagnostics, not fit constraints.',
    'A common positive similarity preserves continuous source relationships mathematically; serialized Float32 perturbations and all tissue intersections still need separate checks.',
    'Lower skin error or fewer outside vertices cannot establish attachment, organ/nerve placement, or clinical validity.'],files:[...files].map(([file,sha256])=>({file,sha256}))};
fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,summary,bones:bones.map(b=>({side:b.side,name:b.name,forward95:b.sourceToTarget.p95Mm,reverse95:b.targetToSource.p95Mm}))}));
probe.dispose();skin.dispose();envelope.dispose();
