// Offline, bounded rigid finger-chain trial. Never writes runtime assets.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {BufferGeometry,BufferAttribute,Vector3,Matrix4} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';
import {applyFemaleSourceRestoration} from '../src/female-source-restoration.ts';
import {resolveFemaleBrainGeometryPart} from '../src/female-brain-bindings.ts';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';
import {jointSurfaceRelation} from './lib/joint-geometry.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';

const out='.cache/finger-chains';fs.mkdirSync(out,{recursive:true});
const files=new Map(),readBytes=path=>{const b=fs.readFileSync(path);files.set(path,createHash('sha256').update(b).digest('hex'));return b;};
const read=path=>JSON.parse(readBytes(path));
const baselineRef='8e6f1f4e568d4a9f3498ccda9ac70098641c5a83';
const baselineBytes=execFileSync('git',['show',`${baselineRef}:data/catalog/female-arm-registration.json`]);
const baseRegistration=JSON.parse(baselineBytes);assert.equal(baseRegistration.version,'female-arm-partial-2');
const baselineRecords=new Map(baseRegistration.records.map(r=>[r.id,r]));
const recordMatrix=r=>{const m=r.linear,t=r.translation;return new Matrix4().set(m[0][0],m[1][0],m[2][0],t[0],m[0][1],m[1][1],m[2][1],t[1],m[0][2],m[1][2],m[2][2],t[2],0,0,0,1);};
const atlas=read('public/models/female/atlas-female.json'),catalog=read('data/female-atlas-structures.json');
const source=read('data/catalog/female-atlas-source.json');
for(const f of source.files)assert.equal(createHash('sha256').update(readBytes(f.path)).digest('hex'),f.sha256,f.path);
const restoration=read('data/catalog/female-source-restoration.json'),rbytes=gunzipSync(readBytes(`public/${restoration.url}`));
const restored=rbytes.buffer.slice(rbytes.byteOffset,rbytes.byteOffset+rbytes.byteLength);
const partMap=new Map(atlas.parts.map(p=>[p.id,p])),catalogMap=new Map(catalog.map(p=>[p.id,p])),chunks=new Map();
function geometry(p,override){
  const q=resolveFemaleBrainGeometryPart(p,'female',partMap),c=atlas.chunks[q.chunk];
  if(!chunks.has(q.chunk)){
    const zipped=readBytes(`public/models/female/${c.gzip.split('/').pop()}`);assert.equal(zipped.length,c.gzipBytes);
    const b=gunzipSync(zipped);assert.equal(b.length,c.bytes);chunks.set(q.chunk,b);
  }
  const b=chunks.get(q.chunk),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:q.vertexCount*3},(_,i)=>b.readFloatLE(q.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:q.indexCount},(_,i)=>b.readUInt32LE(q.indices+4*i)),1));
  applyFemaleSourceRestoration(g,'female',p.id,p.system,restored);
  if(override)g.applyMatrix4(new Matrix4().fromArray(override));
  else {
    const record=baselineRecords.get(p.id);
    if(record){assert.equal(p.system,'borrowed');assert.equal(p.vertexCount,record.vertexCount);assert.equal(p.indexCount,record.indexCount);g.applyMatrix4(recordMatrix(record));}
    applyFemaleFootRegistration(g,'female',p.id,p.system);
  }
  g.computeBoundingBox();g.boundsTree=new MeshBVH(g);return g;
}
const meshes=atlas.parts.map(p=>({id:p.id,name:p.name,system:p.system,layer:catalogMap.get(p.id)?.layer,g:geometry(p)}));
assert.equal(meshes.length,1220);assert.ok(meshes.every(m=>m.layer));
const byName=name=>{const m=meshes.find(p=>p.name.toLowerCase()===name);assert.ok(m,name);return m;};
const skin=byName('skin'),probe=surfaceProbe(skin.g,.002);
function patch(a,b){
  const rows=referencedVertices(a,Infinity).map(index=>{
    const point=new Vector3().fromBufferAttribute(a.attributes.position,index),hit=b.boundsTree.closestPointToPoint(point);
    return {index,distance:hit.distance,midpoint:point.add(hit.point).multiplyScalar(.5)};
  });
  const minimum=Math.min(...rows.map(r=>r.distance)),near=rows.filter(r=>r.distance<=minimum+.001);
  assert.ok(near.length>=3);
  return {minimumMm:minimum*1000,indices:near.map(r=>r.index),centre:near.reduce((v,r)=>v.add(r.midpoint),new Vector3()).multiplyScalar(1/near.length).toArray()};
}
const report={status:'OFFLINE CANDIDATES; no anatomy validation or runtime export',groups:[],baselineRegistration:baseRegistration,
  historicalInput:{gitRef:baselineRef,path:'data/catalog/female-arm-registration.json',sha256:createHash('sha256').update(baselineBytes).digest('hex')},
  limits:{angleDegrees:12,coarseDegrees:2,refinementDegrees:.5,refinementRadiusDegrees:2,toleranceMm:2},
  limitations:[
    'Pivot and axes are geometric proxies, not measured joint centres or physiological ranges.',
    'Each chain receives one rigid transform; no resizing, per-bone separation or hidden parts.',
    'Containment uses all indexed vertices, not triangle interiors or an independent anatomical target.',
    'Surface crossing and nearest distance do not measure solid penetration or validate nerve courses.',
    'Alternative chain scopes are tested separately, not composed or deployed.',
  ]};
for(const side of ['left','right'])for(const finger of ['ring','little'])for(const includeMetacarpal of finger==='little'?[false,true]:[false]){
  const ordinal=finger==='ring'?'fourth':'fifth';
  const metacarpal=byName(`${side} ${ordinal} metacarpal bone`);
  const chain=['proximal','middle','distal'].map(stage=>byName(`${stage} phalanx of ${side} ${finger} finger`));
  const moving=includeMetacarpal?[metacarpal,...chain]:chain;
  const fixed=includeMetacarpal?byName(`${side} hamate`):metacarpal;
  const patches=[patch(moving[0].g,fixed.g),patch(fixed.g,moving[0].g)];
  const pivot=new Vector3(...patches[0].centre).add(new Vector3(...patches[1].centre)).multiplyScalar(.5);
  const indices=referencedVertices(chain.at(-1).g,Infinity),tip=new Vector3();
  for(const i of indices)tip.add(new Vector3().fromBufferAttribute(chain.at(-1).g.attributes.position,i));
  tip.multiplyScalar(1/indices.length);
  const axis=tip.clone().sub(pivot).normalize(),basis=Math.abs(axis.x)<.8?new Vector3(1,0,0):new Vector3(0,0,1);
  const axisA=basis.addScaledVector(axis,-basis.dot(axis)).normalize(),axisB=axis.clone().cross(axisA).normalize();
  const points=moving.flatMap(m=>referencedVertices(m.g,Infinity).map(index=>{
    const point=new Vector3().fromBufferAttribute(m.g.attributes.position,index),before=probe.classify(point);
    assert.notEqual(before.kind,'ambiguous');return {id:m.id,index,point,before};
  }));
  const transform=(a,b)=>{
    const rotation=new Matrix4().makeRotationAxis(axisB,b*Math.PI/180).multiply(new Matrix4().makeRotationAxis(axisA,a*Math.PI/180));
    return new Matrix4().makeTranslation(...pivot.toArray()).multiply(rotation).multiply(new Matrix4().makeTranslation(...pivot.clone().negate().toArray()));
  };
  const trials=[],cache=new Map();
  function evaluate(a,b){
    const key=`${a}/${b}`;if(cache.has(key))return cache.get(key);
    const matrix=transform(a,b),r={a,b,outside:0,newOutside:0,worsenedOutside:0,ambiguous:0,maxOutsideMm:0,squaredExcessMm:0};
    for(const {point,before} of points){
      const q=point.clone().applyMatrix4(matrix);q.set(Math.fround(q.x),Math.fround(q.y),Math.fround(q.z));
      const c=probe.classify(q);r.ambiguous+=c.kind==='ambiguous';r.outside+=c.kind==='outside';
      r.newOutside+=c.kind==='outside'&&before.kind!=='outside';
      r.worsenedOutside+=(c.kind==='outside'?c.distance:0)-(before.kind==='outside'?before.distance:0)>1e-6;
      if(c.kind==='outside'){r.maxOutsideMm=Math.max(r.maxOutsideMm,c.distance*1000);r.squaredExcessMm+=((c.distance-.002)*1000)**2;}
    }
    r.cost=r.squaredExcessMm+.001*(a*a+b*b);r.skinEligible=!r.newOutside&&!r.worsenedOutside&&!r.ambiguous;
    cache.set(key,r);trials.push(r);return r;
  }
  let best=evaluate(0,0);assert.ok(best.skinEligible);const before={...best};
  const consider=(a,b)=>{const r=evaluate(a,b);if(r.skinEligible&&r.cost<best.cost-1e-10)best=r;};
  for(let a=-12;a<=12;a+=2)for(let b=-12;b<=12;b+=2)consider(a,b);
  const coarse={...best};
  for(let a=Math.max(-12,coarse.a-2);a<=Math.min(12,coarse.a+2);a+=.5)
    for(let b=Math.max(-12,coarse.b-2);b<=Math.min(12,coarse.b+2);b+=.5)consider(a,b);
  const rotationOnly={...best},matrix=transform(best.a,best.b);
  const rotated=moving.map(m=>({id:m.id,g:m.g.clone().applyMatrix4(matrix)}));
  rotated.forEach(m=>m.g.computeBoundingBox());
  const external=meshes.filter(m=>m.layer!=='skin'&&!moving.some(x=>x.id===m.id));
  const shifts=[];
  for(let x=-6;x<=6;x++)for(let y=-6;y<=6;y++)for(let z=-6;z<=6;z++){
    const mm=[x*.25,y*.25,z*.25],norm=Math.hypot(...mm);if(norm<=1.5)shifts.push({mm,norm});
  }
  shifts.sort((a,b)=>a.norm-b.norm||a.mm[0]-b.mm[0]||a.mm[1]-b.mm[1]||a.mm[2]-b.mm[2]);
  let clearance=null,shiftTrials=0;
  for(const shift of shifts){
    shiftTrials++;const delta=new Vector3(...shift.mm).multiplyScalar(.001),translation=new Matrix4().makeTranslation(...delta.toArray());
    if(rotated.some(m=>{const box=m.g.boundingBox.clone().translate(delta);return external.some(t=>box.intersectsBox(t.g.boundingBox)&&t.g.boundsTree.intersectsGeometry(m.g,translation));}))continue;
    const trialMatrix=translation.clone().multiply(matrix);let newOutside=0,worsenedOutside=0,ambiguous=0,outside=0,maxOutsideMm=0;
    for(const {point,before:base} of points){
      const q=point.clone().applyMatrix4(trialMatrix);q.set(Math.fround(q.x),Math.fround(q.y),Math.fround(q.z));
      const c=probe.classify(q);ambiguous+=c.kind==='ambiguous';outside+=c.kind==='outside';
      newOutside+=c.kind==='outside'&&base.kind!=='outside';
      worsenedOutside+=(c.kind==='outside'?c.distance:0)-(base.kind==='outside'?base.distance:0)>1e-6;
      if(c.kind==='outside')maxOutsideMm=Math.max(maxOutsideMm,c.distance*1000);
      if(newOutside||worsenedOutside||ambiguous)break;
    }
    if(newOutside||worsenedOutside||ambiguous||outside>=before.outside)continue;
    clearance={...shift,tested:shiftTrials,outside,maxOutsideMm,newOutside,worsenedOutside,ambiguous,stepMm:.25,maximumNormMm:1.5};
    matrix.copy(trialMatrix);break;
  }
  rotated.forEach(m=>m.g.dispose());
  const after=moving.map(m=>({id:m.id,g:m.g.clone().applyMatrix4(matrix)}));
  after.forEach(m=>{m.g.computeBoundingBox();m.g.boundsTree=new MeshBVH(m.g);});
  const relations=[];let pairsChecked=0;
  for(let i=0;i<moving.length;i++)for(const target of external){
    pairsChecked++;
    const a=moving[i].g,b=after[i].g,t=target.g;
    const hits=g=>g.boundingBox.intersectsBox(t.boundingBox)&&Boolean(g.boundsTree.intersectsGeometry(t,new Matrix4()));
    const was=hits(a),now=hits(b);if(!was&&!now)continue;
    relations.push({ids:[moving[i].id,target.id],targetName:target.name,targetLayer:target.layer,before:was,after:now,
      beforeCrossings:triangleCrossings(a,t),afterCrossings:triangleCrossings(b,t)});
  }
  const joints=moving.slice(1).map((m,i)=>({ids:[moving[i].id,m.id],before:jointSurfaceRelation(moving[i].g,m.g),after:jointSurfaceRelation(after[i].g,after[i+1].g)}));
  const rootJoint={ids:[fixed.id,moving[0].id],before:jointSurfaceRelation(fixed.g,moving[0].g),after:jointSurfaceRelation(fixed.g,after[0].g)};
  const group={side,finger,includeMetacarpal,movingIds:moving.map(m=>m.id),pivot:pivot.toArray(),axisA:axisA.toArray(),axisB:axisB.toArray(),patches,
    vertices:points.length,before,rotationOnly,clearance,clearanceTrials:shiftTrials,matrix:matrix.toArray(),trials,pairsChecked,relations,rootJoint,internalJoints:joints,
    newIntersections:relations.filter(r=>!r.before&&r.after).map(r=>r.ids),
    increasedStraddle:relations.filter(r=>r.afterCrossings.maxTrianglePlaneStraddleExtentMm>r.beforeCrossings.maxTrianglePlaneStraddleExtentMm+.001).map(r=>r.ids)};
  report.groups.push(group);after.forEach(m=>m.g.dispose());
  console.log(JSON.stringify({side,finger,includeMetacarpal,before:before.outside,rotationOutside:best.outside,clearance,angles:[best.a,best.b],newIntersections:group.newIntersections,increasedStraddle:group.increasedStraddle,rootJoint}));
  fs.writeFileSync(`${out}/candidate.partial.json`,JSON.stringify(report,null,2)+'\n');
}
// Compose four disjoint chains against the original packed source, then screen
// the exact one-pass Float32 coordinates that a runtime registration would use.
const selected=report.groups.filter(g=>g.finger==='ring'||g.includeMetacarpal);
assert.equal(selected.length,4);assert.ok(selected.every(g=>g.clearance));
const changes=new Map(),records=[];
for(const group of selected)for(const id of group.movingIds){
  assert.ok(!changes.has(id));const base=baseRegistration.records.find(r=>r.id===id);assert.ok(base);
  const m=base.linear,t=base.translation;
  const b=new Matrix4().set(m[0][0],m[1][0],m[2][0],t[0],m[0][1],m[1][1],m[2][1],t[1],m[0][2],m[1][2],m[2][2],t[2],0,0,0,1);
  const composed=new Matrix4().fromArray(group.matrix).multiply(b),e=composed.elements;
  const record={...base,linear:[[e[0],e[1],e[2]],[e[4],e[5],e[6]],[e[8],e[9],e[10]]],translation:[e[12],e[13],e[14]]};
  records.push(record);changes.set(id,geometry(partMap.get(id),composed.toArray()));
}
assert.equal(records.length,14);
const combined={records,selectedGroups:selected.map(g=>({side:g.side,finger:g.finger,includeMetacarpal:g.includeMetacarpal,matrix:g.matrix})),
  nonSkinMeshes:meshes.filter(m=>m.layer!=='skin').length,
  parts:[],pairs:[],pairChecks:0,newIntersections:[],increasedStraddle:[],increasedTrianglePairs:[],rootJoints:[]};
for(const [id,after] of changes){
  const before=meshes.find(m=>m.id===id).g;
  const row={id,vertices:0,beforeOutside:0,afterOutside:0,newOutside:0,worsenedOutside:0,ambiguous:0,maxOutsideMm:0,maxStagedDifferenceMm:0};
  const group=selected.find(g=>g.movingIds.includes(id)),delta=new Matrix4().fromArray(group.matrix);
  for(const index of referencedVertices(before,Infinity)){
    const p=new Vector3().fromBufferAttribute(before.attributes.position,index),q=new Vector3().fromBufferAttribute(after.attributes.position,index);
    const a=probe.classify(p),b=probe.classify(q);row.vertices++;row.beforeOutside+=a.kind==='outside';row.afterOutside+=b.kind==='outside';
    row.newOutside+=b.kind==='outside'&&a.kind!=='outside';row.ambiguous+=a.kind==='ambiguous'||b.kind==='ambiguous';
    row.worsenedOutside+=(b.kind==='outside'?b.distance:0)-(a.kind==='outside'?a.distance:0)>1e-6;
    if(b.kind==='outside')row.maxOutsideMm=Math.max(row.maxOutsideMm,b.distance*1000);
    row.maxStagedDifferenceMm=Math.max(row.maxStagedDifferenceMm,p.applyMatrix4(delta).distanceTo(q)*1000);
  }
  combined.parts.push(row);
}
const nonSkin=meshes.filter(m=>m.layer!=='skin');
for(let i=0;i<nonSkin.length;i++)for(let j=i+1;j<nonSkin.length;j++){
  const a=nonSkin[i],b=nonSkin[j];if(!changes.has(a.id)&&!changes.has(b.id))continue;combined.pairChecks++;
  const afterA=changes.get(a.id)||a.g,afterB=changes.get(b.id)||b.g;
  const hit=(x,y)=>x.boundingBox.intersectsBox(y.boundingBox)&&Boolean(x.boundsTree.intersectsGeometry(y,new Matrix4()));
  const before=hit(a.g,b.g),after=hit(afterA,afterB);if(!before&&!after)continue;
  const row={ids:[a.id,b.id],layers:[a.layer,b.layer],before,after,beforeCrossings:triangleCrossings(a.g,b.g),afterCrossings:triangleCrossings(afterA,afterB)};
  combined.pairs.push(row);if(after&&!before)combined.newIntersections.push(row.ids);
  if(row.afterCrossings.maxTrianglePlaneStraddleExtentMm>row.beforeCrossings.maxTrianglePlaneStraddleExtentMm+.001)combined.increasedStraddle.push(row.ids);
  if(row.afterCrossings.intersectingTrianglePairs>row.beforeCrossings.intersectingTrianglePairs)combined.increasedTrianglePairs.push(row.ids);
}
for(const group of selected){
  const [fixedId,movingId]=group.rootJoint.ids;
  combined.rootJoints.push({ids:group.rootJoint.ids,before:group.rootJoint.before,
    after:jointSurfaceRelation(meshes.find(m=>m.id===fixedId).g,changes.get(movingId))});
}
combined.summary={vertices:combined.parts.reduce((s,r)=>s+r.vertices,0),beforeOutside:combined.parts.reduce((s,r)=>s+r.beforeOutside,0),
  afterOutside:combined.parts.reduce((s,r)=>s+r.afterOutside,0),newOutside:combined.parts.reduce((s,r)=>s+r.newOutside,0),
  worsenedOutside:combined.parts.reduce((s,r)=>s+r.worsenedOutside,0),ambiguous:combined.parts.reduce((s,r)=>s+r.ambiguous,0),
  maxStagedDifferenceMm:Math.max(...combined.parts.map(r=>r.maxStagedDifferenceMm))};
report.combined=combined;changes.forEach(g=>g.dispose());
console.log(JSON.stringify({combined:combined.summary,pairChecks:combined.pairChecks,newIntersections:combined.newIntersections,increasedStraddle:combined.increasedStraddle,increasedTrianglePairs:combined.increasedTrianglePairs,rootJoints:combined.rootJoints}));
for(const file of ['scripts/experiment-finger-chains.mjs','src/female-foot-registration.ts','src/female-source-restoration.ts','src/female-brain-bindings.ts',
  'data/catalog/female-foot-registration.json','data/catalog/female-brain-bindings.json','scripts/lib/surface-containment.mjs','scripts/lib/joint-geometry.mjs','scripts/lib/triangle-crossings.mjs','package-lock.json'])readBytes(file);
report.files=[...files].map(([path,sha256])=>({path,sha256}));
fs.writeFileSync(`${out}/candidate.json`,JSON.stringify(report,null,2)+'\n');
probe.dispose();meshes.forEach(m=>m.g.dispose());
