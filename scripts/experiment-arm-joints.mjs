// Geometric adjacency proxies, NOT anatomically identified joint centres.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {referencedVertices} from './lib/surface-containment.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const input='docs/anatomy-alignment/hand-candidates.json',candidate=read(input);
for(const f of candidate.files)assert.equal(hash(f.path),f.sha256,f.path);
const atlas=read('.cache/male-details/atlas.json'),buffers=new Map();
function geometry(id){
  const p=atlas.parts.find(p=>p.id===id);assert.ok(p);
  const c=atlas.chunks[p.chunk],path=`.cache/arm-registration/${c.gzip.split('/').pop()}`;
  if(!buffers.has(path)){
    const gzip=fs.readFileSync(path);assert.equal(gzip.length,c.gzipBytes);
    const bytes=gunzipSync(gzip);assert.equal(bytes.length,c.bytes);buffers.set(path,bytes);
  }
  const bytes=buffers.get(path),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>bytes.readFloatLE(p.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>bytes.readUInt32LE(p.indices+4*i)),1));return g;
}
function contact(a,b){
  const clone=b.clone(),tree=new MeshBVH(clone),position=a.getAttribute('position');
  const rows=referencedVertices(a,Infinity).map(index=>{
    const p=new Vector3().fromBufferAttribute(position,index),hit=tree.closestPointToPoint(p);
    return {index,distance:hit.distance,midpoint:p.add(hit.point).multiplyScalar(.5)};
  });
  const min=Math.min(...rows.map(r=>r.distance)),patch=rows.filter(r=>r.distance<=min+.004);
  assert.ok(patch.length>=3,'Adjacency patch too small');
  const centre=patch.reduce((p,r)=>p.add(r.midpoint),new Vector3()).multiplyScalar(1/patch.length);
  clone.dispose();return {centre:centre.toArray(),vertices:patch.map(r=>r.index),minimumMm:min*1000,thresholdMm:(min+.004)*1000};
}
const report={status:'EXPERIMENT: one-way near-surface patch centroids, not validated articular landmarks',arms:[],
  limitations:['Patch is vertex-density-dependent; threshold is minimum distance + 4 mm.',
    'No cartilage, articular labels, contact normals or collision-free joint fit are established.'],
  files:[...candidate.files,...[input,'scripts/experiment-arm-joints.mjs','scripts/lib/surface-containment.mjs'].map(path=>({path,sha256:hash(path)}))]};
for(const arm of candidate.arms){
  const meshes=Object.fromEntries(['scapula','humerus','radius','ulna'].map(name=>{
    const p=arm.parts.find(p=>p.name.toLowerCase()===`${arm.side} ${name}`);assert.ok(p);return [name,geometry(p.sourceId)];
  }));
  const shoulder=contact(meshes.humerus,meshes.scapula),radius=contact(meshes.humerus,meshes.radius),ulna=contact(meshes.humerus,meshes.ulna);
  const elbow=radius.centre.map((v,i)=>(v+ulna.centre[i])/2);
  const row={side:arm.side,shoulder,elbow,elbowPatches:{radius,ulna}};report.arms.push(row);
  console.log(JSON.stringify({side:arm.side,shoulder:shoulder.centre,elbow,patchCounts:[shoulder.vertices.length,radius.vertices.length,ulna.vertices.length]}));
  Object.values(meshes).forEach(g=>g.dispose());
}
fs.writeFileSync('.cache/arm-registration/joints.json',JSON.stringify(report,null,2)+'\n');
