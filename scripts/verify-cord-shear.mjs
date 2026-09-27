import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const files=new Map(),hash=b=>createHash('sha256').update(b).digest('hex');
const read=f=>{const b=fs.readFileSync(f);files.set(f,hash(b));return b;},json=f=>JSON.parse(read(f));
const reference=json('docs/anatomy-alignment/neural-component-source.json'),original=JSON.parse(gunzipSync(read(reference.geometryFile)));
const basis=(y,c,h)=>{const a=Math.abs((y-c)/h);if(a>=2)return 0;if(a>=1)return (8-12*a+6*a*a-a*a*a)/6;return 2/3-a*a+a*a*a/2;};
const results=[];
for(const tag of ['cord-shear','cord-shear-seeded']){
  const fitFile=`docs/anatomy-alignment/${tag}-fit.json`,fit=json(fitFile),feas=json(`docs/anatomy-alignment/${tag}-feasibility.json`);
  for(const report of [fit,feas])for(const f of report.files)assert.equal(hash(fs.readFileSync(f.file)),f.sha256,f.file);
  const candidate=JSON.parse(gunzipSync(read(fit.geometryFile))),constraints=JSON.parse(gunzipSync(read(fit.constraintsFile)));
  const {centres,spacing,coefficients}=fit.field;let points=0,maxScalarDifferenceM=0,maxInverseRoundingM=0,fixedOutsideSupport=0;
  for(const p of original)for(const mode of ['source','runtime']){
    const q=candidate.find(q=>q.id===p.id)[mode],a=p[mode];assert.deepEqual(q.indices,a.indices);assert.equal(q.positions.length,a.positions.length);
    if(p.kind==='bone'){assert.deepEqual(q.positions,a.positions);continue;}
    for(let i=0;i<a.positions.length;i+=3){
      const y=a.positions[i+1];let dx=0,dz=0;
      for(let j=0;j<centres.length;j++){const w=basis(y,centres[j],spacing);dx+=w*coefficients[2*j];dz+=w*coefficients[2*j+1];}
      const expected=[Math.fround(a.positions[i]+dx),y,Math.fround(a.positions[i+2]+dz)];
      const difference=Math.max(...expected.map((v,k)=>Math.abs(v-q.positions[i+k])));maxScalarDifferenceM=Math.max(maxScalarDifferenceM,difference);assert.ok(difference<2e-8);
      maxInverseRoundingM=Math.max(maxInverseRoundingM,Math.abs(q.positions[i]-dx-a.positions[i]),Math.abs(q.positions[i+2]-dz-a.positions[i+2]));
      assert.equal(q.positions[i+1],y);points++;
      if(y<=fit.supportY[0]||y>=fit.supportY[1]){assert.deepEqual(q.positions.slice(i,i+3),a.positions.slice(i,i+3));fixedOutsideSupport++;}
    }
  }
  // Independently rebuild every saved linear row from source coordinates and
  // normals. This checks arithmetic, not whether the chosen tangent is anatomy.
  let maxRowDifference=0;
  for(const r of constraints){
    const p=original.find(p=>p.id===r.cordId).source.positions.slice(3*r.vertex,3*r.vertex+3);assert.deepEqual(p,r.original);
    assert.deepEqual(r.point,r.original); // Current rejected candidates have one linearization only.
    for(let j=0;j<centres.length;j++)for(let k=0;k<2;k++){
      const value=basis(p[1],centres[j],spacing)*r.normal[k===0?0:2];maxRowDifference=Math.max(maxRowDifference,Math.abs(value-r.a[2*j+k]));
    }
    assert.equal(r.b,r.required);
  }
  assert.ok(maxRowDifference<1e-12);
  const certificate=feas.certificate,n=coefficients.length,normal=Array(n).fill(0);let rhs=0,weightSum=0;
  for(const r of certificate.rows){
    assert.ok(r.weight>=0);
    const originalRow=r.index<constraints.length?constraints[r.index]:{
      a:Array.from({length:n},(_,j)=>j===(r.index-constraints.length)%n?(r.index-constraints.length<n?1:-1):0),b:-fit.coefficientBoundMm/1000};
    assert.ok(r.a.every((v,i)=>v===originalRow.a[i]));assert.equal(r.b,originalRow.b); // ±0 are the same linear coefficient.
    for(let j=0;j<n;j++)normal[j]+=r.weight*r.a[j];rhs+=r.weight*r.b;weightSum+=r.weight;
  }
  const residualBoundM=normal.reduce((s,v)=>s+Math.abs(v),0)*fit.coefficientBoundMm/1000;
  assert.ok(Math.abs(weightSum-1)<1e-12);assert.ok(rhs-residualBoundM>1e-4);
  results.push({tag,points,maxScalarDifferenceM,maxInverseRoundingM,fixedOutsideSupport,constraints:constraints.length,maxRowDifference,
    certificateRows:certificate.rows.length,certificateRhsM:rhs,residualBoundM,strictContradictionMarginM:rhs-residualBoundM});
}
read('scripts/verify-cord-shear.mjs');
fs.writeFileSync('docs/anatomy-alignment/cord-shear-readback.json',JSON.stringify({scope:'Scalar reconstruction of all saved cord positions/indices, every linear row, and bounded finite-system contradiction certificates; not clinical or full independent collision validation.',results,files:[...files].map(([file,sha256])=>({file,sha256}))},null,2)+'\n');
console.log(JSON.stringify(results));
