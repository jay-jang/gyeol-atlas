// Candidate-only hip fit. Verify official pelvis component provenance first.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Quaternion,Vector3,Box3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {fitSimilarity} from './lib/similarity-fit.mjs';
import {referencedVertices} from './lib/surface-containment.mjs';

const root=process.argv[2];assert.ok(root,'Pass extracted donor STL directory');
const files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>{const b=fs.readFileSync(p);files.set(p,sha(b));return b;},json=p=>JSON.parse(read(p));
const atlas=json('public/models/female/atlas-female.json'),source=json('docs/anatomy-alignment/donor-source-comparison.json');
for(const f of json('data/catalog/female-atlas-source.json').files)assert.equal(sha(read(f.path)),f.sha256);
const reference=json('docs/anatomy-alignment/hra-brain-source.json'),shift=reference.translationFromSkin;
const oldPath='.cache/hip-registration/hra-united-female-v1.5.glb',newPath='.cache/neural-bone/hra-united-female-v1.10.glb';
assert.equal(sha(read(oldPath)),'472567a56896b9b7890508da6501fbf858e56aaa30745365f7a71ade782b529c');
assert.equal(sha(read(newPath)),reference.files.find(f=>f.path===newPath).sha256);
const wanted=new Set(['ilium','pubis','ischium'].flatMap(bone=>['compact','spongy'].flatMap(tissue=>['L','R'].map(side=>`VH_F_${bone}_${tissue}_bone_${side}`))));
function official(file){
  const bytes=read(file);assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const length=bytes.readUInt32LE(12);assert.equal(bytes.readUInt32LE(16),0x4e4f534a);
  const gltf=JSON.parse(bytes.subarray(20,20+length)),start=20+length;assert.equal(bytes.readUInt32LE(start+4),0x004e4942);
  const bin=bytes.subarray(start+8,start+8+bytes.readUInt32LE(start)),out=[];
  function accessor(index,type){
    const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView];assert.equal(a.type,type);assert.ok(!a.sparse);assert.equal(v.buffer||0,0);
    const width={5121:1,5123:2,5125:4,5126:4}[a.componentType];assert.ok(width);
    const components=type==='VEC3'?3:1,offset=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||width*components;
    const get={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType];
    return {count:a.count,values:Array.from({length:a.count*components},(_,i)=>bin[get](offset+Math.floor(i/components)*stride+(i%components)*width))};
  }
  function walk(index,parent,ancestry){
    const n=gltf.nodes[index],local=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3(...(n.translation||[0,0,0])),new Quaternion(...(n.rotation||[0,0,0,1])),new Vector3(...(n.scale||[1,1,1])));
    const world=parent.clone().multiply(local),chain=[...ancestry,n.name||`node:${index}`];
    if(wanted.has(n.name)){
      assert.equal(gltf.meshes[n.mesh].primitives.length,1);const p=gltf.meshes[n.mesh].primitives[0];assert.equal(p.mode??4,4);
      const a=accessor(p.attributes.POSITION,'VEC3'),indices=p.indices===undefined?Array.from({length:a.count},(_,i)=>i):accessor(p.indices,'SCALAR').values;
      const positions=new Float32Array(a.values.length),box=new Box3(),point=new Vector3();
      for(let i=0;i<a.count;i++){point.fromArray(a.values,i*3).applyMatrix4(world).add(new Vector3(...shift));box.expandByPoint(point);point.toArray(positions,i*3);}
      const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(positions,3));g.setIndex(indices);
      out.push({name:n.name,nodeIndex:index,ancestry:chain,worldMatrix:world.toArray(),bounds:[box.min.toArray(),box.max.toArray()],geometry:g});
    }
    for(const child of n.children||[])walk(child,world,chain);
  }
  for(const node of gltf.scenes[gltf.scene||0].nodes)walk(node,new Matrix4(),[]);return out;
}
const previous=official(oldPath),current=official(newPath);assert.equal(previous.length,12);assert.equal(current.length,4);
const ensure=g=>g.boundsTree||(g.boundsTree=new MeshBVH(g)),point=new Vector3();
function distances(g,target){
  ensure(target);const values=referencedVertices(g,Infinity).map(i=>target.boundsTree.closestPointToPoint(point.fromBufferAttribute(g.attributes.position,i)).distance*1000).sort((a,b)=>a-b);
  return {vertices:values.length,meanMm:values.reduce((a,b)=>a+b,0)/values.length,p95Mm:values[Math.floor(values.length*.95)],maximumMm:values.at(-1)};
}
const versionComparison=current.map(c=>{
  const old=previous.find(p=>p.name===c.name);assert.ok(old);
  const forward=distances(old.geometry,c.geometry),reverse=distances(c.geometry,old.geometry);
  assert.ok(forward.maximumMm<.001&&reverse.maximumMm<.001,'Shared ilium coordinates differ between versions');
  return {name:c.name,forward,reverse};
});
const buffers=atlas.chunks.map(c=>gunzipSync(read(`public/models/female/${c.gzip.split('/').pop()}`)));
const parts=previous.map(p=>{
  const conceptId=`HRA:${p.name.replace(/^VH_F_/,'')}`,matches=atlas.parts.filter(a=>a.conceptId===conceptId);assert.equal(matches.length,1);const part=matches[0];
  const boundResidualMm=Math.max(...p.bounds.flatMap((b,i)=>b.map((v,j)=>Math.abs(v-part.bounds[i][j])*1000)));assert.ok(boundResidualMm<.01,part.id);
  const b=buffers[part.chunk],g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>b.readFloatLE(part.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>b.readUInt32LE(part.indices+4*i)),1));
  return {part,geometry:g,source:{id:part.id,name:part.name,conceptId,sourceName:p.name,nodeIndex:p.nodeIndex,ancestry:p.ancestry,worldMatrix:p.worldMatrix,bounds:p.bounds,boundResidualMm,sourceToPacked:distances(p.geometry,g),packedToSource:distances(g,p.geometry)}};
});
const fits=[];
for(const side of ['left','right']){
  const f=source.files.find(f=>f.side===side&&f.kind==='bone'&&f.structure==='Pelvis');assert.ok(f);
  const bytes=read(path.join(root,f.file));assert.equal(sha(bytes),f.sha256);
  const raw=new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));raw.scale(.001,.001,.001);raw.deleteAttribute('normal');
  const donor=mergeVertices(raw,1e-8);raw.dispose();
  const members=parts.filter(p=>p.part.conceptId.endsWith(side==='left'?'_L':'_R'));assert.equal(members.length,6);
  const target=mergeGeometries(members.map(p=>p.geometry));ensure(target);
  const initial=source.fits[`${side}-hip`],r=initial.rows,s=initial.scale,t=initial.offset;
  const transform=new Matrix4().set(...r[0].map(v=>v*s),t[0],...r[1].map(v=>v*s),t[1],...r[2].map(v=>v*s),t[2],0,0,0,1),before=donor.clone().applyMatrix4(transform);
  const samples=referencedVertices(donor,5000).map(i=>new Vector3().fromBufferAttribute(donor.attributes.position,i)),history=[];
  let previousRms=Infinity,converged=false;
  for(let iteration=0;iteration<120;iteration++){
    const from=[],onto=[];let error=0;
    for(const sample of samples){const p=sample.clone().applyMatrix4(transform),near=target.boundsTree.closestPointToPoint(p);from.push(p);onto.push(near.point.clone());error+=near.distance**2;}
    const rms=Math.sqrt(error/samples.length);history.push(rms*1000);
    if(Math.abs(previousRms-rms)<1e-8){converged=true;break;}previousRms=rms;
    transform.premultiply(fitSimilarity(from,onto));const scale=Math.cbrt(transform.determinant());assert.ok(scale>.8&&scale<1.2);
  }
  const after=donor.clone().applyMatrix4(transform);
  const finalSampleRmsMm=Math.sqrt(samples.reduce((s,p)=>s+target.boundsTree.closestPointToPoint(p.clone().applyMatrix4(transform)).distance**2,0)/samples.length)*1000;
  const row={side,mode:'hip',sourceFile:f.file,targetIds:members.map(p=>p.part.id),samples:samples.length,converged,iterations:history.length,sampleRmsMm:history,finalSampleRmsMm,sourceToAtlasMatrix:transform.toArray(),before:{forward:distances(before,target),reverse:distances(target,before)},after:{forward:distances(after,target),reverse:distances(target,after)},components:members.map(p=>({id:p.part.id,name:p.part.name,after:distances(p.geometry,after)}))};
  fits.push(row);console.log(JSON.stringify(row));donor.dispose();target.dispose();before.dispose();after.dispose();
}
for(const p of ['scripts/fit-donor-hip-surfaces.mjs','scripts/lib/similarity-fit.mjs','scripts/lib/surface-containment.mjs','package-lock.json'])read(p);
const report={status:'HIP SURFACE FIT CANDIDATES ONLY; no runtime export',sourceUrl:'https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.5/assets/3d-vh-f-united.glb',translationFromSkin:shift,versionComparison,targetComponents:parts.map(p=>p.source),fits,
  limitations:['Six source-labelled compact/spongy components per side form the correspondence target; not one undifferentiated bone-only surface claim.',
    'Version comparison measures all indexed shared ilium vertices in both directions, not all skeletal structures.',
    'ICP samples are deterministic indexed source pelvis vertices, not anatomical landmarks or area-uniform samples.',
    'All referenced vertex distances are measured, but not continuous triangle-interior Hausdorff bounds or clinical accuracy.',
    'A lower pelvis residual does not authorize muscle placement; no muscle or skin coordinate is changed by this script.'],files:[...files].map(([path,sha256])=>({path,sha256}))};
fs.writeFileSync('.cache/hip-registration/hip-surface-fits.json',JSON.stringify(report,null,2)+'\n');
for(const p of [...previous,...current,...parts])p.geometry.dispose();
