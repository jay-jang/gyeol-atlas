// Exact raw binary-STL topology of the pinned BodyParts3D male skin source.
// Kept separate from the simplified deployed GLB and any body containment.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MeshoptSimplifier} from 'meshoptimizer';
import {simplifyWithDetail} from './lib/detail-skin.mjs';

const file='.cache/models/FMA7163.stl',bytes=fs.readFileSync(file);
const sha256=createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(fs.readFileSync('public/models/manifest.json'));
const source=manifest.assets.find(p=>p.id==='FMA7163');
assert.ok(source);assert.equal(sha256,source.sha256);
const triangles=bytes.readUInt32LE(80);
assert.equal(triangles,source.originalTriangles);
assert.equal(bytes.length,84+50*triangles);
const parents=new Uint32Array(triangles*3),indices=new Uint32Array(triangles*3),lookup=new Map(),rawPositions=[];
let vertexCount=0;
const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
for(let t=0;t<triangles;t++){
  const start=84+t*50+12,ids=[];
  for(let c=0;c<3;c++){
    const at=start+c*12;
    const position=[0,4,8].map(k=>bytes.readFloatLE(at+k));
    assert.ok(position.every(Number.isFinite),`nonfinite STL position at triangle ${t}`);
    const key=position.join('/');
    let id=lookup.get(key);
    if(id===undefined){id=vertexCount++;lookup.set(key,id);parents[id]=id;rawPositions.push(...position);}
    indices[t*3+c]=id;ids.push(id);
  }
  parents[root(ids[1])]=root(ids[0]);parents[root(ids[2])]=root(ids[0]);
}
const sizes=new Map();
for(let t=0;t<triangles;t++){
  const id=root(indices[t*3]);sizes.set(id,(sizes.get(id)||0)+1);
}
const ranked=[...sizes.entries()].sort((a,b)=>b[1]-a[1]),largestRoot=ranked[0][0];
const key=(a,b)=>BigInt(Math.min(a,b))*4294967296n+BigInt(Math.max(a,b));
function edgeStats(select,indexData=indices){
  const total=indexData.length/3,selected=select===null?total:sizes.get(select);
  const edges=new BigUint64Array(selected*3);let cursor=0;
  for(let t=0;t<total;t++){
    const a=indexData[t*3],b=indexData[t*3+1],c=indexData[t*3+2];
    if(select!==null&&root(a)!==select)continue;
    edges[cursor++]=key(a,b);edges[cursor++]=key(b,c);edges[cursor++]=key(c,a);
  }
  assert.equal(cursor,edges.length);
  edges.sort();
  const incidence={};let runs=0;
  for(let i=0;i<edges.length;){
    let j=i+1;while(j<edges.length&&edges[j]===edges[i])j++;
    const count=j-i;incidence[count]=(incidence[count]||0)+1;runs++;i=j;
  }
  return {edges:runs,incidence,boundaryEdges:incidence[1]||0,
    nonManifoldEdges:Object.entries(incidence).filter(([n])=>Number(n)>2).reduce((sum,[,v])=>sum+v,0)};
}
const wholeEdges=edgeStats(null),largestEdges=edgeStats(largestRoot);
const convertedVertexIds=new Uint32Array(vertexCount),convertedLookup=new Map();
for(let i=0;i<vertexCount;i++){
  const x=rawPositions[3*i],y=rawPositions[3*i+1],z=rawPositions[3*i+2];
  const key=[Math.fround(x/1000),Math.fround((z+13.5175)/1000),Math.fround((-y-96.5107)/1000)].join('/');
  if(!convertedLookup.has(key))convertedLookup.set(key,convertedLookup.size);
  convertedVertexIds[i]=convertedLookup.get(key);
}
const convertedIndices=new Uint32Array(indices.length);
for(let i=0;i<indices.length;i++)convertedIndices[i]=convertedVertexIds[indices[i]];
const transformedEdges=edgeStats(null,convertedIndices);
await MeshoptSimplifier.ready;
const packedPositions=new Float32Array(rawPositions),simplified={};
// The deployed skin keeps finer hands and feet (scripts/lib/detail-skin.mjs);
// the earlier single-pass result is kept for comparison.
const deployed=()=>{const d=source.detail;const r=simplifyWithDetail(indices,packedPositions,{boxes:d.boxesMm,detailErrorMm:d.targetErrorMm,bodyTarget:135000,bodyError:.003});return [r.indices,r.error];};
for(const [name,target,flags] of [
  ['deployedPrune',45000,null],['singlePassPrune',45000,['Prune']],['withoutPrune',45000,[]],
  ['target100k',100000,['Prune']],['target250k',250000,['Prune']],
  ['target500k',500000,['Prune']],['target1000k',1000000,['Prune']],
]){
  const [result,error]=flags?MeshoptSimplifier.simplify(indices,packedPositions,3,target*3,.003,flags):deployed();
  const parents=new Uint32Array(vertexCount),used=new Set();
  for(let i=0;i<vertexCount;i++)parents[i]=i;
  const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  for(let i=0;i<result.length;i+=3){
    const a=result[i],b=result[i+1],c=result[i+2];
    parents[find(b)]=find(a);parents[find(c)]=find(a);
    used.add(a);used.add(b);used.add(c);
  }
  simplified[name]={triangles:result.length/3,error,components:new Set([...used].map(find)).size,
    weldedVertices:used.size,edges:edgeStats(null,result)};
}
assert.equal(simplified.deployedPrune.triangles,source.triangles);
assert.ok(Math.abs(simplified.deployedPrune.error-source.simplificationError)<1e-9);
const report={status:'SOURCE STL TOPOLOGY ONLY; NO MALE OUTER ENVELOPE APPROVED',
  sourceFile:file,sourceSha256:sha256,sourceTriangles:triangles,sourceWeldedVertices:vertexCount,
  deployedTriangles:source.triangles,componentCount:ranked.length,
  largestComponentTriangles:ranked[0][1],remainingTriangles:triangles-ranked[0][1],
  componentTriangleCounts:ranked.map(([,n])=>n),wholeEdges,largestEdges,
  transformedFloat32Vertices:convertedLookup.size,transformedEdges,simplified,
  limitations:[
    'This is topology in raw STL coordinates; it does not measure the rendered simplified GLB geometry or organ placement.',
    'Coordinate-identical corners are welded. Closed or largest components do not establish an external body envelope.',
    'The audit does not remove triangles, repair the mesh, or approve parity-based inside/outside classification.',
  ],files:['public/models/manifest.json','scripts/audit-male-source-skin.mjs','scripts/audit-male-skin-components.mjs','scripts/lib/detail-skin.mjs',
    'package-lock.json'].map(path=>({path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex')}))};
fs.writeFileSync('docs/anatomy-alignment/male-skin-source-topology.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceTriangles:triangles,sourceWeldedVertices:vertexCount,componentCount:ranked.length,
  largestComponentTriangles:ranked[0][1],wholeEdges,largestEdges,
  transformedFloat32Vertices:convertedLookup.size,transformedEdges,simplified},null,2));
