// Offline constant-plateau diagnostic derived from the finite section grid.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {shearPoint} from './lib/cord-shear.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const files=new Map(),read=file=>{const b=fs.readFileSync(file);files.set(file,hash(b));return b;};
const grid=JSON.parse(read('docs/anatomy-alignment/cord-section-clearance.json'));
const source=JSON.parse(read('docs/anatomy-alignment/neural-component-source.json'));
const original=JSON.parse(gunzipSync(read(source.geometryFile)));
const oldFit=JSON.parse(read('docs/anatomy-alignment/cord-shear-fit.json'));
assert.equal(grid.geometrySha256,files.get(source.geometryFile));
const planes=grid.results.filter(r=>r.grid),common=planes[0].grid.filter((g,i)=>planes.every(r=>r.grid[i].hits.length===0));
assert.equal(planes.length,11);assert.equal(common.length,18);
const chosen=common.sort((a,b)=>Math.hypot(a.dxMm,a.dzMm)-Math.hypot(b.dxMm,b.dzMm)||a.dxMm-b.dxMm||a.dzMm-b.dzMm)[0];
assert.deepEqual([chosen.dxMm,chosen.dzMm],[-1.5,2.5]);
const field={centres:oldFit.field.centres,spacing:oldFit.field.spacing,
  coefficients:oldFit.field.centres.flatMap(()=>[chosen.dxMm/1000,chosen.dzMm/1000])};
const parts=original.map(part=>({...part,...Object.fromEntries(['source','runtime'].map(mode=>{
  const input=part[mode],positions=Float32Array.from(input.positions);
  if(part.kind==='cord')for(let i=0;i<positions.length;i+=3)positions.set(shearPoint(input.positions.slice(i,i+3),field),i);
  return [mode,{positions:[...positions],indices:input.indices}];
}))}));
const out='.cache/cord-section-grid-shift',geometryFile=`${out}/candidate.json.gz`;
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(geometryFile,gzipSync(JSON.stringify(parts)));read(geometryFile);
for(const file of ['scripts/generate-cord-section-grid-shift.mjs','scripts/lib/cord-shear.mjs'])read(file);
const changed=[];
for(const part of original.filter(p=>p.kind==='cord'))for(const mode of ['source','runtime']){
  const input=part[mode].positions,output=parts.find(p=>p.id===part.id)[mode].positions;
  let moved=0,maxMm=0;
  for(let i=0;i<input.length;i+=3){const d=Math.hypot(output[i]-input[i],output[i+1]-input[i+1],output[i+2]-input[i+2]);
    if(d>0)moved++;maxMm=Math.max(maxMm,1000*d);assert.equal(input[i+1],output[i+1]);}
  changed.push({id:part.id,mode,moved,maximumDisplacementMm:maxMm});
}
const report={status:'OFFLINE DIAGNOSTIC ONLY; NOT APPLIED OR ANATOMICALLY VALIDATED',
  method:'Smallest common safe 0.5 mm-grid translation in 11 transverse source planes, spread to all cord pieces with cubic height field and taper; actual 3-D audit required.',
  planes:planes.length,commonSafeGridPositions:common.length,chosen,field,supportY:oldFit.supportY,
  geometryFile,changed,files:[...files].map(([file,sha256])=>({file,sha256}))};
fs.writeFileSync('docs/anatomy-alignment/cord-section-grid-shift.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({common:common.length,chosen,changed:changed.filter(r=>r.moved).length,geometryFile}));
