// Scalar replay is independent of Three's matrix application, not an
// independent fit, full crossing search, or clinical anatomy assessment.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {lowerBodyPoseContext} from './lib/lower-body-pose-context.mjs';
const out='.cache/lumbar-source-frames',read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=read(`${out}/report.json`),r=JSON.parse(bytes);for(const f of r.files)assert.equal(sha(read(f.file)),f.sha256,f.file);
const ctx=lowerBodyPoseContext(process.argv[2]),packing=json('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative,raw=gunzipSync(read('.cache/donor-fidelity/source-full.bin.gz'));
const apply=(a,v)=>[0,1,2].map(k=>Math.fround(a[k]*v[0]+a[k+4]*v[1]+a[k+8]*v[2]+a[k+12]));
const mul=(a,b)=>Array.from({length:16},(_,i)=>[0,1,2,3].reduce((s,k)=>s+a[i%4+4*k]*b[k+4*Math.floor(i/4)],0));
const sub=(a,b)=>a.map((v,k)=>v-b[k]),add=(a,b)=>a.map((v,k)=>v+b[k]),scale=(a,t)=>a.map(v=>v*t),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const result={createdAt:new Date().toISOString(),reportSha256:sha(bytes),candidates:[],limitations:['Scalar replay and stored witness verification, not a repeated nearest-surface fit or exhaustive crossing search.','Common lumbar rigid fitting composes with inverse approximate Denver similarity: the resulting psoas transform is not rigid.','Strict triangle crossings are geometric evidence, not measured tissue penetration or proof of abnormal attachment.']};
for(const c of r.psoasCandidates){
  const zip=read(c.binary.path);assert.equal(sha(zip),c.binary.sha256);const saved=gunzipSync(zip);assert.equal(saved.length,c.binary.bytes);
  const frame=r.frames.find(f=>f.name===`lumbar-${c.mode}`),composed=mul(c.sourceToAtlasMatrix,r.denverMatrices.final),compositionError=Math.max(...composed.map((v,i)=>Math.abs(v-frame.matrix[i])));assert.ok(compositionError<1e-12);
  const a=c.sourceToAtlasMatrix,lengths=[0,1,2].map(i=>Math.hypot(a[i*4],a[i*4+1],a[i*4+2])),s=lengths[0];let maximumGramError=0;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){const d=[0,1,2].reduce((v,k)=>v+a[4*i+k]*a[4*j+k],0);maximumGramError=Math.max(maximumGramError,Math.abs(d-+(i===j)*s*s));}assert.ok(maximumGramError<1e-12);
  const determinant=dot([a[0],a[1],a[2]],cross([a[4],a[5],a[6]],[a[8],a[9],a[10]]));assert.ok(determinant>0);
  const row={mode:c.mode,binarySha256:sha(zip),compositionError,scale:s,determinant,maximumGramError,vertices:0,indexReferences:0,coordinateDifferences:0,edgeOccurrences:0,maximumScaledEdgeResidualMm:0,witnesses:0,maximumWitnessResidualMm:0};
  const candidateData=new Map();
  for(const p of c.binary.records){
    const q=packing.parts.find(p2=>p2.id===p.id),m=c.muscles.find(m=>m.id===p.id);assert.equal(p.vertexCount,q.vertexCount);assert.equal(p.indexCount,q.indexCount);
    const positions=[],source=[],indices=[];
    for(let i=0;i<p.vertexCount;i++){const v=[0,1,2].map(k=>raw.readFloatLE(q.positions+4*(3*i+k))),expected=apply(a,v),actual=[0,1,2].map(k=>saved.readFloatLE(p.positions+4*(3*i+k)));assert.deepEqual(actual,expected);source.push(v);positions.push(actual);}
    for(let i=0;i<p.indexCount;i++){const index=saved.readUInt32LE(p.indices+4*i);assert.equal(index,raw.readUInt32LE(q.indices+4*i));indices.push(index);}
    for(let i=0;i<indices.length;i+=3)for(let e=0;e<3;e++){const u=indices[i+e],v=indices[i+(e+1)%3],delta=Math.abs(Math.hypot(...sub(positions[u],positions[v]))-s*Math.hypot(...sub(source[u],source[v])))*1000;row.maximumScaledEdgeResidualMm=Math.max(row.maximumScaledEdgeResidualMm,delta);row.edgeOccurrences++;}
    assert.equal(sha(saved.subarray(p.positions,p.positions+12*p.vertexCount)),m.positionsSha256);assert.equal(sha(saved.subarray(p.indices,p.indices+4*p.indexCount)),m.indicesSha256);
    row.vertices+=p.vertexCount;row.indexReferences+=p.indexCount;candidateData.set(p.id,{positions,indices});
  }
  const triangleSets=new Map(),key=triangle=>triangle.map(p=>p.join(',')).sort().join('|');
  function triangles(id){if(triangleSets.has(id))return triangleSets.get(id);let data=candidateData.get(id);if(!data){const g=ctx.runtimeMap.get(id).g;data={positions:Array.from({length:g.attributes.position.count},(_,i)=>Array.from(g.attributes.position.array.slice(i*3,i*3+3))),indices:Array.from(g.index.array)};}const set=new Set();for(let i=0;i<data.indices.length;i+=3)set.add(key(data.indices.slice(i,i+3).map(n=>data.positions[n])));triangleSets.set(id,set);return set;}
  for(const p of c.relations.filter(p=>p.after&&!p.legacy)){
    const w=p.interiorWitness;assert.ok(w);assert.ok(triangles(p.ids[0]).has(key(w.a)));assert.ok(triangles(p.ids[1]).has(key(w.b)));
    const [from,onto]=w.direction==='a-to-b'?[w.a,w.b]:[w.b,w.a],edgePoint=add(from[w.edge],scale(sub(from[(w.edge+1)%3],from[w.edge]),w.segmentFraction)),facePoint=onto.reduce((s,v,i)=>add(s,scale(v,w.barycentric[i])),[0,0,0]);
    assert.ok(w.segmentFraction>0&&w.segmentFraction<1&&w.barycentric.every(v=>v>0&&v<1));assert.ok(Math.abs(w.barycentric.reduce((s,v)=>s+v,0)-1)<1e-12);
    const residual=Math.max(Math.hypot(...sub(edgePoint,facePoint)),Math.hypot(...sub(edgePoint,w.point)))*1000;assert.ok(residual<1e-8);row.maximumWitnessResidualMm=Math.max(row.maximumWitnessResidualMm,residual);
    const extent=(a,b)=>{const n=cross(sub(a[1],a[0]),sub(a[2],a[0])),length=Math.hypot(...n),d=b.map(v=>dot(n,sub(v,a[0]))/length);return Math.min(-Math.min(...d),Math.max(...d));},straddle=1000*Math.min(extent(w.a,w.b),extent(w.b,w.a));assert.ok(straddle>.001);assert.ok(Math.abs(straddle-w.planeStraddleExtentMm)<1e-8);row.witnesses++;
  }
  result.candidates.push(row);
}
result.scriptSha256=sha(read('scripts/verify-lumbar-source-frames.mjs'));fs.writeFileSync(`${out}/readback.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
