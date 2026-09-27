// Match the acquired image grid to all segmentation headers and inventory
// unsigned stored intensities. No HU assumption or automatic tissue label.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGunzip} from 'node:zlib';
const root='.cache/bonehub/ac8de2b38f5ae1a0996053ca0639dd6ae43358f1';
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const ct=JSON.parse(fs.readFileSync(`${root}/ct-receipt.json`)),inventory=JSON.parse(fs.readFileSync(`${root}/inventory.json`));
assert.equal(hash(ct.sourceFile.file),ct.sourceFile.sha256);assert.equal(ct.nifti.datatype,512);assert.equal(ct.nifti.bitpix,16);assert.equal(ct.nifti.xyztUnits&7,2);
assert.ok(ct.nifti.sformCode>0);assert.equal(ct.nifti.sclSlope,1);assert.equal(ct.nifti.sclInter,0);
// Sign reversal may yield -0; it is the same coordinate, not a grid mismatch.
const lps=ct.nifti.sformRas.map((r,k)=>r.map(v=>v===0?0:v*(k===2?1:-1)));
const masks=inventory.masks.map(mask=>{
  const sizes=mask.sizes.slice(-3),directions=[...mask.directions.matchAll(/\(([^)]+)\)/g)].map(m=>m[1].split(',').map(Number)),origin=mask.origin.replace(/[()]/g,'').split(',').map(Number);
  assert.deepEqual(sizes,ct.nifti.dims.slice(1,4));assert.equal(directions.length,3);
  for(let r=0;r<3;r++){assert.equal(origin[r],lps[r][3]);for(let c=0;c<3;c++)assert.equal(directions[c][r],lps[r][c]);}
  return {group:mask.group,maskSha256:mask.sha256,sizes,voxelCentresMatch:true,payloadScope:'header geometry only; foot payload verification recorded separately'};
});
const counts=new Float64Array(65536),slices=[],nx=ct.nifti.dims[1],ny=ct.nifti.dims[2],plane=nx*ny;
let offset=0,voxels=0,pending=null;
function push(value){
  counts[value]++;const z=Math.floor(voxels/plane);voxels++;
  if(!slices[z])slices[z]={z,voxels:0,minimum:Infinity,maximum:-Infinity,zero:0};
  const s=slices[z];s.voxels++;s.minimum=Math.min(s.minimum,value);s.maximum=Math.max(s.maximum,value);s.zero+=value===0;
}
for await(const chunk of fs.createReadStream(ct.sourceFile.file).pipe(createGunzip())){
  let i=Math.max(0,ct.nifti.voxOffset-offset);offset+=chunk.length;if(i>=chunk.length)continue;
  if(pending!==null){push(pending+256*chunk[i++]);pending=null;}
  for(;i+1<chunk.length;i+=2)push(chunk.readUInt16LE(i));
  if(i<chunk.length)pending=chunk[i];
}
assert.equal(pending,null);assert.equal(voxels,ct.nifti.voxels);assert.equal(slices.length,ct.nifti.dims[3]);assert.ok(slices.every(s=>s.voxels===plane));
const histogram=Array.from(counts,(count,value)=>({value,count})).filter(r=>r.count);
const report={createdAt:new Date().toISOString(),status:'Image/mask voxel-centre grids matched; stored intensity inventory only, not tissue or HU validation',
  masks,voxels,slices,histogram,range:[histogram[0].value,histogram.at(-1).value],zeroVoxels:counts[0],
  limitations:['Unsigned source intensities with slope 1/intercept 0 are recorded as stored values, not assumed Hounsfield units.',
    'Same grid does not prove segmentation accuracy, anatomical continuity or complete body coverage.',
    'No skin, organ or muscle surface has been generated or applied. Known source elbow truncation remains.'],
  files:[`${root}/ct-receipt.json`,`${root}/inventory.json`,'scripts/audit-bonehub-ct-grid.mjs'].map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync(`${root}/ct-grid.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({masks:masks.length,voxels,range:report.range,zeroVoxels:counts[0],distinctIntensities:histogram.length}));
