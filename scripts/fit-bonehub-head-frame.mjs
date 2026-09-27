// Offline diagnostic: one cervical-derived transform for the entire native head.
// C2-C7 train; C1 is held out. No skin/brain/skull feedback in the objective.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3,Quaternion} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {MeshBVH} from 'three-mesh-bvh';
import {exactPositionComponents} from './lib/exact-position-components.mjs';
import {fitSimilarity} from './lib/similarity-fit.mjs';
import {resolveFemaleBrainGeometryPart} from '../src/female-brain-bindings.ts';
const out='.cache/bonehub-head';fs.mkdirSync(out,{recursive:true});
const files=new Map(),hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=f=>{const b=fs.readFileSync(f);files.set(f,hash(b));return b;},read=f=>JSON.parse(bytes(f));
const inventory=read('docs/anatomy-alignment/bonehub-female-inventory.json'),receipt=read('docs/anatomy-alignment/bonehub-female-receipt.json');
const atlas=read('public/models/female/atlas-female.json'),catalog=read('data/female-atlas-structures.json');
const manifest=read('data/catalog/female-atlas-source.json');for(const f of manifest.files)assert.equal(hash(bytes(f.path)),f.sha256,f.path);
const byId=new Map(atlas.parts.map(p=>[p.id,p])),chunks=new Map(),rows=[];
const pack=(g,metadata)=>({...metadata,positions:Array.from(g.attributes.position.array),indices:Array.from(g.index.array)});
function target(id,kind){
  const p=byId.get(id);assert.ok(p,id);const q=resolveFemaleBrainGeometryPart(p,'female',byId);
  if(!chunks.has(q.chunk)){const c=atlas.chunks[q.chunk],b=bytes(`public/models/female/${c.gzip.split('/').pop()}`);assert.equal(b.length,c.gzipBytes);const raw=gunzipSync(b);assert.equal(raw.length,c.bytes);chunks.set(q.chunk,raw);}
  const b=chunks.get(q.chunk),g=new BufferGeometry().setAttribute('position',new BufferAttribute(Float32Array.from({length:q.vertexCount*3},(_,i)=>b.readFloatLE(q.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:q.indexCount},(_,i)=>b.readUInt32LE(q.indices+4*i)),1));g.computeBoundingBox();
  // This scope deliberately excludes registered arms/feet/restored ilium.
  rows.push(pack(g,{id,name:p.name,kind,sourceSystem:p.system,sourceGeometryId:q.id}));return g;
}
function source(name){
  const p=inventory.parts.find(p=>p.name===name);assert.ok(p,name);const f=receipt.files.find(f=>f.path===p.file);assert.ok(f);
  const b=bytes(f.local);assert.equal(hash(b),p.sha256);const raw=new STLLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
  assert.equal(raw.attributes.position.count,p.triangles*3);
  const {geometry:g,components}=exactPositionComponents(raw);raw.dispose();g.scale(.001,.001,.001);g.computeBoundingBox();
  rows.push(pack(g,{id:name,name,kind:'source',sourceFile:f.local,sha256:p.sha256,components,sourceUnits:'LPS mm converted to Float32 metres'}));return g;
}
const center=g=>g.boundingBox.getCenter(new Vector3());
const indices=g=>Array.from({length:Math.min(1024,g.attributes.position.count)},(_,i)=>Math.floor(i*(g.attributes.position.count-1)/(Math.min(1024,g.attributes.position.count)-1)));
const pairs=Array.from({length:7},(_,i)=>{
  const name=`VERTEBRA_C${i+1}`,id=`HRAF${String(843+i).padStart(4,'0')}`,s=source(name),t=target(id,'target'),sc=s.clone(),tc=t.clone();
  return {name,id,source:s,target:t,sc,tc,st:new MeshBVH(sc),tt:new MeshBVH(tc),si:indices(s),ti:indices(t),training:i!==0};
});
source('SKULL_CRANIAL_MAXILLA');source('SKULL_MANDIBLE');target('HRAF0003','skin');
const neural=catalog.filter(p=>p.layer==='nerve');assert.equal(neural.length,362);for(const p of neural)target(p.id,'neural');
// Eighteen borrowed cranial/mandibular bones; hyoids/nasal cartilage excluded.
const borrowed=['BM0003','BM0004',...Array.from({length:16},(_,i)=>`BM${String(6+i).padStart(4,'0')}`)];
for(const id of borrowed)target(id,'borrowed');
const train=pairs.filter(p=>p.training),mean=p=>p.reduce((s,p)=>s.add(p),new Vector3()).multiplyScalar(1/p.length);
for(const p of pairs){assert.equal(p.si.length,1024);assert.equal(p.ti.length,1024);}
// LPS x(left),y(posterior),z(superior) -> atlas x(left),y(superior),z(anterior).
const axis=new Matrix4().set(1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1);
assert.equal(axis.determinant(),1);
const offset=mean(train.map(p=>center(p.target))).sub(mean(train.map(p=>center(p.source).applyMatrix4(axis))));
const initial=new Matrix4().makeTranslation(...offset.toArray()).multiply(axis);
function fitRigid(from,onto){
  const q=new Quaternion(),translation=new Vector3(),scale=new Vector3();fitSimilarity(from,onto).decompose(translation,q,scale);
  return new Matrix4().compose(mean(onto).sub(mean(from).applyQuaternion(q)),q,new Vector3(1,1,1));
}
function residual(a,b,matrix){
  const copy=b.clone(),tree=new MeshBVH(copy),values=[];let squares=0;const point=new Vector3();
  for(let i=0;i<a.attributes.position.count;i++){point.fromBufferAttribute(a.attributes.position,i);if(matrix)point.applyMatrix4(matrix);const d=tree.closestPointToPoint(point).distance*1000;values.push(d);squares+=d*d;}
  values.sort((a,b)=>a-b);copy.dispose();return {vertices:values.length,p95Mm:values[Math.floor((values.length-1)*.95)],maxMm:values.at(-1),rmsMm:Math.sqrt(squares/values.length)};
}
const candidates=[];
for(const mode of ['initial','rigid','similarity']){
  let matrix=initial.clone();const iterations=[];
  if(mode!=='initial')for(let iteration=0;iteration<240;iteration++){
    const from=[],onto=[],inverse=matrix.clone().invert();
    for(const p of train){
      const forward=p.si.map(i=>{const a=new Vector3().fromBufferAttribute(p.source.attributes.position,i),q=p.tt.closestPointToPoint(a.clone().applyMatrix4(matrix));return {a,b:q.point.clone(),distance:q.distance};});
      const reverse=p.ti.map(i=>{const b=new Vector3().fromBufferAttribute(p.target.attributes.position,i),q=p.st.closestPointToPoint(b.clone().applyMatrix4(inverse));return {a:q.point.clone(),b,distance:q.point.clone().applyMatrix4(matrix).distanceTo(b)};});
      // Each source/target has >=1024 vertices, asserted above. Equal counts
      // per direction and bone do not imply equal surface-area weighting.
      for(const matches of [forward,reverse])for(const m of matches.sort((a,b)=>a.distance-b.distance).slice(0,Math.floor(matches.length*.8))){from.push(m.a);onto.push(m.b);}
    }
    const next=(mode==='rigid'?fitRigid:fitSimilarity)(from,onto);let delta=0;
    for(const p of train)for(const i of p.si){const a=new Vector3().fromBufferAttribute(p.source.attributes.position,i);delta=Math.max(delta,a.clone().applyMatrix4(matrix).distanceTo(a.applyMatrix4(next)));}
    matrix=next;iterations.push({iteration,maximumSampleChangeMm:delta*1000,uniformScale:Math.cbrt(matrix.determinant()),matches:from.length});if(delta<1e-8)break;
  }
  const bones=pairs.map(p=>{const placed=p.source.clone().applyMatrix4(matrix);const row={sourceName:p.name,targetId:p.id,training:p.training,sourceSamples:p.si.length,targetSamples:p.ti.length,forward:residual(p.source,p.target,matrix),reverse:residual(p.target,placed)};placed.dispose();return row;});
  candidates.push({mode,matrixColumnMajor:matrix.toArray(),uniformScale:Math.cbrt(matrix.determinant()),iterations,stopReason:mode==='initial'?'initial only':iterations.at(-1).maximumSampleChangeMm<.00001?'sample-change threshold':'iteration limit',bones});
  console.log(JSON.stringify({mode,iterations:iterations.length,scale:Math.cbrt(matrix.determinant()),bones: bones.map(p=>({name:p.sourceName,training:p.training,forward:p.forward.p95Mm,reverse:p.reverse.p95Mm}))}));
}
const partFile=`${out}/parts.json.gz`;fs.writeFileSync(partFile,gzipSync(JSON.stringify(rows)));bytes(partFile);
for(const f of ['scripts/fit-bonehub-head-frame.mjs','scripts/lib/similarity-fit.mjs','scripts/lib/exact-position-components.mjs','src/female-brain-bindings.ts','data/catalog/female-brain-bindings.json','package-lock.json'])bytes(f);
fs.writeFileSync(`${out}/frame.json`,JSON.stringify({createdAt:new Date().toISOString(),status:'OFFLINE cervical frame diagnostic; no runtime export or anatomical approval',sourceRevision:inventory.revision,
  sourceUnits:'source STL millimetres -> Float32 metres once, then candidate matrix',sampling:'Exactly 1024 deterministic vertex-index samples per bone/direction, closest 819 retained; equal counts but not uniform surface-area sampling',
  heldOut:'C1 never participates in initialization translation or ICP',borrowedSkullIds:borrowed,neuralMeshes:neural.length,parts:partFile,candidates,
  limitations:['Low-resolution HRA cervical surfaces are not clinical landmarks. ICP termination is not global optimality.',
    'Skull cranium/maxilla and mandible are two source labels, not equivalent membership to eighteen separate borrowed bones; no individual bone/FMA labels are inferred.',
    'Skin/brain/neural checks are not part of the fitting objective and must be evaluated separately. No source fragments are removed.',
    'No arm/foot/ilium geometry is loaded; these parts need runtime-specific transforms outside this head scope.'],files:[...files].map(([file,sha256])=>({file,sha256}))},null,2)+'\n');
