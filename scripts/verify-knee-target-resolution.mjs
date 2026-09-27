// Independent NodeIO source readback and direct triangle-contact classification.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {NodeIO} from '@gltf-transform/core';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
const out='.cache/knee-target-resolution',sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p));
const reportBytes=read(`${out}/report.json`),report=JSON.parse(reportBytes);for(const f of report.files)assert.equal(sha(read(f.file)),f.sha256,f.file);
const original=read(report.sourceFile);assert.equal(sha(original),report.sourceSha256);
const compressed=read(report.binary.path);assert.equal(sha(compressed),report.binary.sha256);const data=gunzipSync(compressed);assert.equal(data.length,report.binary.bytes);
const doc=await new NodeIO().readBinary(original),result={createdAt:new Date().toISOString(),reportSha256:sha(reportBytes),sourceSha256:sha(original),binarySha256:sha(compressed),vertices:0,indexReferences:0,maximumNormalResidual:0,parts:[],contacts:[]};
for(const record of report.binary.records){
  const nodes=doc.getRoot().listNodes().filter(n=>n.getName()===record.sourceName);assert.equal(nodes.length,1);const node=nodes[0];
  // Confirm rather than assume that this particular published target set is
  // already expressed in the source world frame. Other GLBs may not be.
  assert.deepEqual(node.getWorldMatrix(),[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const primitives=node.getMesh().listPrimitives();assert.equal(primitives.length,1);const p=primitives[0],positions=p.getAttribute('POSITION').getArray(),normals=p.getAttribute('NORMAL').getArray(),indices=p.getIndices().getArray();
  assert.equal(positions.length,3*record.vertexCount);assert.equal(normals.length,positions.length);assert.equal(indices.length,record.indexCount);
  for(let i=0;i<record.vertexCount;i++){
    const length=Math.hypot(...normals.subarray(3*i,3*i+3));assert.ok(length>0);
    for(let k=0;k<3;k++){
      assert.equal(data.readFloatLE(record.positions+4*(3*i+k)),Math.fround(positions[3*i+k]+report.translationFromSkin[k]));
      result.maximumNormalResidual=Math.max(result.maximumNormalResidual,Math.abs(data.readFloatLE(record.normals+4*(3*i+k))-normals[3*i+k]/length));
    }
  }
  for(let i=0;i<indices.length;i++)assert.equal(data.readUInt32LE(record.indices+4*i),indices[i]);
  result.vertices+=record.vertexCount;result.indexReferences+=record.indexCount;result.parts.push({id:record.id,vertices:record.vertexCount,indexReferences:record.indexCount});
}
assert.ok(result.maximumNormalResidual<1e-7);
const atlas=json('public/models/female/atlas-female.json'),chunks=atlas.chunks.map(c=>gunzipSync(read(`public/models/female/${c.gzip.split('/').pop()}`)));
function geometry(bytes,p){const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(Float32Array.from({length:3*p.vertexCount},(_,i)=>bytes.readFloatLE(p.positions+4*i)),3));g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>bytes.readUInt32LE(p.indices+4*i)),1));g.boundsTree=new MeshBVH(g,{indirect:true});return g;}
// Intersect each triangle with the other's infinite supporting plane, then
// compare their intervals on the common line. This is separate from the
// edge-interior Moller–Trumbore witness used by the producer.
function planeInterval(vertices,normal,origin,direction){
  const distances=vertices.map(p=>normal.dot(p.clone().sub(origin))),points=[];
  for(let i=0;i<3;i++){
    if(Math.abs(distances[i])<=1e-12)points.push(vertices[i].dot(direction));
    const j=(i+1)%3;if(distances[i]*distances[j]<0){const t=distances[i]/(distances[i]-distances[j]);points.push(vertices[i].clone().lerp(vertices[j],t).dot(direction));}
  }
  assert.ok(points.length>=2);return [Math.min(...points),Math.max(...points)];
}
for(const row of report.runtimeRelations)for(const state of ['before','after']){
  const r=row[state];if(!r?.strictCountWithoutInteriorWitness)continue;
  assert.ok(row.bothChanged,'Unexpected non-target contact requires a broader independent reader');
  const meshes=row.ids.map(id=>{const p=state==='after'?report.binary.records.find(p=>p.id===id):atlas.parts.find(p=>p.id===id);return geometry(state==='after'?data:chunks[p.chunk],p);});
  const checks=[];
  meshes[0].boundsTree.bvhcast(meshes[1].boundsTree,new Matrix4(),{intersectsTriangles(a,b){
    if(!a.intersectsTriangle(b))return false;
    const na=a.getNormal(new Vector3()),nb=b.getNormal(new Vector3()),va=[a.a,a.b,a.c],vb=[b.a,b.b,b.c],da=vb.map(p=>na.dot(p.clone().sub(a.a))),db=va.map(p=>nb.dot(p.clone().sub(b.a)));
    const extent=Math.min(-Math.min(...da),Math.max(...da),-Math.min(...db),Math.max(...db));if(extent<=1e-6)return false;
    const direction=na.clone().cross(nb);assert.ok(direction.length()>1e-12);direction.normalize();const ia=planeInterval(va,nb,b.a,direction),ib=planeInterval(vb,na,a.a,direction);
    const overlapMetres=Math.min(ia[1],ib[1])-Math.max(ia[0],ib[0]),sharedVertices=va.filter(p=>vb.some(q=>p.distanceTo(q)<1e-12)).length;
    checks.push({a:va.map(p=>p.toArray()),b:vb.map(p=>p.toArray()),planeStraddleExtentMm:extent*1000,intervalA:ia,intervalB:ib,overlapMetres,sharedVertices});return false;
  }});
  assert.equal(checks.length,r.strictPlaneStraddlingPairs);result.contacts.push({ids:row.ids,state,checks});meshes.forEach(g=>g.dispose());
}
result.contactSummary={pairStateOccurrences:result.contacts.length,trianglePairs:result.contacts.reduce((n,r)=>n+r.checks.length,0),sharedVertexTrianglePairs:result.contacts.reduce((n,r)=>n+r.checks.filter(c=>c.sharedVertices>0).length,0),maximumOverlapMetres:Math.max(...result.contacts.flatMap(r=>r.checks.map(c=>c.overlapMetres))),minimumOverlapMetres:Math.min(...result.contacts.flatMap(r=>r.checks.map(c=>c.overlapMetres)))};
result.limitations=['NodeIO verifies this source world frame and serialized geometry, not anatomy.','Contact intervals are floating-point checks only on pairs lacking a strict interior witness; their presence does not reclassify every original crossing.','No broad pair or fitting algorithm is independently rerun.'];
result.scriptSha256=sha(read('scripts/verify-knee-target-resolution.mjs'));fs.writeFileSync(`${out}/readback.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,parts:result.parts.length,contacts:result.contacts.length}));
