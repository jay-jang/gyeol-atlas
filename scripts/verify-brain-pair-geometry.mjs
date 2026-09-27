// Independent GLB reader and arithmetic for centroids and recorded triangle
// witnesses. Does NOT independently rerun the full triangle matching algorithm.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {Matrix4,Vector3} from 'three';
const hash=b=>createHash('sha256').update(b).digest('hex');
const auditBytes=fs.readFileSync('.cache/brain-pairs/audit.json'),audit=JSON.parse(auditBytes);
const bytes=fs.readFileSync(audit.sourcePath);assert.equal(hash(bytes),audit.sourceSha256);
const doc=await new NodeIO().readBinary(bytes),nodes=new Map(doc.getRoot().listNodes().map(n=>[n.getName(),n]));
const matrix=new Matrix4().fromArray(audit.centroidMatrix),point=new Vector3(...audit.symmetryPlane.point),normal=new Vector3(...audit.symmetryPlane.normal);
const permutations=[[0,1,2],[1,2,0],[2,0,1],[0,2,1],[2,1,0],[1,0,2]];
let vertexReads=0,witnesses=0,maxCentroidResidualMm=0,maxWitnessErrorResidualMm=0;
function read(name){
  const node=nodes.get(name);assert.ok(node,name);
  const primitives=node.getMesh().listPrimitives();assert.equal(primitives.length,1);
  const primitive=primitives[0],a=primitive.getAttribute('POSITION'),world=new Matrix4().fromArray(node.getWorldMatrix());
  const vertices=Array.from({length:a.getCount()},(_,i)=>new Vector3().fromArray(a.getArray(),3*i).applyMatrix4(world));
  vertexReads+=vertices.length;
  return {vertices,indices:primitive.getIndices().getArray(),mean:vertices.reduce((m,v)=>m.add(v),new Vector3()).multiplyScalar(1/vertices.length)};
}
for(const row of audit.rows){
  const a=read(row.leftSource),b=read(row.rightSource);
  assert.equal(a.vertices.length,row.individual.vertices);assert.equal(a.vertices.length,b.vertices.length);
  for(const [actual,expected,signed] of [[a.mean,row.leftCentroid,row.leftSignedPlaneMm],[b.mean,row.rightCentroid,row.rightSignedPlaneMm]]){
    const error=actual.distanceTo(new Vector3(...expected))*1000;maxCentroidResidualMm=Math.max(maxCentroidResidualMm,error);assert.ok(error<1e-8);
    assert.ok(Math.abs(actual.clone().sub(point).dot(normal)*1000-signed)<1e-8);
  }
  assert.equal(a.indices.length/3,row.triangleCorrespondence.sourceTriangles);
  assert.equal(b.indices.length/3,row.triangleCorrespondence.targetTriangles);
  for(const witness of [row.triangleCorrespondence.worstMatch,...row.triangleCorrespondence.sameWindingExamples]){
    const distances=permutations[witness.permutation].map((j,i)=>a.vertices[a.indices[witness.source*3+i]].clone().applyMatrix4(matrix).distanceTo(b.vertices[b.indices[witness.target*3+j]]));
    const error=Math.abs(Math.max(...distances)-witness.error)*1000;
    assert.ok(error<1e-8);maxWitnessErrorResidualMm=Math.max(maxWitnessErrorResidualMm,error);witnesses++;
  }
}
for(const control of audit.symmetryPlane.controls){
  const actual=read(control.sourceName).mean;
  assert.ok(actual.distanceTo(new Vector3(...control.centroid))<1e-11);
  assert.ok(Math.abs(actual.clone().sub(point).dot(normal)*1000-control.signedSymmetryPlaneMm)<1e-8);
}
assert.equal(audit.rows.length,141);
const result={checkedAt:new Date().toISOString(),auditSha256:hash(auditBytes),pairs:141,vertexReads,witnesses,
  maxCentroidResidualMm,maxWitnessErrorResidualMm,
  scope:'Independent @gltf-transform/core source positions/world matrices, all pair and control centroids, per-pair worst matching triangle and 15 same-winding witnesses. Not independent full triangle matching, skin/skull/nerve connectivity or clinical approval.'};
fs.writeFileSync('.cache/brain-pairs/readback.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
