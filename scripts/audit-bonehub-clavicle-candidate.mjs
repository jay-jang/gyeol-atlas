// Offline held-out clavicle screen under the existing thoracic rigid map.
// No runtime geometry or clinical registration is created by this audit.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferAttribute,BufferGeometry,Matrix4,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {exactPositionComponents} from './lib/exact-position-components.mjs';
import {referencedVertices,surfaceProbe,surfaceTopology} from './lib/surface-containment.mjs';

const out='.cache/bonehub-clavicle';fs.mkdirSync(out,{recursive:true});
const files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=path=>{const b=fs.readFileSync(path);files.set(path,sha(b));return b;};
const read=path=>JSON.parse(bytes(path));
const atlas=read('public/models/female/atlas-female.json');
const source=read('data/catalog/female-atlas-source.json');
for(const file of source.files)assert.equal(sha(bytes(file.path)),file.sha256,file.path);
const receipt=read('docs/anatomy-alignment/bonehub-female-receipt.json');
const inventory=read('docs/anatomy-alignment/bonehub-female-inventory.json');
const thorax=read('docs/anatomy-alignment/bonehub-thorax-screen.json');
const airway=read('data/female-airway-groups.json')[0];
const rigid=thorax.candidates.find(c=>c.mode==='rigid');assert.ok(rigid);
const matrix=new Matrix4().fromArray(rigid.matrixColumnMajor);
const byId=new Map(atlas.parts.map(p=>[p.id,p])),buffers=new Map(),objects=[];
function packed(id){
  const part=byId.get(id);assert.ok(part,id);
  if(!buffers.has(part.chunk)){
    const chunk=atlas.chunks[part.chunk],b=bytes(`public/models/female/${chunk.gzip.split('/').pop()}`);
    assert.equal(b.length,chunk.gzipBytes);const raw=gunzipSync(b);assert.equal(raw.length,chunk.bytes);buffers.set(part.chunk,raw);
  }
  const b=buffers.get(part.chunk),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>b.readFloatLE(part.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>b.readUInt32LE(part.indices+4*i)),1));
  g.computeBoundingBox();g.boundsTree=new MeshBVH(g);objects.push(g);return g;
}
function donor(name){
  const part=inventory.parts.find(p=>p.name===name),file=receipt.files.find(f=>f.path===part?.file);
  assert.ok(part&&file,name);const b=bytes(file.local);assert.equal(sha(b),part.sha256);
  const raw=new STLLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
  assert.equal(raw.attributes.position.count,part.triangles*3);
  const {geometry:g}=exactPositionComponents(raw);raw.dispose();
  const a=g.attributes.position;
  for(let i=0;i<a.count;i++){
    const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
    a.setXYZ(i,Math.fround(x*.001),Math.fround(z*.001),Math.fround(-y*.001));
  }
  g.applyMatrix4(matrix);g.computeBoundingBox();g.boundsTree=new MeshBVH(g);objects.push(g);return g;
}
const skin=packed('HRAF0003'),topology=surfaceTopology(skin);
assert.deepEqual([topology.connectedComponents,topology.boundaryEdges,topology.nonManifoldEdges],[1,0,0]);
const probe=surfaceProbe(skin,.002),sternum=packed('HRAF0823');
const airwayMeshes=airway.ids.map(id=>({id,g:packed(id)}));
const relations=read('docs/anatomy-alignment/female-organ-bone-relations.json');
const point=new Vector3();
function crossing(a,b){return a.boundingBox.intersectsBox(b.boundingBox)&&a.boundsTree.intersectsGeometry(b,new Matrix4());}
function vertexDistance(from,to,indices){
  let min=Infinity;
  for(const i of indices){point.fromBufferAttribute(from.attributes.position,i);min=Math.min(min,to.boundsTree.closestPointToPoint(point).distance*1000);}
  return min;
}
function endIndices(g,side,end){
  const min=g.boundingBox.min.x,max=g.boundingBox.max.x,width=max-min;
  return referencedVertices(g,Infinity).filter(i=>{
    const x=g.attributes.position.getX(i),medial=side==='left'?x<=min+.15*width:x>=max-.15*width;
    return end==='medial'?medial:!medial&&(side==='left'?x>=max-.15*width:x<=min+.15*width);
  });
}
function measureSkin(g){
  let outside=0,ambiguous=0,maxOutsideMm=0,vertices=0;
  for(const i of referencedVertices(g,Infinity)){
    const p=probe.classify(point.fromBufferAttribute(g.attributes.position,i));vertices++;
    if(p.kind==='outside'){outside++;maxOutsideMm=Math.max(maxOutsideMm,p.distance*1000);}
    if(p.kind==='ambiguous')ambiguous++;
  }
  return {vertices,skinOutside2mm:outside,skinAmbiguous:ambiguous,maxOutsideMm};
}
function measure(g,side,scapula){
  const medial=endIndices(g,side,'medial'),lateral=endIndices(g,side,'lateral');
  assert.ok(medial.length&&lateral.length);
  return {...measureSkin(g),
    airwayCrossingIds:airwayMeshes.filter(p=>crossing(g,p.g)).map(p=>p.id),
    sternumCrossing:crossing(g,sternum),scapulaCrossing:crossing(g,scapula),
    medialVertices:medial.length,lateralVertices:lateral.length,
    medialToSternumMinMm:vertexDistance(g,sternum,medial),
    lateralToScapulaMinMm:vertexDistance(g,scapula,lateral)};
}
const donorSternum=donor('STERNUM'),donorSternumSkin=measureSkin(donorSternum),sides=[];
for(const side of ['left','right']){
  const currentId=side==='left'?'BM0070':'BM0113',scapulaId=side==='left'?'BM0083':'BM0119';
  const current=packed(currentId),scapula=packed(scapulaId),candidate=donor(`CLAVICLE_${side.toUpperCase()}`);
  const donorScapula=donor(`SCAPULA_${side.toUpperCase()}`);
  const prior=relations.pairs.filter(p=>!p.defaultHidden&&p.boneId===currentId&&airway.ids.includes(p.organId)).map(p=>p.organId).sort();
  const currentResult=measure(current,side,scapula),candidateResult=measure(candidate,side,scapula);
  const donorMedial=endIndices(candidate,side,'medial'),donorLateral=endIndices(candidate,side,'lateral');
  assert.deepEqual([...currentResult.airwayCrossingIds].sort(),prior,`${side} current relation changed`);
  sides.push({side,currentId,scapulaId,current:currentResult,candidate:candidateResult,
    sameDonor:{scapulaSkin:measureSkin(donorScapula),
      medialToSternumMinMm:vertexDistance(candidate,donorSternum,donorMedial),
      lateralToScapulaMinMm:vertexDistance(candidate,donorScapula,donorLateral),
      sternumCrossing:crossing(candidate,donorSternum),scapulaCrossing:crossing(candidate,donorScapula)},
    candidateBounds:[candidate.boundingBox.min.toArray(),candidate.boundingBox.max.toArray()]});
}
const report={status:'OFFLINE HELD-OUT CLAVICLE SCREEN; NOT APPLIED',sourceRevision:inventory.revision,
  sourceTransform:'Rigid map fitted to even T2,T4,T6,T8,T10,T12; neither clavicle trained',
  transformMatrixColumnMajor:rigid.matrixColumnMajor,skinTopology:topology,donorSternumSkin,sides,
  limitations:[
    'The common thoracic transform was fitted to vertebral bounding-box centres, not clavicle joints or a clinical landmark set.',
    'Current clavicles and scapulae are male-derived borrowed surfaces; donor clavicles may not connect to unchanged scapulae/sternum.',
    'Endpoint minimums use the outer 15% of x-span referenced vertices; they are not full joint-surface distances or proof of connection.',
    'Same-donor sternum and scapulae are compared only as independent source surfaces under the same map; their clinical joint surfaces are not identified.',
    'A triangle crossing with an airway is not automatically invalid penetration; no clinical geometry approval is made.',
    'Skin classification covers referenced mesh vertices and a 2mm boundary band, not every triangle interior.',
  ],files:[...files].map(([path,sha256])=>({path,sha256}))};
for(const path of ['scripts/audit-bonehub-clavicle-candidate.mjs','scripts/lib/exact-position-components.mjs','scripts/lib/surface-containment.mjs','package-lock.json'])
  report.files.push({path,sha256:sha(bytes(path))});
fs.writeFileSync(`${out}/screen.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(sides.map(s=>({side:s.side,current:s.current,candidate:s.candidate}))));
probe.dispose();for(const g of objects)g.dispose();
