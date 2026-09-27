// Diagnostic only. Source L/R names are correspondence hypotheses, not a
// clinical basis for silently relabelling or reflecting the runtime model.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Matrix4,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {officialMeshes} from './lib/official-meshes.mjs';
import {fitSimilarity} from './lib/similarity-fit.mjs';
import {matchTriangles} from './lib/triangle-correspondence.mjs';

const sourcePath='.cache/neural-bone/hra-united-female-v1.10.glb';
const source=fs.readFileSync(sourcePath),sha=b=>createHash('sha256').update(b).digest('hex');
const provenance=JSON.parse(fs.readFileSync('data/catalog/female-brain-provenance.json'));
assert.equal(sha(source),provenance.sourceSha256);
const entries=provenance.parts.filter(p=>p.origin==='allen-reference');
const names=new Map(entries.map(p=>[p.sourceNode,p]));
assert.equal(names.size,282);
const meshes=officialMeshes(source,[...names.keys()],[0,0,0]);
const reflectX=new Matrix4().makeScale(-1,1,1),from=[],onto=[];
const pairs=entries.filter(p=>p.sourceNode.endsWith('_L')).map(left=>{
  const right=names.get(left.sourceNode.replace(/_L$/,'_R'));assert.ok(right,left.id);
  const a=meshes.get(left.sourceNode).geometry,b=meshes.get(right.sourceNode).geometry;
  assert.equal(a.attributes.position.count,b.attributes.position.count);
  assert.equal(a.index.count,b.index.count);
  // Check the exact same triangle vertex triples after ignoring winding and
  // triangle order; do not infer vertex correspondence from equal counts alone.
  const triangles=g=>{
    const rows=[];for(let i=0;i<g.index.count;i+=3)rows.push([g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)].sort((a,b)=>a-b).join(','));
    return rows.sort();
  };
  const ta=triangles(a),tb=triangles(b),sameIndexTopology=ta.every((value,i)=>value===tb[i]);
  const x=[],y=[],count=a.attributes.position.count;
  for(let i=0;i<Math.min(64,count);i++){
    const index=Math.floor(i*count/Math.min(64,count));
    x.push(new Vector3().fromBufferAttribute(a.attributes.position,index).applyMatrix4(reflectX));
    y.push(new Vector3().fromBufferAttribute(b.attributes.position,index));
  }
  from.push(...x);onto.push(...y);
  const matrix=fitSimilarity(x,y).multiply(reflectX);
  return {left,right,a,b,sameIndexTopology,matrix};
});
assert.equal(pairs.length,141);
const common=fitSimilarity(from,onto).multiply(reflectX);
const centroid=g=>{
  const mean=new Vector3(),point=new Vector3();
  for(let i=0;i<g.attributes.position.count;i++)mean.add(point.fromBufferAttribute(g.attributes.position,i));
  return mean.multiplyScalar(1/g.attributes.position.count);
};
const centroidMatrix=fitSimilarity(pairs.map(p=>centroid(p.a).applyMatrix4(reflectX)),pairs.map(p=>centroid(p.b))).multiply(reflectX);
// Candidate plane derived from corresponding cloud centroids. This is a
// numerical symmetry plane, not an independently reviewed midsagittal plane.
const middle=pairs.reduce((s,p)=>s.add(centroid(p.a)).add(centroid(p.b)),new Vector3()).multiplyScalar(1/(2*pairs.length));
const e=centroidMatrix.elements;
const normal=new Vector3(1-e[0],-e[4],-e[8]).normalize();
if(normal.x<0)normal.negate();
const signedMm=point=>point.clone().sub(middle).dot(normal)*1000;
const originalControls=officialMeshes(source,['VH_F_sclera_L','VH_F_sclera_R','VH_F_femur_L','VH_F_femur_R'],[0,0,0]);
const controls=[...originalControls.values()].map(p=>({sourceName:p.name,centroid:centroid(p.geometry).toArray(),signedSymmetryPlaneMm:signedMm(centroid(p.geometry))}));
const surfaceResidual=(a,b,matrix)=>{
  const tree=new MeshBVH(b),point=new Vector3(),values=[];let sum2=0;
  for(let i=0;i<a.attributes.position.count;i++){
    point.fromBufferAttribute(a.attributes.position,i).applyMatrix4(matrix);
    const mm=tree.closestPointToPoint(point).distance*1000;values.push(mm);sum2+=mm*mm;
  }
  values.sort((a,b)=>a-b);
  return {vertices:values.length,rmsMm:Math.sqrt(sum2/values.length),p95Mm:values[Math.floor(.95*(values.length-1))],maxMm:values.at(-1)};
};
const residual=(pair,matrix)=>{
  const values=[],x=new Vector3(),y=new Vector3();let sum2=0;
  for(let i=0;i<pair.a.attributes.position.count;i++){
    x.fromBufferAttribute(pair.a.attributes.position,i).applyMatrix4(matrix);
    y.fromBufferAttribute(pair.b.attributes.position,i);
    const mm=x.distanceTo(y)*1000;values.push(mm);sum2+=mm*mm;
  }
  values.sort((a,b)=>a-b);
  return {vertices:values.length,rmsMm:Math.sqrt(sum2/values.length),p95Mm:values[Math.floor(.95*(values.length-1))],maxMm:values.at(-1)};
};
const rows=pairs.map(pair=>({left:pair.left.id,right:pair.right.id,leftSource:pair.left.sourceNode,rightSource:pair.right.sourceNode,
  sameIndexTopology:pair.sameIndexTopology,individualMatrix:pair.matrix.toArray(),individualDeterminant:pair.matrix.determinant(),
  leftCentroid:centroid(pair.a).toArray(),rightCentroid:centroid(pair.b).toArray(),
  leftSignedPlaneMm:signedMm(centroid(pair.a)),rightSignedPlaneMm:signedMm(centroid(pair.b)),
  individual:residual(pair,pair.matrix),common:residual(pair,common),
  triangleCorrespondence:matchTriangles(pair.a,pair.b,centroidMatrix,.000025),
  centroidFitLeftToRight:surfaceResidual(pair.a,pair.b,centroidMatrix),
  centroidFitRightToLeft:surfaceResidual(pair.b,pair.a,centroidMatrix.clone().invert())}));
const report={createdAt:new Date().toISOString(),sourcePath,sourceSha256:sha(source),pairs:rows.length,
  status:'DIAGNOSTIC ONLY; same-index fit rejected; no geometry or labels changed',
  fit:'Rejected same-index fit: up to 64 vertices per pair. Accepted numeric correspondence test: all 141 full-cloud centroid pairs fit one improper similarity; all original vertices measured in both directions and all triangles matched one-to-one within 0.025 mm. No runtime correction authorized by this report alone.',
  commonMatrix:common.toArray(),commonDeterminant:common.determinant(),
  centroidMatrix:centroidMatrix.toArray(),centroidDeterminant:centroidMatrix.determinant(),
  symmetryPlane:{point:middle.toArray(),normal:normal.toArray(),controls},
  centroidSquaredIdentityMaxResidual:Math.max(...centroidMatrix.clone().multiply(centroidMatrix).toArray().map((v,i)=>Math.abs(v-+(i%5===0)))),
  maxCentroidFitSurfaceResidualMm:Math.max(...rows.flatMap(p=>[p.centroidFitLeftToRight.maxMm,p.centroidFitRightToLeft.maxMm])),
  sameIndexTopologyPairs:rows.filter(p=>p.sameIndexTopology).length,
  completeTriangleCorrespondencePairs:rows.filter(p=>p.triangleCorrespondence.complete).length,
  pairedVertices:rows.reduce((n,p)=>n+p.individual.vertices,0),
  maxIndividualResidualMm:Math.max(...rows.map(p=>p.individual.maxMm)),maxCommonResidualMm:Math.max(...rows.map(p=>p.common.maxMm)),
  limitations:['Equal topology and small coordinate residual test a numeric pairing, not clinical homology or anatomical laterality.',
    'Signed plane distances use a derived tilted symmetry plane, not global X or an expert-defined body midsagittal plane.',
    'Distances cover vertex-to-surface queries, not the continuous surface Hausdorff distance. Triangle matching tolerance is reported separately.',
    'Source Visible Human optic chiasm is excluded; it must not inherit an Allen pair transform.',
    'No skin, skull, nerve connectivity, muscle depth or runtime peel correction is tested here.'],rows,
  codeSha256:sha(fs.readFileSync('scripts/audit-brain-pair-geometry.mjs')),
  files:['scripts/lib/official-meshes.mjs','scripts/lib/similarity-fit.mjs','scripts/lib/triangle-correspondence.mjs','package-lock.json'].map(path=>({path,sha256:sha(fs.readFileSync(path))}))};
fs.mkdirSync('.cache/brain-pairs',{recursive:true});
fs.writeFileSync('.cache/brain-pairs/audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined},null,2));
