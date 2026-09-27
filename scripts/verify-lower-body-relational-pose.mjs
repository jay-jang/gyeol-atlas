// Independent scalar replay of both declared matrix stages and every edge.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const out='.cache/lower-body-relational-pose',read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=read(`${out}/report.json`),r=JSON.parse(bytes);for(const f of r.files)assert.equal(sha(read(f.file)),f.sha256,f.file);
const packing=json('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative,sourceZip=read('.cache/donor-fidelity/source-full.bin.gz'),zip=read(r.binary.path);assert.equal(sha(sourceZip),packing.sha256);assert.equal(sha(zip),r.binary.sha256);
const raw=gunzipSync(sourceZip),saved=gunzipSync(zip);assert.equal(saved.length,r.binary.bytes);
const apply=(a,v)=>[0,1,2].map(k=>Math.fround(a[k]*v[0]+a[k+4]*v[1]+a[k+8]*v[2]+a[k+12]));
const result={createdAt:new Date().toISOString(),reportSha256:sha(bytes),binarySha256:sha(zip),vertices:0,indexReferences:0,coordinateDifferences:0,edgeOccurrences:0,maximumEdgeLengthChangeMm:0,maximumVertexDisplacementMm:0,rigidChecks:[],meshes:[]};
for(const s of r.sides){const a=s.adjustmentMatrix;let maximumGramError=0;for(let i=0;i<3;i++)for(let j=0;j<3;j++){let dot=0;for(let k=0;k<3;k++)dot+=a[4*i+k]*a[4*j+k];maximumGramError=Math.max(maximumGramError,Math.abs(dot-+(i===j)));}const determinant=a[0]*(a[5]*a[10]-a[9]*a[6])-a[4]*(a[1]*a[10]-a[9]*a[2])+a[8]*(a[1]*a[6]-a[5]*a[2]);assert.ok(maximumGramError<1e-12&&Math.abs(determinant-1)<1e-12);result.rigidChecks.push({side:s.side,maximumGramError,determinant,translationNormMm:1000*Math.hypot(...s.fit.parameters.slice(0,3)),rotationDegrees:180/Math.PI*Math.hypot(...s.fit.parameters.slice(3))});}
for(const p of r.binary.records){
  const original=packing.parts.find(q=>q.id===p.id),m=r.muscles.find(m=>m.id===p.id),side=r.sides.find(s=>s.side===m.side),initial=new Float32Array(p.vertexCount*3),after=new Float32Array(p.vertexCount*3);
  assert.equal(p.vertexCount,original.vertexCount);assert.equal(p.indexCount,original.indexCount);let maximumDisplacementMm=0,maximumEdgeLengthChangeMm=0;
  for(let i=0;i<p.vertexCount;i++){
    const v=[0,1,2].map(k=>raw.readFloatLE(original.positions+4*(3*i+k))),before=apply(side.initialMatrix,v),expected=apply(side.adjustmentMatrix,before);initial.set(before,3*i);after.set(expected,3*i);
    for(let k=0;k<3;k++){const actual=saved.readFloatLE(p.positions+4*(3*i+k));result.coordinateDifferences+=actual!==expected[k];assert.equal(actual,expected[k],`${p.id}/${i}/${k}`);}
    maximumDisplacementMm=Math.max(maximumDisplacementMm,1000*Math.hypot(...before.map((v,k)=>v-expected[k])));
  }
  const indices=[];for(let i=0;i<p.indexCount;i++){const value=saved.readUInt32LE(p.indices+4*i);assert.equal(value,raw.readUInt32LE(original.indices+4*i));indices.push(value);}
  for(let i=0;i<indices.length;i+=3)for(let edge=0;edge<3;edge++){const a=indices[i+edge]*3,b=indices[i+(edge+1)%3]*3,distance=p=>Math.hypot(p[a]-p[b],p[a+1]-p[b+1],p[a+2]-p[b+2]);maximumEdgeLengthChangeMm=Math.max(maximumEdgeLengthChangeMm,1000*Math.abs(distance(initial)-distance(after)));result.edgeOccurrences++;}
  assert.equal(sha(saved.subarray(p.positions,p.positions+p.vertexCount*12)),m.positionsSha256);assert.equal(sha(saved.subarray(p.indices,p.indices+p.indexCount*4)),m.indicesSha256);
  result.vertices+=p.vertexCount;result.indexReferences+=p.indexCount;result.maximumEdgeLengthChangeMm=Math.max(result.maximumEdgeLengthChangeMm,maximumEdgeLengthChangeMm);result.maximumVertexDisplacementMm=Math.max(result.maximumVertexDisplacementMm,maximumDisplacementMm);result.meshes.push({id:p.id,maximumDisplacementMm,maximumEdgeLengthChangeMm});
}
result.scriptSha256=sha(read('scripts/verify-lower-body-relational-pose.mjs'));result.limitations=['All serialized muscle vertices/indices and triangle-edge occurrences are checked, not independent anatomy or a repeat of containment/crossing searches.','Reported edge changes are the effect of the second Float32 matrix stage. Source bones are not serialized into this candidate binary.'];
fs.writeFileSync(`${out}/readback.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,meshes:result.meshes.length}));
