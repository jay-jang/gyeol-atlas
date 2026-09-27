import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Matrix4} from 'three';
import {lowerBodyPoseContext} from './lib/lower-body-pose-context.mjs';
const ctx=lowerBodyPoseContext(process.argv[2]),{read,sha}=ctx,out='.cache/hip-cartilage-pivots',sphereBytes=read(`${out}/report.json`),legBytes=read(`${out}/legs.json`),s=JSON.parse(sphereBytes),r=JSON.parse(legBytes);
for(const f of [...s.files,...r.files])assert.equal(sha(read(f.file)),f.sha256,f.file);
assert.equal(r.cartilageReportSha256,sha(sphereBytes));
const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a),apply=(a,v)=>[0,1,2].map(k=>a[k]*v[0]+a[k+4]*v[1]+a[k+8]*v[2]+a[k+12]);
const stats=a=>{a.sort((a,b)=>a-b);return {count:a.length,rmsMm:1000*Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length),p95Mm:1000*a[Math.floor(a.length*.95)],maximumMm:1000*a.at(-1)};};
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`),sameStats=(a,b)=>{assert.equal(a.count,b.count);for(const k of ['rmsMm','p95Mm','maximumMm'])close(a[k],b[k]);};
const result={createdAt:new Date().toISOString(),sphereReportSha256:sha(sphereBytes),legReportSha256:sha(legBytes),cartilage:[],sampling:{surfaces:0,samples:0,inputTriangles:0,maximumAreaResidualSquareMetres:0,maximumPointResidualMm:0},rotations:[],sensitivity:[],limits:[
  'Binary STL byte decoding and radial residuals use scalar arithmetic without STLLoader or the sphere optimizer. Exact coordinate welding precedes millimetre-to-metre Float32 conversion as in the fitting input.',
  'Area sums, duplicate treatment, sample triangle/barycentric membership and matrix/pivot arithmetic are replayed. Leg geometry decoding uses the frozen shared context.',
  'No independent ICP optimization, global nearest-surface distance search, full-body containment/crossing or anatomical landmark validation is performed.'
]};
function samplingAudit(triangles,record){
  const seen=new Set(),ranges=new Map();let total=0,duplicate=0,zero=0;
  for(let i=0;i<triangles.length;i++){
    const t=triangles[i],key=t.map(p=>p.join(',')).sort().join('|');if(seen.has(key)){duplicate++;continue;}seen.add(key);
    const area=norm(cross(sub(t[1],t[0]),sub(t[2],t[0])))/2;if(area===0){zero++;continue;}ranges.set(i,[total,total+area]);total+=area;
  }
  assert.equal(duplicate,record.exactDuplicateTriangles);assert.equal(zero,record.zeroAreaTriangles);assert.equal(ranges.size,record.uniquePositiveAreaTriangles);close(total,record.totalAreaSquareMetres,1e-10);
  result.sampling.maximumAreaResidualSquareMetres=Math.max(result.sampling.maximumAreaResidualSquareMetres,Math.abs(total-record.totalAreaSquareMetres));
  record.samples.forEach((s,i)=>{const t=triangles[s.face],p=[0,1,2].map(k=>t.reduce((sum,v,j)=>sum+v[k]*s.barycentric[j],0)),residual=1000*norm(sub(p,s.point)),range=ranges.get(s.face),at=(i+.5)*total/record.samples.length;
    assert.ok(s.barycentric.every(v=>v>0&&v<1));close(s.barycentric.reduce((a,b)=>a+b,0),1,1e-12);assert.ok(range&&at>=range[0]-1e-12&&at<=range[1]+1e-12);assert.ok(residual<1e-8);
    result.sampling.maximumPointResidualMm=Math.max(result.sampling.maximumPointResidualMm,residual);result.sampling.samples++;
  });result.sampling.inputTriangles+=triangles.length;result.sampling.surfaces++;
}
for(const p of s.parts){
  const bytes=read(path.join(process.argv[2],p.file));assert.equal(sha(bytes),p.sha256);const count=bytes.readUInt32LE(80);assert.equal(bytes.length,84+count*50);
  const vertices=new Map(),triangles=[];
  for(let i=0;i<count;i++)triangles.push([0,1,2].map(v=>{
    const raw=[0,1,2].map(k=>bytes.readFloatLE(84+i*50+12+v*12+k*4)),point=raw.map(v=>Math.fround(v*.001));vertices.set(raw.join('/'),point);return point;
  }));assert.equal(vertices.size,p.vertices);assert.equal(count*3,p.indexReferences);
  const residual=stats([...vertices.values()].map(v=>Math.abs(norm(sub(v,p.fit.centre))-p.fit.radius)));sameStats(residual,p.fullVertexResidual);
  sameStats(stats(p.sampling.samples.map(v=>Math.abs(norm(sub(v.point,p.fit.centre))-p.fit.radius))),p.fit.residual);
  samplingAudit(triangles,p.sampling);result.cartilage.push({side:p.side,name:p.name,vertices:vertices.size,triangles:count,residual});
}
for(const p of s.sideDifferences){const [a,b]=s.parts.filter(q=>q.side===p.side);close(1000*norm(sub(a.fit.centre,b.fit.centre)),p.centreDifferenceMm);}
const bones=new Map(ctx.bones.map(b=>[`${b.side}-${b.name}`,{...b,placed:b.raw.clone().applyMatrix4(new Matrix4().fromArray(r.root))}]));
const triangles=g=>Array.from({length:g.index.count/3},(_,i)=>[0,1,2].map(k=>Array.from(g.attributes.position.array.slice(g.index.getX(i*3+k)*3,g.index.getX(i*3+k)*3+3))));
for(const p of r.sampling){const b=bones.get(`${p.side}-${p.name}`);samplingAudit(triangles(b.placed),p.source);samplingAudit(triangles(b.target),p.target);}
for(const c of r.candidates){
  const a=c.matrix,columns=[0,1,2].map(k=>a.slice(k*4,k*4+3)),det=dot(columns[0],cross(columns[1],columns[2]));let gram=0;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)gram=Math.max(gram,Math.abs(dot(columns[i],columns[j])-+(i===j)));
  close(det,1,1e-12);assert.ok(gram<1e-12);const pivot=apply(r.root,c.sourcePivot);assert.ok(norm(sub(pivot,c.pivot))<1e-12);const motion=1000*norm(sub(apply(a,pivot),pivot));assert.ok(motion<1e-8);close(motion,c.pivotMotionMm);
  assert.deepEqual(c.bones.find(b=>b.name==='Pelvis').forward,r.baseline.find(b=>b.name==='Pelvis'&&b.side===c.side).forward);
  result.rotations.push({side:c.side,pivotName:c.pivotName,determinant:det,maximumGramError:gram,pivotMotionMm:motion});
}
for(const side of ['left','right']){
  const [a,b]=r.candidates.filter(c=>c.side===side),distances=[];
  for(const bone of [...bones.values()].filter(b=>b.side===side&&b.name!=='Pelvis')){
    const p=bone.placed.attributes.position.array,used=[...new Set(bone.placed.index.array)].sort((a,b)=>a-b);
    for(const i of used){const v=Array.from(p.slice(3*i,3*i+3));distances.push(norm(sub(apply(a.matrix,v),apply(b.matrix,v))));}
  }
  const row={side,...stats(distances)};sameStats(row,r.sensitivity.find(s=>s.side===side));result.sensitivity.push(row);
}
result.scriptSha256=sha(read('scripts/verify-hip-cartilage-pivots.mjs'));fs.writeFileSync(`${out}/readback.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
