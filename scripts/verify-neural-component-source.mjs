// Independent GLB reader plus brute-force distance / solid-angle spot checks.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {NodeIO} from '@gltf-transform/core';
import {Triangle,Vector3} from 'three';
const hash=b=>createHash('sha256').update(b).digest('hex'),hashArray=a=>hash(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
const reportFile='docs/anatomy-alignment/neural-component-source.json',report=JSON.parse(fs.readFileSync(reportFile));
for(const f of report.files)assert.equal(hash(fs.readFileSync(f.file)),f.sha256,f.file);
const io=new NodeIO(),united=await io.read('.cache/neural-bone/hra-united-female-v1.10.glb');
function nodeGeometry(doc,name){
  const nodes=doc.getRoot().listNodes().filter(n=>n.getName()===name);assert.equal(nodes.length,1);
  const n=nodes[0],m=n.getWorldMatrix(),primitives=n.getMesh().listPrimitives();assert.equal(primitives.length,1);
  const p=primitives[0],input=p.getAttribute('POSITION').getArray(),positions=new Float32Array(input.length);
  for(let i=0;i<input.length;i+=3)for(let k=0;k<3;k++)positions[i+k]=m[k]*input[i]+m[k+4]*input[i+1]+m[k+8]*input[i+2]+m[k+12];
  return {positions,indices:Uint32Array.from(p.getIndices().getArray())};
}
let meshes=0,vertices=0,indexReferences=0;
for(const component of report.components){
  const own=await io.read(component.file);
  for(const row of component.rows){
    const a=nodeGeometry(own,row.name),b=nodeGeometry(united,row.name);
    assert.equal(hashArray(a.positions),row.positionSha256);assert.equal(hashArray(b.positions),row.positionSha256);
    assert.equal(hashArray(a.indices),row.indexSha256);assert.equal(hashArray(b.indices),row.indexSha256);
    meshes++;vertices+=row.vertices;indexReferences+=row.indices;
  }
}
const parts=JSON.parse(gunzipSync(fs.readFileSync(report.geometryFile))),checks=[];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const triangle=new Triangle(),query=new Vector3(),nearest=new Vector3();
// The seven deepest witnesses per mode are checked by all-triangle distance
// and generalized winding number, NOT by the audit's three ray directions.
for(const mode of report.modes)for(const row of mode.rows)for(const witness of [
  ...(row.deepest?[{...row.deepest,kind:'deepest-inside'}]:[]),...row.ambiguousPoints.map(p=>({...p,kind:'ambiguous'})),
]){
  const point=witness.point,bone=parts.find(p=>p.id===row.boneId)[mode.mode],cord=parts.find(p=>p.id===row.cordId)[mode.mode];
  assert.deepEqual(cord.positions.slice(3*witness.vertex,3*witness.vertex+3),point);
  let sum=0,min=Infinity,triangles=0;query.fromArray(point);
  for(let i=0;i<bone.indices.length;i+=3){
    const v=[0,1,2].map(k=>bone.positions.slice(3*bone.indices[i+k],3*bone.indices[i+k]+3));
    const r=v.map(p=>p.map((x,k)=>x-point[k])),lengths=r.map(v=>Math.hypot(...v));
    sum+=2*Math.atan2(dot(r[0],cross(r[1],r[2])),lengths[0]*lengths[1]*lengths[2]+dot(r[0],r[1])*lengths[2]+dot(r[1],r[2])*lengths[0]+dot(r[2],r[0])*lengths[1]);
    triangle.a.fromArray(v[0]);triangle.b.fromArray(v[1]);triangle.c.fromArray(v[2]);triangle.closestPointToPoint(query,nearest);
    min=Math.min(min,nearest.distanceTo(query));triangles++;
  }
  const winding=sum/(4*Math.PI),differenceMm=Math.abs(min*1000-witness.distanceMm);
  if(witness.kind==='deepest-inside')assert.ok(Math.abs(Math.abs(winding)-1)<1e-8);
  assert.ok(differenceMm<1e-8);
  checks.push({mode:mode.mode,kind:witness.kind,cordId:row.cordId,boneId:row.boneId,triangles,winding,distanceMm:min*1000,differenceMm});
}
const sectionFile='docs/anatomy-alignment/neural-component-sections.json',sectionReport=JSON.parse(fs.readFileSync(sectionFile));
let sectionSegments=0,maxSectionEndpointDifferenceM=0;
for(const r of sectionReport.records)for(const mode of ['source','runtime'])for(const [kind,id] of [['cord',r.pair.split('-')[0]],['bone',r.pair.split('-')[1]]]){
  const geometry=parts.find(p=>p.id===id)[mode],stored=r.sections[mode][kind],saved=new Map(stored.triangleIds.map((id,i)=>[id,stored.segments[i]]));
  assert.equal(saved.size,stored.triangleIds.length);let contacts=0,coplanar=0,count=0;
  for(let t=0;t<geometry.indices.length;t+=3){
    const v=[0,1,2].map(k=>geometry.positions.slice(3*geometry.indices[t+k],3*geometry.indices[t+k]+3));
    const d=v.map(p=>p[1]-r.planeYmeters),on=d.map(d=>Math.abs(d)<=1e-10);
    if(on.every(Boolean)){coplanar++;continue;}
    const points=v.filter((_,i)=>on[i]);
    for(let a=0;a<3;a++){const b=(a+1)%3;if(d[a]<-1e-10&&d[b]>1e-10||d[b]<-1e-10&&d[a]>1e-10){const f=d[a]/(d[a]-d[b]);points.push(v[a].map((x,k)=>x+f*(v[b][k]-x)));}}
    if(!points.length)continue;if(points.length===1){contacts++;continue;}assert.equal(points.length,2);
    const line=saved.get(t/3);assert.ok(line);const delta=(a,b)=>Math.max(...a.map((x,k)=>Math.abs(x-b[k])));
    const difference=Math.min(Math.max(delta(points[0],line[0]),delta(points[1],line[1])),Math.max(delta(points[0],line[1]),delta(points[1],line[0])));
    assert.ok(difference<1e-12);maxSectionEndpointDifferenceM=Math.max(maxSectionEndpointDifferenceM,difference);count++;
  }
  assert.equal(count,saved.size);assert.equal(contacts,stored.pointContacts);assert.equal(coplanar,stored.coplanarTriangles);sectionSegments+=count;
}
const result={createdAt:new Date().toISOString(),scope:'Independent world-coordinate/index reading of 312 component meshes; only 14 deepest inside witnesses and the recorded ambiguous query are independently classified. Selected-plane sections are fully recounted. Not full independent containment or clinical verification.',
  meshes,vertices,indexReferences,checks,sectionSegments,maxSectionEndpointDifferenceM,files:[reportFile,sectionFile,'scripts/verify-neural-component-source.mjs'].map(file=>({file,sha256:hash(fs.readFileSync(file))}))};
fs.writeFileSync('docs/anatomy-alignment/neural-component-readback.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({meshes,vertices,indexReferences,checks}));
