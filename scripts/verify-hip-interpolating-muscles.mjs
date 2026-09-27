// Scalar replay of the shared blend. Nearest queries intentionally reuse BVH;
// this is not an independent anatomical registration or crossing search.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {lowerBodyPoseContext} from './lib/lower-body-pose-context.mjs';
const ctx=lowerBodyPoseContext(process.argv[2]),{read,sha,finish}=ctx,out='.cache/hip-interpolating-muscles',bytes=read(`${out}/report.json`),r=JSON.parse(bytes);for(const f of r.files)assert.equal(sha(read(f.file)),f.sha256,f.file);
const lumbar=JSON.parse(read('docs/anatomy-alignment/lumbar-source-frames.json')),packed=JSON.parse(gunzipSync(read(lumbar.partsFile))),geometry=p=>{const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(p.positions),3));g.setIndex(new BufferAttribute(new Uint32Array(p.indices),1));return g;};
const apply=(a,v)=>[0,1,2].map(k=>a[k]*v[0]+a[k+4]*v[1]+a[k+8]*v[2]+a[k+12]),root=raw=>{const g=raw.clone(),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setXYZ(i,...apply(r.root,[p.getX(i),p.getY(i),p.getZ(i)]));return finish(g);};
const bones=new Map(ctx.bones.map(b=>[`${b.side}-${b.name}`,root(b.raw)]));for(const p of lumbar.parts)bones.set(p.name,root(geometry(packed.find(q=>q.id===p.name)).applyMatrix4(new Matrix4().fromArray(lumbar.denverMatrices.final))));
const frames=r.frames.map(f=>({...f,g:finish(mergeGeometries(f.members.map(name=>bones.get(name))))})),query=new Vector3();
const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a),det=a=>dot(a.slice(0,3),cross(a.slice(3,6),a.slice(6,9)));
function field(p){
  const rows=frames.map(f=>{const nearest=f.g.boundsTree.closestPointToPoint(query.fromArray(p)).point.toArray(),difference=sub(p,nearest);return {f,difference,d2:dot(difference,difference),mapped:apply(f.matrix,p)};});
  const zero=rows.filter(q=>q.d2===0);
  if(zero.length){for(const q of zero)assert.deepEqual(q.f.matrix,zero[0].f.matrix);const a=zero[0].f.matrix,jac=[a[0],a[4],a[8],a[1],a[5],a[9],a[2],a[6],a[10]];return {mapped:zero[0].mapped,jac,determinant:det(jac)};}
  const minimum=Math.min(...rows.map(q=>q.d2));let sum=0;
  for(const q of rows){q.weight=(minimum/q.d2)**2;sum+=q.weight;q.gradient=q.difference.map(v=>v*(-4/q.d2));}
  const mapped=[0,0,0],jac=Array(9).fill(0);
  for(const q of rows){q.w=q.weight/sum;for(let i=0;i<3;i++){mapped[i]+=q.mapped[i]*q.w;for(let j=0;j<3;j++)jac[i*3+j]+=q.w*q.f.matrix[j*4+i];}}
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const a=rows[i],b=rows[j],factor=a.w*b.w;if(factor===0)continue;for(let k=0;k<3;k++)for(let n=0;n<3;n++)jac[k*3+n]+=factor*(a.mapped[k]-b.mapped[k])*(a.gradient[n]-b.gradient[n]);}
  return {mapped,jac,determinant:det(jac)};
}
const result={createdAt:new Date().toISOString(),reportSha256:sha(bytes),candidates:[],limits:[
  'Full serialized coordinates/indices are compared with separate scalar root/blend arithmetic; nearest source points still use the same BVH/context implementation. No independent nearest-minimum or registration approval.',
  'All muscle vertex Jacobians and all16 bone own-frame Float32 differences are replayed. Three vertices per muscle and the recorded worst vertex/centroid receive central differences. Full centroid counts are not independently replayed.',
  'Every saved new-crossing witness is checked for actual triangle membership and segment/plane/barycentric arithmetic. Absence of a witness is retained; no independent full crossing or containment search is made.'
]};
const triangle=(g,face)=>[0,1,2].map(k=>{const i=g.index.getX(face*3+k);return Array.from(g.attributes.position.array.slice(i*3,i*3+3));}),key=t=>t.map(p=>p.join(',')).sort().join('|');
for(const c of r.candidates){
  const zip=read(c.binary.path);assert.equal(sha(zip),c.binary.sha256);const binary=gunzipSync(zip),placed=new Map(),sets=new Map(),row={mode:c.mode,binarySha256:sha(zip),vertices:0,indexReferences:0,coordinateDifferences:0,maximumCoordinateDifferenceMm:0,jacobianVertices:{count:0,minimum:Infinity,maximum:-Infinity,nonPositive:0},finiteDifference:{points:0,stepMetres:1e-7,maximumJacobianDifference:0},witnesses:0,missingWitnesses:0,maximumWitnessResidualMm:0};
  for(const record of c.binary.records){
    const m=ctx.muscles.find(m=>m.id===record.id),g=m.raw.clone(),p=g.attributes.position,selected=new Set([0,Math.floor(p.count/2),p.count-1]);
    for(let i=0;i<p.count;i++){
      const v=apply(r.root,[p.getX(i),p.getY(i),p.getZ(i)]).map(Math.fround),q=field(v),expected=q.mapped.map(Math.fround),actual=[0,1,2].map(k=>binary.readFloatLE(record.positions+4*(3*i+k))),error=1000*norm(sub(actual,expected));
      if(error!==0)row.coordinateDifferences++;row.maximumCoordinateDifferenceMm=Math.max(row.maximumCoordinateDifferenceMm,error);assert.ok(error<.000001);p.setXYZ(i,...actual);row.vertices++;
      const j=row.jacobianVertices;j.count++;j.minimum=Math.min(j.minimum,q.determinant);j.maximum=Math.max(j.maximum,q.determinant);j.nonPositive+=q.determinant<=0;
      if(selected.has(i)){const h=row.finiteDifference.stepMetres;for(let axis=0;axis<3;axis++){const plus=[...v],minus=[...v];plus[axis]+=h;minus[axis]-=h;const a=field(plus).mapped,b=field(minus).mapped;for(let k=0;k<3;k++)row.finiteDifference.maximumJacobianDifference=Math.max(row.finiteDifference.maximumJacobianDifference,Math.abs((a[k]-b[k])/(2*h)-q.jac[k*3+axis]));}row.finiteDifference.points++;}
    }
    for(let i=0;i<record.indexCount;i++)assert.equal(binary.readUInt32LE(record.indices+4*i),g.index.getX(i));row.indexReferences+=record.indexCount;
    const declared=c.muscles.find(m=>m.id===record.id);assert.equal(sha(binary.subarray(record.positions,record.positions+record.vertexCount*12)),declared.positionsSha256);assert.equal(sha(binary.subarray(record.indices,record.indices+record.indexCount*4)),declared.indicesSha256);placed.set(record.id,g);
  }
  row.boneFrameChecks=[];
  for(const b of r.bones){const g=bones.get(b.name),a=frames.find(f=>f.name===b.frame).matrix;let differences=0;
    for(let i=0;i<g.attributes.position.count;i++){const p=Array.from(g.attributes.position.array.slice(i*3,i*3+3)),expected=apply(a,p).map(Math.fround),actual=field(p).mapped.map(Math.fround);differences+=actual.some((v,k)=>v!==expected[k]);}
    assert.equal(differences,c.bones.find(q=>q.name===b.name).ownFrameFloat32Differences);row.boneFrameChecks.push({name:b.name,anchor:b.anchor,vertices:g.attributes.position.count,ownFrameFloat32Differences:differences});
  }
  row.minimumChecks=[];
  for(const [kind,w] of [['vertex',c.minimumJacobianWitness],['centroid',c.minimumCentroidJacobianWitness]]){
    const raw=ctx.muscles.find(m=>m.id===w.id).raw,p=raw.attributes.position;
    const at=i=>apply(r.root,[p.getX(i),p.getY(i),p.getZ(i)]).map(Math.fround);
    const original=kind==='vertex'?at(w.vertex):[0,1,2].map(k=>[0,1,2].reduce((n,j)=>n+at(raw.index.getX(w.face*3+j))[k],0)/3);
    assert.ok(norm(sub(original,w.point))<1e-12);const q=field(w.point),h=1e-7,numerical=Array(9).fill(0);
    for(let axis=0;axis<3;axis++){const plus=[...w.point],minus=[...w.point];plus[axis]+=h;minus[axis]-=h;const a=field(plus).mapped,b=field(minus).mapped;for(let k=0;k<3;k++)numerical[3*k+axis]=(a[k]-b[k])/(2*h);}
    const difference=Math.max(...numerical.map((v,k)=>Math.abs(v-q.jac[k])));assert.ok(Math.abs(q.determinant-w.determinant)<1e-10);assert.ok(difference<.001);row.minimumChecks.push({kind,id:w.id,sourcePointResidualMm:1000*norm(sub(original,w.point)),determinant:q.determinant,finiteDifferenceDeterminant:det(numerical),maximumJacobianDifference:difference});
  }
  for(const k of ['minimum','maximum'])assert.ok(Math.abs(row.jacobianVertices[k]-c.jacobianVertices[k])<1e-10);assert.equal(row.jacobianVertices.count,c.jacobianVertices.count);assert.equal(row.jacobianVertices.nonPositive,c.jacobianVertices.nonPositive);assert.ok(row.finiteDifference.maximumJacobianDifference<.001);
  function triangleSet(g){if(!sets.has(g)){const set=new Set();for(let i=0;i<g.index.count/3;i++)set.add(key(triangle(g,i)));sets.set(g,set);}return sets.get(g);}
  function witness(p,a,b){const w=p.interiorWitness;if(!w){row.missingWitnesses++;return;}assert.ok(triangleSet(a).has(key(w.a)));assert.ok(triangleSet(b).has(key(w.b)));const [from,onto]=w.direction==='a-to-b'?[w.a,w.b]:[w.b,w.a],edge=from[w.edge].map((v,k)=>v+(from[(w.edge+1)%3][k]-v)*w.segmentFraction),face=[0,1,2].map(k=>onto.reduce((s,v,j)=>s+v[k]*w.barycentric[j],0)),error=1000*Math.max(norm(sub(edge,face)),norm(sub(edge,w.point)));assert.ok(error<1e-8);assert.ok(w.segmentFraction>0&&w.segmentFraction<1&&w.barycentric.every(v=>v>0&&v<1));
    const extent=(a,b)=>{const n=cross(sub(a[1],a[0]),sub(a[2],a[0])),length=norm(n),d=b.map(v=>dot(n,sub(v,a[0]))/length);return Math.min(-Math.min(...d),Math.max(...d));},straddle=1000*Math.min(extent(w.a,w.b),extent(w.b,w.a));assert.ok(straddle>.001);assert.ok(Math.abs(straddle-w.planeStraddleExtentMm)<1e-8);row.maximumWitnessResidualMm=Math.max(row.maximumWitnessResidualMm,error);row.witnesses++;
  }
  for(const p of c.relations.filter(p=>p.after&&(!p.legacy||p.sourceInternal===false)))witness(p,placed.get(p.ids[0])||ctx.runtimeMap.get(p.ids[0]).g,placed.get(p.ids[1])||ctx.runtimeMap.get(p.ids[1]).g);
  const mappedBones=new Map();for(const p of c.sourceBoneRelations.filter(p=>p.after&&!p.source)){
    if(!mappedBones.has(p.bone)){const g=bones.get(p.bone).clone(),pos=g.attributes.position;for(let i=0;i<pos.count;i++)pos.setXYZ(i,...field([pos.getX(i),pos.getY(i),pos.getZ(i)]).mapped);mappedBones.set(p.bone,g);}witness(p,placed.get(p.muscleId),mappedBones.get(p.bone));
  }
  const compatibilityBytes=read('.cache/hip-pivot-bone-crossings/report.json'),compatibility=JSON.parse(compatibilityBytes);assert.equal(sha(compatibilityBytes),r.boneCompatibilitySha256);for(const f of compatibility.files)assert.equal(sha(read(f.file)),f.sha256,f.file);
  row.boneCompatibility={reportSha256:sha(compatibilityBytes),pairs:compatibility.rows.length,witnesses:0,closestPoints:0,maximumPointPlaneResidualMm:0};
  const prescribed=new Map([...bones].map(([name,g])=>[name,g.clone().applyMatrix4(new Matrix4().fromArray(frames.find(f=>f.name===r.bones.find(b=>b.name===name).frame).matrix))]));
  const countBefore=row.witnesses;
  function pointOnTriangle(p,t){const e=sub(t[1],t[0]),f=sub(t[2],t[0]),v=sub(p,t[0]),n=cross(e,f),plane=Math.abs(dot(v,n))/norm(n),aa=dot(e,e),ab=dot(e,f),bb=dot(f,f),av=dot(e,v),bv=dot(f,v),d=aa*bb-ab*ab,u=(bb*av-ab*bv)/d,w=(aa*bv-ab*av)/d;assert.ok(plane<1e-8&&u>=-1e-6&&w>=-1e-6&&u+w<=1+1e-6);row.boneCompatibility.closestPoints++;row.boneCompatibility.maximumPointPlaneResidualMm=Math.max(row.boneCompatibility.maximumPointPlaneResidualMm,plane*1000);}
  for(const pair of compatibility.rows)for(const state of ['source','prescribed']){
    const set=state==='source'?bones:prescribed,a=set.get(pair.names[0]),b=set.get(pair.names[1]),p=pair[state];
    if(p.witness)witness({interiorWitness:p.witness},a,b);
    if(p.closest){const q=p.closest.closest;assert.deepEqual(q.triangleA,triangle(a,q.faceA));assert.deepEqual(q.triangleB,triangle(b,q.faceB));pointOnTriangle(q.a,q.triangleA);pointOnTriangle(q.b,q.triangleB);assert.ok(Math.abs(1000*norm(sub(q.a,q.b))-p.closest.minimumDistanceMm)<1e-8);}
  }
  row.boneCompatibility.witnesses=row.witnesses-countBefore;row.witnesses=countBefore;
  result.candidates.push(row);console.log(JSON.stringify(row));for(const g of placed.values())g.dispose();for(const g of mappedBones.values())g.dispose();
}
result.scriptSha256=sha(read('scripts/verify-hip-interpolating-muscles.mjs'));fs.writeFileSync(`${out}/readback.json`,JSON.stringify(result,null,2)+'\n');
