// Pinned same-subject image acquisition and NIfTI coordinate inventory only.
// Does not segment tissue or export any application model.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createGunzip} from 'node:zlib';
const revision='ac8de2b38f5ae1a0996053ca0639dd6ae43358f1';
const root=`.cache/bonehub/${revision}`,member='visible_human_3d_models/CT/Image/02_Female.nii.gz';
const file=path.join(root,member),expectedSha='638c569c9a702a6c7b3f50e36fe4be8ef7acc2ab0c53d960ad19418d7f00d979',expectedBytes=501395759;
const api=`https://huggingface.co/api/datasets/BoneHub/visible-human-3d-models/tree/${revision}/visible_human_3d_models/CT/Image?recursive=true&limit=1000`;
const response=await fetch(api);assert.ok(response.ok);assert.equal(response.headers.get('link'),null);
const entry=(await response.json()).find(e=>e.path===member);assert.ok(entry);assert.equal(entry.lfs.oid,expectedSha);assert.equal(entry.size,expectedBytes);
fs.mkdirSync(path.dirname(file),{recursive:true});
if(!fs.existsSync(file)){
  const dir=fs.mkdtempSync(path.join(path.dirname(file),'female-download-')),partial=path.join(dir,'image.nii.gz');
  const url=`https://huggingface.co/datasets/BoneHub/visible-human-3d-models/resolve/${revision}/${member}`,r=await fetch(url);assert.ok(r.ok);
  const sha=createHash('sha256');let bytes=0;
  const meter=new Transform({transform(chunk,encoding,done){bytes+=chunk.length;sha.update(chunk);done(null,chunk);}});
  await pipeline(Readable.fromWeb(r.body),meter,fs.createWriteStream(partial,{flags:'wx'}));
  assert.equal(bytes,expectedBytes);assert.equal(sha.digest('hex'),expectedSha);assert.ok(!fs.existsSync(file));fs.renameSync(partial,file);
}
const sha=createHash('sha256');for await(const chunk of fs.createReadStream(file))sha.update(chunk);assert.equal(sha.digest('hex'),expectedSha);assert.equal(fs.statSync(file).size,expectedBytes);
let header=Buffer.alloc(0),uncompressedBytes=0;
for await(const chunk of fs.createReadStream(file).pipe(createGunzip())){
  uncompressedBytes+=chunk.length;if(header.length<352)header=Buffer.concat([header,chunk.subarray(0,352-header.length)]);
}
assert.equal(header.readInt32LE(0),348,'Only little-endian NIfTI-1 is supported');assert.equal(header.subarray(344,348).toString('ascii'),'n+1\0');
const dims=Array.from({length:8},(_,i)=>header.readInt16LE(40+2*i)),pixdim=Array.from({length:8},(_,i)=>header.readFloatLE(76+4*i));
const datatype=header.readInt16LE(70),bitpix=header.readInt16LE(72),voxOffset=header.readFloatLE(108);
assert.equal(dims[0],3);assert.ok(voxOffset>=352&&Number.isInteger(voxOffset));
const voxels=dims.slice(1,4).reduce((n,v)=>n*v,1);assert.equal(uncompressedBytes,voxOffset+voxels*bitpix/8);
const sformCode=header.readInt16LE(254),qformCode=header.readInt16LE(252),sform=Array.from({length:3},(_,r)=>Array.from({length:4},(_,c)=>header.readFloatLE(280+16*r+4*c)));
const report={createdAt:new Date().toISOString(),status:'Same-source female CT acquired and header inspected; no segmentation, clinical validation or runtime export',
  repository:'https://huggingface.co/datasets/BoneHub/visible-human-3d-models',revision,license:'CC-BY-4.0',sourceFile:{file,member,bytes:expectedBytes,sha256:expectedSha,publishedLfsSha256:entry.lfs.oid},
  nifti:{dims,pixdim,datatype,bitpix,voxOffset,voxels,uncompressedBytes,qformCode,sformCode,sformRas:sform,
    quaternion:[256,260,264].map(o=>header.readFloatLE(o)),qoffset:[268,272,276].map(o=>header.readFloatLE(o)),xyztUnits:header[123],sclSlope:header.readFloatLE(112),sclInter:header.readFloatLE(116)},
  gzipCrcChecked:true,limitations:['Header geometry and a valid complete gzip stream do not establish tissue coverage or segmentation accuracy.',
    'Source CT elbow truncation remains. No organ, nerve, muscle or skin surface was produced by this acquisition.'],
  scriptSha256:createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex')};
fs.writeFileSync(`${root}/ct-receipt.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
