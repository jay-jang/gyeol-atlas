// Streaming payload audit avoids inflating each 1.5 GB padded mask into RAM.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGunzip} from 'node:zlib';
import {labelAccumulator} from './lib/nrrd-label-stats.mjs';
const root='.cache/bonehub/ac8de2b38f5ae1a0996053ca0639dd6ae43358f1',hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const inventory=JSON.parse(fs.readFileSync(`${root}/inventory.json`)),receipt=JSON.parse(fs.readFileSync(`${root}/receipt.json`));
const reports=[];
for(const side of ['LEFT','RIGHT']){
  const group=`FOOT_${side}`,mask=inventory.masks.find(m=>m.group===group),source=receipt.files.find(f=>f.path===mask.file);
  assert.equal(hash(source.local),mask.sha256);const compressed=fs.readFileSync(source.local),end=compressed.indexOf(Buffer.from('\n\n'));assert.ok(end>0);
  const parts=inventory.parts.filter(p=>p.group===group),acc=labelAccumulator(mask.sizes,parts.map(p=>p.label));
  const directions=[...mask.directions.matchAll(/\(([^)]+)\)/g)].map(m=>m[1].split(',').map(Number));assert.equal(directions.length,3);
  const origin=mask.origin.replace(/[()]/g,'').split(',').map(Number);
  // The selected sources use diagonal positive LPS axes; reject other layouts.
  for(let a=0;a<3;a++)for(let b=0;b<3;b++)assert.ok(a===b?directions[a][b]>0:directions[a][b]===0);
  const stream=fs.createReadStream(source.local,{start:end+2}).pipe(createGunzip());
  for await(const chunk of stream)acc.push(chunk);
  const result=acc.finish(),rows=result.rows.map(r=>{
    const p=parts.find(p=>p.name===r.name),bounds=[r.min,r.max].map((bound,end)=>bound.map((v,k)=>origin[k]+(v+(end?.5:-.5))*directions[k][k]));
    const excess=[0,1,2].map(k=>Math.max(0,bounds[0][k]-p.boundsSourceLps[0][k],p.boundsSourceLps[1][k]-bounds[1][k]));
    return {...r,voxelSupportBoundsLps:bounds,stlBoundsSourceLps:p.boundsSourceLps,stlBoundExcessLps:excess,stlSha256:p.sha256};
  });
  reports.push({group,maskSha256:mask.sha256,bytes:result.bytes,labels:rows});console.log(JSON.stringify({group,bytes:result.bytes,labels:rows.length,totalForeground:rows.reduce((n,r)=>n+r.voxels,0),maxStlBoundExcess:Math.max(...rows.flatMap(r=>r.stlBoundExcessLps))}));
}
const report={createdAt:new Date().toISOString(),status:'Source foot mask payloads inspected; no HRA fit or runtime export',reports,
  limitations:['Voxel label counts and bounding boxes do not verify all voxel-to-surface correspondence, source segmentation accuracy or topology.',
    'Slicer surface smoothing can move vertices; source STL is not expected to lie exactly on voxel cell boundaries.',
    'Only left/right foot payloads were inspected; the other nine NRRD files retain header-only scope.'],
  files:[`${root}/inventory.json`,`${root}/receipt.json`,'scripts/audit-bonehub-foot-labels.mjs','scripts/lib/nrrd-label-stats.mjs'].map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync(`${root}/foot-labels.json`,JSON.stringify(report,null,2)+'\n');
