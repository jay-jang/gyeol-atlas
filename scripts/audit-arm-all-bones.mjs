// Checks every pair involving a moved candidate bone against the full female
// bone-layer inventory. Intersections include contacts, not penetration volume.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
const inputPath='.cache/arm-registration/hand-clearance-candidates.json';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const input=JSON.parse(fs.readFileSync(inputPath)),atlasPath='public/models/female/atlas-female.json';
for(const f of input.files)assert.equal(sha(f.path),f.sha256,f.path);
const atlas=JSON.parse(fs.readFileSync(atlasPath)),buffers=new Map();
const changes=new Map(input.arms.flatMap(a=>a.parts).filter(p=>p.transformed).map(p=>[p.id,p]));
const parts=atlas.parts.filter(p=>['skeletal','connective','borrowed'].includes(p.system));
assert.equal(parts.length,321);assert.equal(changes.size,60);
const meshes=parts.map(p=>{
  const path=`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').pop()}`;
  if(!buffers.has(path))buffers.set(path,gunzipSync(fs.readFileSync(path)));
  const data=buffers.get(path),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>data.readFloatLE(p.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>data.readUInt32LE(p.indices+4*i)),1));
  const after=g.clone(),change=changes.get(p.id);
  if(change){const pos=after.getAttribute('position');for(let i=0;i<pos.count;i++){
    const q=[pos.getX(i),pos.getY(i),pos.getZ(i)];
    pos.setXYZ(i,...change.translation.map((v,j)=>v+q.reduce((n,c,k)=>n+c*change.linear[k][j],0)));
  }}
  for(const geometry of [g,after]){geometry.computeBoundingBox();geometry.boundsTree=new MeshBVH(geometry);}
  return {id:p.id,name:p.name,changed:Boolean(change),before:g,after};
});
const identity=new Matrix4(),before=[],after=[],pairs=[];
let evaluatedPairs=0;
for(let i=0;i<meshes.length;i++)for(let j=i+1;j<meshes.length;j++){
  const a=meshes[i],b=meshes[j];if(!a.changed&&!b.changed)continue;
  evaluatedPairs++;
  const hit=stage=>a[stage].boundingBox.intersectsBox(b[stage].boundingBox)&&Boolean(a[stage].boundsTree.intersectsGeometry(b[stage],identity));
  const previous=hit('before'),current=hit('after');
  if(previous)before.push([a.id,b.id]);if(current)after.push([a.id,b.id]);
  if(previous||current)pairs.push({ids:[a.id,b.id],names:[a.name,b.name],before:previous,after:current});
}
const newIntersections=pairs.filter(p=>p.after&&!p.before),resolvedIntersections=pairs.filter(p=>p.before&&!p.after);
const report={status:'CANDIDATE AUDIT ONLY; no deployment or anatomical validity claim',boneLayerParts:321,movedParts:60,evaluatedPairs,
  beforeIntersections:before.length,afterIntersections:after.length,newIntersections,resolvedIntersections,pairs,
  limitations:['All pairwise triangle-surface intersections involving moved parts are tested; wholly enclosed solids are not detected.',
    'Touching is included; no penetration depth, cartilage/contact quality, skin/muscle/organ collisions, or clinical registration is established.'],
  files:[inputPath,atlasPath,'scripts/audit-arm-all-bones.mjs',...buffers.keys()].map(path=>({path,sha256:sha(path)}))};
fs.writeFileSync('.cache/arm-registration/all-bones-candidate-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,files:undefined,pairs:undefined},null,2));
for(const row of meshes){row.before.dispose();row.after.dispose();}
