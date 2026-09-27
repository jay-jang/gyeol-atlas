// Serialized scalar replay, deliberately not importing the field mapper.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const out='.cache/lower-body-protected-flow',read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=read(`${out}/report.json`),r=JSON.parse(bytes);
for(const f of r.files)assert.equal(sha(read(f.file)),f.sha256,f.file);
const packing=json('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative,rawZip=read('.cache/donor-fidelity/source-full.bin.gz'),zip=read(r.binary.path);
assert.equal(sha(rawZip),packing.sha256);assert.equal(sha(zip),r.binary.sha256);
const raw=gunzipSync(rawZip),saved=gunzipSync(zip);assert.equal(saved.length,r.binary.bytes);
let vertices=0,indexReferences=0,coordinateDifferences=0,maximumStepBound=0;
for(const s of r.fit.steps){const bound=135*Math.hypot(...s.displacement)/(64*s.radius);assert.ok(bound<=r.options.maximumBound+1e-14);maximumStepBound=Math.max(maximumStepBound,bound);assert.ok(s.protectedDistance-s.radius>=r.options.margin-1e-12);}
for(const p of r.binary.records){
  const original=packing.parts.find(q=>q.id===p.id),m=r.muscles.find(m=>m.id===p.id),a=r.initialMatrices.find(a=>a.side===m.side).matrix;
  assert.equal(p.vertexCount,original.vertexCount);assert.equal(p.indexCount,original.indexCount);
  for(let i=0;i<p.vertexCount;i++){
    const v=[0,1,2].map(k=>raw.readFloatLE(original.positions+4*(3*i+k)));
    let [x,y,z]=[0,1,2].map(k=>Math.fround(a[k]*v[0]+a[k+4]*v[1]+a[k+8]*v[2]+a[k+12]));
    for(const s of r.fit.steps){const dx=x-s.centre[0],dy=y-s.centre[1],dz=z-s.centre[2],r2=dx*dx+dy*dy+dz*dz;if(r2>=s.radius*s.radius)continue;const t=Math.sqrt(r2)/s.radius,u=1-t,k=u*u*u*u*(4*t+1);x+=k*s.displacement[0];y+=k*s.displacement[1];z+=k*s.displacement[2];}
    for(const [k,value] of [x,y,z].entries()){const actual=saved.readFloatLE(p.positions+4*(3*i+k));coordinateDifferences+=actual!==Math.fround(value);assert.equal(actual,Math.fround(value),`${p.id}/${i}/${k}`);}
  }
  for(let i=0;i<p.indexCount;i++)assert.equal(saved.readUInt32LE(p.indices+4*i),raw.readUInt32LE(original.indices+4*i));
  assert.equal(sha(saved.subarray(p.positions,p.positions+p.vertexCount*12)),m.positionsSha256);assert.equal(sha(saved.subarray(p.indices,p.indices+p.indexCount*4)),m.indicesSha256);
  vertices+=p.vertexCount;indexReferences+=p.indexCount;
}
const result={createdAt:new Date().toISOString(),reportSha256:sha(bytes),binarySha256:sha(zip),vertices,indexReferences,coordinateDifferences,maximumStepBound,scriptSha256:sha(read('scripts/verify-lower-body-protected-flow.mjs')),limitations:['Independent scalar reconstruction of serialized muscle positions/indices; the fit, source envelope assignment, fixed-surface distance queries, containment and crossing screens are not independently rerun.','Initial similarities are rounded to Float32 before the common post-placement field, matching the declared candidate space.']};
fs.writeFileSync(`${out}/readback.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
