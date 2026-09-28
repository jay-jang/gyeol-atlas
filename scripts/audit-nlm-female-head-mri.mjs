import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// Official NLM source images are kept out of the public app. This receipt
// establishes the native head MRI frame before any segmentation or HRA fit.
const root='https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Female-Images';
const cache='.cache/nlm-vhf-head-mri';
const output='docs/anatomy-alignment/nlm-female-head-mri.json';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const fetchBytes=async url=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,200,`${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};
const cached=async(name,url)=>{
  const file=path.join(cache,name);
  try {return await fs.readFile(file);} catch(error) {if(error.code!=='ENOENT')throw error;}
  const bytes=await fetchBytes(url);
  await fs.mkdir(cache,{recursive:true});
  await fs.writeFile(file,bytes,{flag:'wx'});
  return bytes;
};
const field=(text,label)=>{
  const line=text.split(/\r?\n/).find(line=>line.startsWith(label));
  assert.ok(line,`Missing GE header field: ${label}`);
  return line.split(':').slice(1).join(':').replace(/\0/g,'').trim();
};
const numberField=(text,label)=>{
  const value=Number(field(text,label).split(/\s+/)[0]);
  assert.ok(Number.isFinite(value),`Nonfinite ${label}`);
  return value;
};
const pngInfo=bytes=>{
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','PNG signature');
  assert.equal(bytes.subarray(12,16).toString(),'IHDR','PNG IHDR');
  return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),bitDepth:bytes[24],colorType:bytes[25]};
};

const indexUrl=`${root}/PNG_format/radiological/mri/index.html`;
const headerIndexUrl=`${root}/radiological/mriHeaders/index.html`;
const [indexBytes,headerIndexBytes]=await Promise.all([fetchBytes(indexUrl),fetchBytes(headerIndexUrl)]);
const index=indexBytes.toString('utf8');
const headerIndex=headerIndexBytes.toString('utf8');
const listedSizes=html=>new Map([...html.matchAll(/href='([^']+)'[^>]*>[^<]+<\/a><\/td><td class='size'>(\d+)/g)]
  .map(([,name,bytes])=>[name,Number(bytes)]));
const imageSizes=listedSizes(index);
const headerSizes=listedSizes(headerIndex);
const names=[...new Set([...index.matchAll(/href='(mvf1\d{3}1\.png)'/g)].map(match=>match[1]))].sort();
assert.equal(names.length,33,'The official 33-image BRAIN T1 scan group changed');
const imageNumbers=names.map(name=>Number(name.slice(3,7)));
assert.deepEqual(imageNumbers,Array.from({length:33},(_,i)=>1014+i*5),'Head series slice sequence');

const rows=[];
for(const name of names){
  const scan=imageNumbers[rows.length];
  const headerName=`m_vf${scan}.t1.txt`;
  const [image,header]=await Promise.all([
    cached(name,`${root}/PNG_format/radiological/mri/${name}`),
    cached(headerName,`${root}/radiological/mriHeaders/${headerName}`),
  ]);
  assert.equal(image.length,imageSizes.get(name),`Official image listing size: ${name}`);
  assert.equal(header.length,headerSizes.get(headerName),`Official header listing size: ${headerName}`);
  const text=header.toString('latin1');
  const info=pngInfo(image);
  assert.equal(info.width,256);assert.equal(info.height,256);
  assert.match(field(text,'Scan Protocol Name'),/^BRAIN\b/);
  assert.equal(numberField(text,'Number of slices in this scan group'),33);
  assert.equal(numberField(text,'Slice Thickness (mm)'),4);
  assert.equal(numberField(text,'Spacing Between scans(mm)'),1);
  assert.equal(numberField(text,'Image pixel size - X'),.859375);
  assert.equal(numberField(text,'Image pixel size - Y'),.859375);
  assert.equal(numberField(text,'Normal R coord'),0);
  assert.equal(numberField(text,'Normal A coord'),0);
  assert.equal(numberField(text,'Normal S coord'),1);
  const rasLetterRaw=field(text,'RAS letter of Image Location');
  assert.match(rasLetterRaw,/^[IS]/);
  rows.push({scan,image:{file:name,sha256:sha256(image),bytes:image.length,...info},
    header:{file:headerName,sha256:sha256(header),bytes:header.length},
    imageNumber:numberField(text,'Image Number'),
    rasLetter:rasLetterRaw[0],rasLetterRaw,
    imageLocationMm:numberField(text,'Image location'),
    centerRasMm:[numberField(text,'Center R coord of plane image'),numberField(text,'Center A coord of plane image'),numberField(text,'Center S coord of Plane image')],
    topRightRasMm:[numberField(text,'R Coord of Top Right Hand Corner'),numberField(text,'A Coord of Top Right Hand Corner'),numberField(text,'S Coord of Top Right Hand Corner')],
    bottomRightRasMm:[numberField(text,'R Coord of Bottom Right Hand Corner'),numberField(text,'A Coord of Bottom Right Hand Corner'),numberField(text,'S Coord of Bottom Right Hand Corner')]});
}
// The GE text already stores a signed S coordinate. The I/S letter labels
// the direction; negating I again would invent a discontinuity at S=0.
const superiorMm=rows.map(row=>{
  assert.ok(row.rasLetter==='S'||row.rasLetter==='I');
  assert.equal(row.imageLocationMm,row.centerRasMm[2]);
  assert.ok(row.rasLetter==='S'?row.imageLocationMm>=0:row.imageLocationMm<=0);
  return row.imageLocationMm;
});
for(let i=1;i<rows.length;i++) assert.ok(Math.abs(superiorMm[i]-superiorMm[i-1]+5)<1e-5,`Slice spacing ${i}`);
assert.equal(superiorMm[0],69.3);
assert.equal(superiorMm.at(-1),-90.7);
assert.deepEqual(rows.map(row=>row.imageNumber),Array.from({length:33},(_,i)=>33-i));
const labelAnomalies=rows.filter(row=>row.rasLetterRaw!==row.rasLetter).map(row=>({scan:row.scan,raw:row.rasLetterRaw}));
assert.deepEqual(labelAnomalies,[{scan:1174,raw:'Iö'}]);
const report={source:indexUrl,terms:'https://www.nlm.nih.gov/databases/download/terms_and_conditions.html',
  listingSha256:{images:sha256(indexBytes),headers:sha256(headerIndexBytes)},
  sourceDescription:'Official NLM Visible Human Female BRAIN T1 PNGs and corresponding GE text headers; no segmentation or CT/HRA registration.',
  files:rows.length*2,totalFileBytes:rows.reduce((sum,row)=>sum+row.image.bytes+row.header.bytes,0),labelAnomalies,
  nativeGeometry:{pixels:[256,256],pixelSpacingMm:[.859375,.859375],sliceThicknessMm:4,sliceCenterStepMm:5,
    superiorCentersMm:[superiorMm[0],superiorMm.at(-1)],normalRas:[0,0,1]},rows};
await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({slices:rows.length,totalFileBytes:report.totalFileBytes,first:superiorMm[0],last:superiorMm.at(-1)}));
