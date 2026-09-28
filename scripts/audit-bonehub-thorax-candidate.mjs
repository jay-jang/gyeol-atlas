// Offline female-rib replacement diagnostic: spine-held-out fit, skin sampling,
// and current HRA respiratory-surface relationship. No runtime export.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {MeshBVH} from 'three-mesh-bvh';
import {exactPositionComponents} from './lib/exact-position-components.mjs';
import {fitRigid} from './lib/rigid-fit.mjs';
import {fitSimilarity} from './lib/similarity-fit.mjs';
import {surfaceProbe,surfaceTopology,referencedVertices} from './lib/surface-containment.mjs';

const out='.cache/bonehub-thorax';fs.mkdirSync(out,{recursive:true});
const files=new Map();
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const bytes=path=>{const b=fs.readFileSync(path);files.set(path,sha(b));return b;};
const read=path=>JSON.parse(bytes(path));
const receipt=read('docs/anatomy-alignment/bonehub-female-receipt.json');
const inventory=read('docs/anatomy-alignment/bonehub-female-inventory.json');
const atlas=read('public/models/female/atlas-female.json');
const catalogue=read('data/female-atlas-structures.json');
const atlasSource=read('data/catalog/female-atlas-source.json');
for(const f of atlasSource.files)assert.equal(sha(bytes(f.path)),f.sha256,f.path);
const byId=new Map(atlas.parts.map(p=>[p.id,p]));
assert.equal(byId.size,1220);assert.equal(catalogue.length,1220);
const zipped=new Map();
function packed(part){
  if(!zipped.has(part.chunk)){
    const chunk=atlas.chunks[part.chunk],b=bytes(`public/models/female/${chunk.gzip.split('/').pop()}`);
    assert.equal(b.length,chunk.gzipBytes);const raw=gunzipSync(b);assert.equal(raw.length,chunk.bytes);zipped.set(part.chunk,raw);
  }
  const b=zipped.get(part.chunk),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>b.readFloatLE(part.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>b.readUInt32LE(part.indices+4*i)),1));
  g.computeBoundingBox();g.boundsTree=new MeshBVH(g);return g;
}
function source(name){
  const part=inventory.parts.find(p=>p.name===name),file=receipt.files.find(f=>f.path===part?.file);
  assert.ok(part&&file,name);const b=bytes(file.local);assert.equal(sha(b),file.sha256);
  const raw=new STLLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
  assert.equal(raw.attributes.position.count,3*part.triangles);
  const {geometry:g}=exactPositionComponents(raw);raw.dispose();
  // BoneHub LPS mm -> atlas left/up/anterior metres. Proper rotation, det +1.
  const a=g.attributes.position;
  for(let i=0;i<a.count;i++){
    const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
    a.setXYZ(i,Math.fround(x*.001),Math.fround(z*.001),Math.fround(-y*.001));
  }
  a.needsUpdate=true;g.computeBoundingBox();return g;
}
const center=g=>g.boundingBox.getCenter(new Vector3());
const vertebrae=Array.from({length:12},(_,i)=>{
  const number=i+1,src=source(`VERTEBRA_T${number}`);
  const targetPart=atlas.parts.find(p=>p.name===`Thoracic vertebra ${number}`&&p.system==='skeletal');
  assert.ok(targetPart);const target=packed(targetPart);
  return {number,src,target,targetId:targetPart.id,training:number%2===0};
});
const train=vertebrae.filter(p=>p.training);
const candidates=[['rigid',fitRigid],['similarity',fitSimilarity]].map(([mode,fit])=>{
  const matrix=fit(train.map(p=>center(p.src)),train.map(p=>center(p.target)));
  const spine=vertebrae.map(p=>({number:p.number,targetId:p.targetId,training:p.training,
    centreResidualMm:center(p.src).applyMatrix4(matrix).distanceTo(center(p.target))*1000}));
  return {mode,matrix,spine,scale:Math.cbrt(matrix.determinant())};
});
const maxHeldOut=Math.max(...candidates[0].spine.filter(p=>!p.training).map(p=>p.centreResidualMm));
assert.ok(maxHeldOut<.02*1000,'Thoracic rigid centre fit is too far for this candidate diagnostic');
function distanceSummary(from,to){
  const values=[],point=new Vector3();
  for(const i of referencedVertices(from,Infinity)){
    point.fromBufferAttribute(from.attributes.position,i);
    values.push(to.boundsTree.closestPointToPoint(point).distance*1000);
  }
  values.sort((a,b)=>a-b);
  return {vertices:values.length,p95Mm:values[Math.floor((values.length-1)*.95)],maximumMm:values.at(-1)};
}
for(const candidate of candidates){
  candidate.heldOutSurfaces=vertebrae.filter(p=>!p.training).map(p=>{
    const placed=p.src.clone().applyMatrix4(candidate.matrix);placed.boundsTree=new MeshBVH(placed);
    const result={number:p.number,sourceToAtlas:distanceSummary(placed,p.target),atlasToSource:distanceSummary(p.target,placed)};
    placed.dispose();return result;
  });
}
const lung=atlas.parts.filter(p=>p.system==='respiratory'&&/bronchopulmonary segment/i.test(p.name))
  .map(p=>({id:p.id,name:p.name,g:packed(p)}));
const skin=packed(byId.get('HRAF0003')),skinTopology=surfaceTopology(skin);
assert.equal(skinTopology.connectedComponents,1);
assert.equal(skinTopology.boundaryEdges,0);
assert.equal(skinTopology.nonManifoldEdges,0);
const probe=surfaceProbe(skin,.002);
const words=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth'];
const ribs=[];
for(const side of ['left','right'])for(let number=1;number<=12;number++){
  const donor=source(`RIB_${number}_${side.toUpperCase()}`);
  const currentPart=atlas.parts.find(p=>p.system==='borrowed'&&p.name===`${side[0].toUpperCase()+side.slice(1)} ${words[number-1]} rib`);
  assert.ok(currentPart);
  const cartilagePart=number<=7?atlas.parts.find(p=>p.system==='borrowed'&&p.name===`${side[0].toUpperCase()+side.slice(1)} ${words[number-1]} costal cartilage`):null;
  if(number<=7)assert.ok(cartilagePart);
  ribs.push({side,number,donor,current:packed(currentPart),currentId:currentPart.id,
    cartilage:cartilagePart?packed(cartilagePart):null,cartilageId:cartilagePart?.id||null});
}
assert.equal(ribs.length,24);
function minimumVertexSurfaceMm(from,to){
  let minimum=Infinity;const p=new Vector3();
  for(const i of referencedVertices(from,Infinity)){
    p.fromBufferAttribute(from.attributes.position,i);
    minimum=Math.min(minimum,to.boundsTree.closestPointToPoint(p).distance*1000);
  }
  return minimum;
}
const variants=[{mode:'current-male-borrowed',matrix:null},...candidates.map(c=>({mode:c.mode,matrix:c.matrix}))];
const point=new Vector3(),measure=[];
for(const variant of variants){
  let outside=0,ambiguous=0,maxOutsideMm=0,respiratoryPairs=0;
  let fullOutside=0,fullAmbiguous=0,fullMaximumOutsideMm=0,fullVertices=0;
  const rows=[];
  for(const rib of ribs){
    const g=variant.matrix?rib.donor.clone().applyMatrix4(variant.matrix):rib.current;
    g.computeBoundingBox();g.boundsTree=new MeshBVH(g);
    const sample=referencedVertices(g,256),skinCount={inside:0,outside:0,'surface-band':0,ambiguous:0},intersecting=[];
    for(const i of sample){const c=probe.classify(point.fromBufferAttribute(g.attributes.position,i));skinCount[c.kind]++;
      if(c.kind==='outside')maxOutsideMm=Math.max(maxOutsideMm,c.distance*1000);
    }
    let fullSkin=null;
    if(variant.mode!=='similarity'){
      fullSkin={inside:0,outside:0,'surface-band':0,ambiguous:0,vertices:0,maxOutsideMm:0};
      for(const i of referencedVertices(g,Infinity)){
        const c=probe.classify(point.fromBufferAttribute(g.attributes.position,i));fullSkin[c.kind]++;fullSkin.vertices++;
        if(c.kind==='outside')fullSkin.maxOutsideMm=Math.max(fullSkin.maxOutsideMm,c.distance*1000);
      }
      fullOutside+=fullSkin.outside;fullAmbiguous+=fullSkin.ambiguous;fullVertices+=fullSkin.vertices;
      fullMaximumOutsideMm=Math.max(fullMaximumOutsideMm,fullSkin.maxOutsideMm);
    }
    for(const p of lung)if(g.boundingBox.intersectsBox(p.g.boundingBox)&&g.boundsTree.intersectsGeometry(p.g,new Matrix4()))intersecting.push(p.id);
    const cartilageRelation=rib.cartilage?{
      id:rib.cartilageId,
      ribToCartilageMinimumMm:minimumVertexSurfaceMm(g,rib.cartilage),
      cartilageToRibMinimumMm:minimumVertexSurfaceMm(rib.cartilage,g),
      crossing:g.boundingBox.intersectsBox(rib.cartilage.boundingBox)&&g.boundsTree.intersectsGeometry(rib.cartilage,new Matrix4()),
    }:null;
    outside+=skinCount.outside;ambiguous+=skinCount.ambiguous;respiratoryPairs+=intersecting.length;
    rows.push({side:rib.side,number:rib.number,currentId:rib.currentId,vertices:g.attributes.position.count,
      sampleVertices:sample.length,skin:skinCount,fullSkin,intersectingRespiratoryIds:intersecting,cartilageRelation});
    if(variant.matrix)g.dispose();
  }
  measure.push({mode:variant.mode,sampledOutside:outside,sampledAmbiguous:ambiguous,maxOutsideMm,
    fullVertices:variant.mode==='similarity'?null:fullVertices,fullOutside:variant.mode==='similarity'?null:fullOutside,
    fullAmbiguous:variant.mode==='similarity'?null:fullAmbiguous,fullMaximumOutsideMm:variant.mode==='similarity'?null:fullMaximumOutsideMm,
    respiratorySurfacePairs:respiratoryPairs,rows});
  console.log(JSON.stringify({mode:variant.mode,sampledOutside:outside,sampledAmbiguous:ambiguous,maxOutsideMm,
    fullVertices:variant.mode==='similarity'?null:fullVertices,fullOutside:variant.mode==='similarity'?null:fullOutside,
    fullAmbiguous:variant.mode==='similarity'?null:fullAmbiguous,fullMaximumOutsideMm:variant.mode==='similarity'?null:fullMaximumOutsideMm,
    respiratorySurfacePairs:respiratoryPairs}));
}
const report={status:'OFFLINE CANDIDATES; NONE EXPORTED TO RUNTIME',sourceRevision:inventory.revision,
  femaleSource:atlasSource.reference,spineTraining:'Even thoracic levels T2,T4,T6,T8,T10,T12 bbox centres; odd levels held out',
  ribSourceCount:24,skinSamplePerRib:256,skinTopology,respiratoryScope:lung.map(p=>({id:p.id,name:p.name})),
  candidates:candidates.map(c=>({mode:c.mode,matrixColumnMajor:c.matrix.toArray(),scale:c.scale,spine:c.spine,heldOutSurfaces:c.heldOutSurfaces})),measure,
  limitations:[
    'Centres are bounding-box anchors, not validated anatomical landmarks; held-out centre fit does not approve rib pose.',
    'A shared rigid/similarity map preserves source rib relationships but HRA skin and lung may differ in segmentation and posture.',
    'Sample screening uses 256 index-spaced referenced vertices per rib; current and rigid candidate also check every referenced rib vertex, not triangle interiors.',
    'Current simplified male-derived ribs and high-resolution BoneHub female ribs have different vertex density; raw sample counts and surface-pair counts are screening only.',
    'A lung/rib surface intersection is not automatically invalid contact or a clinical penetration measurement.',
    'Source rib cartilage is missing. Nearest rib/cartilage referenced-vertex distances screen existing male-derived cartilage continuity, not a complete surface-to-surface or joint-distance measurement.',
    'No new runtime mesh, anatomical label or coordinate is created here.',
  ],files:[...files].map(([path,sha256])=>({path,sha256}))};
for(const path of ['scripts/audit-bonehub-thorax-candidate.mjs','scripts/lib/exact-position-components.mjs',
  'scripts/lib/rigid-fit.mjs','scripts/lib/similarity-fit.mjs','scripts/lib/surface-containment.mjs','package-lock.json'])
  report.files.push({path,sha256:sha(bytes(path))});
fs.writeFileSync(`${out}/screen.json`,JSON.stringify(report,null,2)+'\n');
for(const p of vertebrae){p.src.dispose();p.target.dispose();}
for(const p of ribs){p.donor.dispose();p.current.dispose();p.cartilage?.dispose();}
for(const p of lung)p.g.dispose();probe.dispose();skin.dispose();
