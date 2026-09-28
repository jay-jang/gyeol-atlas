import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {BufferAttribute,BufferGeometry,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const commit='5bb5713aab18d7fe9380c3339eb09f173491ea06';
const root=`https://raw.githubusercontent.com/slorksmo/Human-Atlas/${commit}/public/models/`;
const atlas=JSON.parse(await fs.readFile('.cache/male-details/atlas.json'));
const chunks=new Map(),receipts=[];
for(const index of [7,11,13,14]){
  const chunk=atlas.chunks[index],name=chunk.gzip.split('/').at(-1),file=`.cache/male-details/${name}`;
  let zipped;
  try {zipped=await fs.readFile(file);}catch(error){
    if(error.code!=='ENOENT')throw error;
    const response=await fetch(root+name,{signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200,`${name} source response`);
    zipped=Buffer.from(await response.arrayBuffer());
    await fs.writeFile(file,zipped,{flag:'wx'});
  }
  const bytes=gunzipSync(zipped);
  assert.equal(bytes.length,chunk.bytes,`${name} unpacked length`);
  chunks.set(index,bytes);
  receipts.push({name,sha256:sha(zipped),gzipBytes:zipped.length,unpackedBytes:bytes.length});
}
const ids=['FJ3145','FJ3147','FJ2038','FJ2046','FJ2042','FJ2043','FJ2045','FJ2049','FJ2052','FJ2053','FJ2054',
  'FJ3458','FJ3459','FJ3460','FJ3461','FJ3462','FJ3463','FJ3473','FJ3474','FJ3475','FJ3476','FJ3477','FJ3478',
  'FJ3558','FJ3559','FJ3560','FJ3561','FJ3562','FJ3563','FJ3573','FJ3574','FJ3575','FJ3576','FJ3577','FJ3578'];
const parts=new Map(ids.map(id=>{
  const part=atlas.parts.find(part=>part.id===id);assert.ok(part,id);
  const bytes=chunks.get(part.chunk);
  const positions=Float32Array.from({length:part.vertexCount*3},(_,i)=>bytes.readFloatLE(part.positions+i*4));
  const indices=Uint32Array.from({length:part.indexCount},(_,i)=>bytes.readUInt32LE(part.indices+i*4));
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(positions,3));g.setIndex(new BufferAttribute(indices,1));
  g.boundsTree=new MeshBVH(g);
  return [id,{part,g}];
}));
const nearest=(a,b)=>{
  const ga=parts.get(a).g,gb=parts.get(b).g,attr=ga.getAttribute('position'),point=new Vector3();
  let min=Infinity;for(let i=0;i<attr.count;i++)min=Math.min(min,gb.boundsTree.closestPointToPoint(point.fromBufferAttribute(attr,i)).distance);
  return Number((min*1000).toFixed(3));
};
const sides=[{
  side:'left',kidney:'FJ3145',main:'FJ2046',trunk:'FJ3476',old:['FJ2049','FJ2052','FJ2053','FJ2054'],
  anterior:['FJ3458','FJ3459','FJ3460','FJ3461','FJ3462','FJ3463'],posterior:['FJ3473','FJ3474','FJ3475'],vein:['FJ3477','FJ3478']
},{side:'right',kidney:'FJ3147',main:'FJ2038',trunk:'FJ3576',old:['FJ2042','FJ2043','FJ2045'],
  anterior:['FJ3558','FJ3559','FJ3560','FJ3561','FJ3562','FJ3563'],posterior:['FJ3573','FJ3574','FJ3575'],vein:['FJ3577','FJ3578']}];
const rows=sides.map(side=>{
  const arteries=[side.main,side.trunk,...side.old,...side.anterior,...side.posterior];
  const pairs=[];
  for(let i=0;i<arteries.length;i++)for(let j=i+1;j<arteries.length;j++){
    const a=arteries[i],b=arteries[j],mm=Math.min(nearest(a,b),nearest(b,a));
    pairs.push({a,b,mm});
  }
  const near=arteries.map(id=>({id,neighbors:pairs.filter(pair=>pair.a===id||pair.b===id)
    .map(pair=>({id:pair.a===id?pair.b:pair.a,mm:pair.mm})).sort((a,b)=>a.mm-b.mm).slice(0,3)}));
  return {side:side.side,kidney:side.kidney,mainTrunkMm:nearest(side.main,side.trunk),
    mainToOldMm:side.old.map(id=>({id,mm:nearest(side.main,id)})),
    mainToNewMm:[...side.anterior,...side.posterior].map(id=>({id,mm:nearest(side.main,id)})),
    kidneyToNewMm:[...side.anterior,...side.posterior,...side.vein].map(id=>({id,mm:nearest(side.kidney,id)})),near};
});
const report={source:root,commit,receipts,method:'Minimum referenced vertex to other triangle surface in the single BodyParts3D 4.0 coordinate frame. Not continuous minimum surface distance, vascular continuity, lumen join or clinical anatomy.',rows};
await fs.writeFile('docs/anatomy-alignment/male-renal-branch-screen.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(rows.map(row=>({side:row.side,mainTrunkMm:row.mainTrunkMm,
  oldRange:[Math.min(...row.mainToOldMm.map(x=>x.mm)),Math.max(...row.mainToOldMm.map(x=>x.mm))],
  newRange:[Math.min(...row.mainToNewMm.map(x=>x.mm)),Math.max(...row.mainToNewMm.map(x=>x.mm))]}))));
