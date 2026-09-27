import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {hipPivotContext} from './lib/hip-pivot-context.mjs';
import {boneInterpolatingField} from './lib/bone-interpolating-field.mjs';
import {subdivideSourceTriangles} from './lib/subdivide-source.mjs';
const ctx=hipPivotContext(process.argv[2]),{read,sha,root,frames}=ctx,out='.cache/hip-interpolating-muscles',bytes=read(`${out}/triangulation.json`),r=JSON.parse(bytes),candidate=JSON.parse(read(`${out}/report.json`));assert.equal(r.reportSha256,sha(read(`${out}/report.json`)));for(const f of r.files)assert.equal(sha(read(f.file)),f.sha256,f.file);
let inputs=r.pair.ids.map(id=>{const g=ctx.muscles.find(m=>m.id===id).raw.clone().applyMatrix4(root);return {id,positions:Float64Array.from(g.attributes.position.array),indices:Uint32Array.from(g.index.array)};});
const field=boneInterpolatingField(frames),v=new Vector3(),sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a);
const result={createdAt:new Date().toISOString(),reportSha256:sha(bytes),levels:[],closestPoints:0,triangles:0,maximumPlaneResidualMm:0,maximumDistanceResidualMm:0,limits:'Reconstructs all stored closest-pair triangles from source subdivision indices and the shared nonlinear evaluator, then independently checks point/plane/barycentric/distance arithmetic. Does not rescan complete pair intersections, independently verify global distance minima, or replay every mapped vertex/chord maximum at refined levels.'};
function onTriangle(p,t){const e=sub(t[1],t[0]),f=sub(t[2],t[0]),w=sub(p,t[0]),n=cross(e,f),plane=Math.abs(dot(w,n))/norm(n),aa=dot(e,e),ab=dot(e,f),bb=dot(f,f),av=dot(e,w),bv=dot(f,w),d=aa*bb-ab*ab,u=(bb*av-ab*bv)/d,z=(aa*bv-ab*av)/d;assert.ok(plane<1e-8&&u>=-1e-6&&z>=-1e-6&&u+z<=1+1e-6);result.maximumPlaneResidualMm=Math.max(result.maximumPlaneResidualMm,1000*plane);result.closestPoints++;}
for(const [level,record] of r.levels.entries()){
  assert.equal(record.level,level);for(let i=0;i<2;i++){assert.equal(record.parts[i].vertices,inputs[i].positions.length/3);assert.equal(record.parts[i].triangles,inputs[i].indices.length/3);assert.equal(record.parts[i].indicesSha256,sha(Buffer.from(inputs[i].indices.buffer)));}
  for(const state of ['source','mapped']){
    const p=record[state],q=p.closest;
    for(const [side,index] of [['A',0],['B',1]]){const input=inputs[index],t=[0,1,2].map(k=>{const i=input.indices[q[`face${side}`]*3+k],point=Array.from(input.positions.slice(3*i,3*i+3));return state==='source'?point:field(v.fromArray(point)).point.toArray().map(Math.fround);});assert.deepEqual(t,q[`triangle${side}`]);onTriangle(q[side.toLowerCase()],t);result.triangles++;}
    const error=Math.abs(1000*norm(sub(q.a,q.b))-p.minimumDistanceMm);assert.ok(error<1e-8);result.maximumDistanceResidualMm=Math.max(result.maximumDistanceResidualMm,error);
  }
  if(level===0){const pair=candidate.candidates[0].relations.find(p=>p.ids.join('/')===r.pair.ids.join('/'));assert.deepEqual(record.mapped.witness,pair.interiorWitness);for(const p of record.parts)assert.equal(p.positionsSha256,candidate.candidates[0].muscles.find(m=>m.id===p.id).positionsSha256);}
  result.levels.push({level,vertices:inputs.reduce((n,p)=>n+p.positions.length/3,0),triangles:inputs.reduce((n,p)=>n+p.indices.length/3,0)});if(level<r.levels.length-1)inputs=inputs.map(p=>({id:p.id,...subdivideSourceTriangles(p)}));
}
result.scriptSha256=sha(read('scripts/verify-hip-interpolation-triangulation.mjs'));fs.writeFileSync(`${out}/triangulation-readback.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
