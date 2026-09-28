import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {fitRigid} from './lib/rigid-fit.mjs';
import {fitSimilarity} from './lib/similarity-fit.mjs';

const HRA='public/models/female/atlas-female.json';
const CT='public/models/female-detail/atlas.json';
const hra=JSON.parse(fs.readFileSync(HRA));
const ct=JSON.parse(fs.readFileSync(CT));
const sourceGroups=JSON.parse(fs.readFileSync('data/female-organ-groups.json'));
const sha256=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const sourceFiles=new Set([HRA,CT,'data/female-organ-groups.json','scripts/audit-female-ct-hra-landmarks.mjs','scripts/lib/rigid-fit.mjs','scripts/lib/similarity-fit.mjs']);
const cache=new Map();
function actualBox(manifest,manifestPath,id){
  const part=manifest.parts.find(item=>item.id===id);
  assert.ok(part,`${manifestPath}/${id}`);
  const chunkPath=`${manifestPath.slice(0,manifestPath.lastIndexOf('/'))}/${manifest.chunks[part.chunk].gzip.split('/').pop()}`;
  if(!cache.has(chunkPath))cache.set(chunkPath,gunzipSync(fs.readFileSync(chunkPath)));
  sourceFiles.add(chunkPath);
  const bytes=cache.get(chunkPath),box=new Box3();
  for(let vertex=0;vertex<part.vertexCount;vertex++)box.expandByPoint(new Vector3(
    bytes.readFloatLE(part.positions+12*vertex),bytes.readFloatLE(part.positions+12*vertex+4),bytes.readFloatLE(part.positions+12*vertex+8)));
  assert.ok(!box.isEmpty());
  for(let axis=0;axis<3;axis++){
    assert.ok(box.min.getComponent(axis)>=part.bounds[0][axis]-1e-5,`${id}/min/${axis}`);
    assert.ok(box.max.getComponent(axis)<=part.bounds[1][axis]+1e-5,`${id}/max/${axis}`);
  }
  const weighted=[0,0,0];let area=0;
  for(let face=0;face<part.indexCount;face+=3){
    const indices=[0,1,2].map(corner=>bytes.readUInt32LE(part.indices+4*(face+corner)));
    assert.ok(indices.every(vertex=>vertex<part.vertexCount),`${id}/face/${face}`);
    const p=indices.map(vertex=>[0,1,2].map(axis=>bytes.readFloatLE(part.positions+12*vertex+4*axis)));
    const u=p[1].map((value,axis)=>value-p[0][axis]),v=p[2].map((value,axis)=>value-p[0][axis]);
    const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const triangleArea=Math.hypot(...cross)/2;
    if(!Number.isFinite(triangleArea)||triangleArea<=0)continue;
    area+=triangleArea;
    for(let axis=0;axis<3;axis++)weighted[axis]+=triangleArea*(p[0][axis]+p[1][axis]+p[2][axis])/3;
  }
  assert.ok(area>0,`${id}/surface-area`);
  return {part,box,area,weighted};
}
const candidates=[
  {organ:'liver',ct:'CTF_liver',hra:['HRAF0474']},
  {organ:'kidney-left',ct:'CTF_kidney_left',hra:['HRAF0528']},
  {organ:'kidney-right',ct:'CTF_kidney_right',hra:['HRAF0554']},
  {organ:'pancreas',ct:'CTF_pancreas',hra:['HRAF0493','HRAF0494','HRAF0496','HRAF0497']},
  {organ:'spleen',ct:'CTF_spleen',hra:['HRAF0809','HRAF0810','HRAF0811','HRAF0812','HRAF0813']},
];
const rows=candidates.map(candidate=>{
  const ctPart=actualBox(ct,CT,candidate.ct);
  const hraParts=candidate.hra.map(id=>actualBox(hra,HRA,id));
  const sourceGroup=sourceGroups.find(group=>group.id===candidate.organ.replace(/-left|-right/,'')&&group.sex==='female');
  assert.ok(sourceGroup&&candidate.hra.every(id=>sourceGroup.ids.includes(id)),candidate.organ);
  const hraBox=hraParts.reduce((box,item)=>box.union(item.box),new Box3());
  const hraArea=hraParts.reduce((sum,item)=>sum+item.area,0);
  const hraWeighted=[0,1,2].map(axis=>hraParts.reduce((sum,item)=>sum+item.weighted[axis],0));
  return {organ:candidate.organ,ct:{id:candidate.ct,name:ctPart.part.name,bounds:[ctPart.box.min.toArray(),ctPart.box.max.toArray()],vertexCount:ctPart.part.vertexCount,surfaceAreaM2:ctPart.area},
    hra:{ids:candidate.hra,names:hraParts.map(item=>item.part.name),bounds:[hraBox.min.toArray(),hraBox.max.toArray()],vertexCount:hraParts.reduce((n,item)=>n+item.part.vertexCount,0),surfaceAreaM2:hraArea},
    ctCenter:ctPart.box.getCenter(new Vector3()).toArray(),hraCenter:hraBox.getCenter(new Vector3()).toArray(),
    ctSurfaceCentroid:ctPart.weighted.map(value=>value/ctPart.area),hraSurfaceCentroid:hraWeighted.map(value=>value/hraArea)};
});
const stomach=actualBox(ct,CT,'CTF_stomach');
const impression=actualBox(hra,HRA,'HRAF0467');
assert.equal(stomach.part.name,'Stomach');
assert.equal(impression.part.name,'Gastric impression of liver');
function fit(metric,mode){
  const from=rows.map(row=>new Vector3(...(metric==='aabb-center'?row.ctCenter:row.ctSurfaceCentroid)));
  const onto=rows.map(row=>new Vector3(...(metric==='aabb-center'?row.hraCenter:row.hraSurfaceCentroid)));
  const solver=mode==='rigid'?fitRigid:fitSimilarity;
  const all=solver(from,onto),scale=Math.cbrt(all.determinant());
  const training=rows.map((row,index)=>({organ:row.organ,errorMm:from[index].clone().applyMatrix4(all).distanceTo(onto[index])*1000}));
  const heldOut=rows.map((row,index)=>{
    const trainFrom=from.filter((_,i)=>i!==index),trainOnto=onto.filter((_,i)=>i!==index);
    const transform=solver(trainFrom,trainOnto);
    return {organ:row.organ,errorMm:from[index].clone().applyMatrix4(transform).distanceTo(onto[index])*1000,
      scale:Math.cbrt(transform.determinant())};
  });
  const stomachBox=stomach.box.clone().applyMatrix4(all);
  return {metric,mode,scale,matrix:all.toArray(),training,heldOut,
    stomachCandidate:{id:stomach.part.id,bounds:[stomachBox.min.toArray(),stomachBox.max.toArray()],center:stomachBox.getCenter(new Vector3()).toArray(),
      gastricImpressionCenterDistanceMm:stomachBox.getCenter(new Vector3()).distanceTo(impression.box.getCenter(new Vector3()))*1000,
      gastricImpressionAabbOverlap:stomachBox.intersectsBox(impression.box)}};
}
const result={scope:'AABB-center and triangle-area surface-centroid registration screens on real packed vertices; separate CT person and HRA reference, not accepted anatomy or runtime overlay.',
  coordinatePolicy:ct.coordinatePolicy,stageTranslationMeters:ct.stageTranslationMeters,
  rows,gastricImpression:{id:impression.part.id,bounds:[impression.box.min.toArray(),impression.box.max.toArray()]},
  fits:['aabb-center','surface-centroid'].flatMap(metric=>['rigid','similarity'].map(mode=>fit(metric,mode))),files:[...sourceFiles].sort().map(path=>({path,sha256:sha256(path)}))};
fs.writeFileSync('docs/anatomy-alignment/female-ct-hra-landmarks.json',JSON.stringify(result,null,2)+'\n');
for(const fit of result.fits)console.log(JSON.stringify({metric:fit.metric,mode:fit.mode,scale:fit.scale,trainingMm:fit.training.map(row=>row.errorMm),heldOutMm:fit.heldOut.map(row=>row.errorMm)}));
