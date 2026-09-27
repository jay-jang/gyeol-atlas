// Independent scalar inverse/plane sections and streamed source-crop readback.
// No tissue classification or anatomical approval is inferred.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,createGunzip} from 'node:zlib';
const out='.cache/bonehub-head-ct';
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f));
const report=read(`${out}/report.json`),frame=read('.cache/bonehub-head/frame.json');
for(const r of [report,frame])for(const f of r.files)assert.equal(hash(f.file),f.sha256,f.file);
const rows=JSON.parse(gunzipSync(fs.readFileSync(frame.parts))),sections=JSON.parse(gunzipSync(fs.readFileSync(report.sectionFile)));
const ct=read('docs/anatomy-alignment/bonehub-female-ct-receipt.json'),inventory=read('docs/anatomy-alignment/bonehub-female-inventory.json'),receipt=read('docs/anatomy-alignment/bonehub-female-receipt.json');
const brainIds=new Set(read('data/female-organ-groups.json').find(p=>p.id==='brain').ids),brain=rows.filter(p=>p.kind==='neural'&&brainIds.has(p.id));assert.equal(brain.length,283);
const {minXYZ:lo,maxExclusiveXYZ:hi,spacingXYZmm:spacing}=report.crop;
function npy(path,descr,bytes){
  const b=fs.readFileSync(path);assert.equal(b.subarray(0,6).toString('latin1'),'\x93NUMPY');assert.ok([1,2].includes(b[6]));
  const start=b[6]===1?10:12,length=b[6]===1?b.readUInt16LE(8):b.readUInt32LE(8),header=b.subarray(start,start+length).toString('ascii');
  assert.equal(header.match(/'descr':\s*'([^']+)'/)[1],descr);assert.match(header,/'fortran_order':\s*False/);
  const shape=header.match(/'shape':\s*\(([^)]+)\)/)[1].split(',').filter(s=>s.trim()).map(Number);assert.deepEqual(shape,[hi[2]-lo[2],hi[1]-lo[1],hi[0]-lo[0]]);
  const data=b.subarray(start+length);assert.equal(data.length,shape.reduce((a,b)=>a*b,1)*bytes);return data;
}
const image=npy(report.crop.image,'<u2',2),mask=npy(report.crop.mask,'|u1',1),nx=ct.nifti.dims[1],ny=ct.nifti.dims[2],nz=ct.nifti.dims[3];
const sourceMask=inventory.masks.find(p=>p.group==='SKULL'),maskFile=receipt.files.find(f=>f.path===sourceMask.file).local;
const headerBuffer=Buffer.alloc(100000),fd=fs.openSync(maskFile,'r');const readBytes=fs.readSync(fd,headerBuffer,0,headerBuffer.length,0);fs.closeSync(fd);
const headerEnd=headerBuffer.subarray(0,readBytes).indexOf(Buffer.from('\n\n'))+2;assert.ok(headerEnd>2);
async function verifyCrop(file,start,offset,bytes,expected){
  const intervals=[];let destination=0;
  for(let z=lo[2];z<hi[2];z++)for(let y=lo[1];y<hi[1];y++){
    const a=offset+((z*ny+y)*nx+lo[0])*bytes,b=a+(hi[0]-lo[0])*bytes;intervals.push({a,b,destination});destination+=b-a;
  }
  const actual=Buffer.alloc(expected.length),histogram=[0,0,0],bounds=[1,2].map(()=>[[nx,ny,nz],[-1,-1,-1]]);
  let consumed=0,interval=0,copied=0;
  const stream=fs.createReadStream(file,{start}).pipe(createGunzip());
  for await(const chunk of stream){
    const end=consumed+chunk.length;
    if(bytes===1)for(let i=0;i<chunk.length;i++){
      const value=chunk[i];assert.ok(value<=2);histogram[value]++;
      if(value){const flat=consumed+i,z=Math.floor(flat/(nx*ny)),y=Math.floor(flat/nx)%ny,x=flat%nx;for(const [k,v] of [x,y,z].entries()){bounds[value-1][0][k]=Math.min(bounds[value-1][0][k],v);bounds[value-1][1][k]=Math.max(bounds[value-1][1][k],v);}}
    }
    while(interval<intervals.length&&intervals[interval].a<end){
      const row=intervals[interval],a=Math.max(row.a,consumed),b=Math.min(row.b,end);
      if(b>a){chunk.copy(actual,row.destination+a-row.a,a-consumed,b-consumed);copied+=b-a;}
      if(row.b<=end)interval++;else break;
    }consumed=end;
  }
  assert.equal(consumed,offset+nx*ny*nz*bytes);assert.equal(copied,expected.length);assert.deepEqual(actual,expected);
  return {sourceDecompressedBytes:consumed,cropBytes:copied,histogram:bytes===1?histogram:null,bounds:bytes===1?bounds:null};
}
const maskReadback=await verifyCrop(maskFile,headerEnd,0,1,mask);assert.deepEqual(maskReadback.histogram,report.fullSkullMask.histogram);assert.deepEqual(maskReadback.bounds,report.fullSkullMask.labels.map(l=>l.boundsXYZ));
console.log(JSON.stringify({maskReadback}));
const imageReadback=await verifyCrop(ct.sourceFile.file,0,352,2,image);console.log(JSON.stringify({imageReadback}));
// Independently established full-mask bounds lie inside this crop, so these
// label-restricted CT histograms cover every foreground voxel, not a sample.
for(const bounds of maskReadback.bounds)for(let k=0;k<3;k++){assert.ok(bounds[0][k]>=lo[k]);assert.ok(bounds[1][k]<hi[k]);}
const intensityHistograms=[new Uint32Array(65536),new Uint32Array(65536)];
for(let i=0;i<mask.length;i++)if(mask[i])intensityHistograms[mask[i]-1][image.readUInt16LE(i*2)]++;
for(let k=0;k<2;k++)assert.deepEqual(Array.from(intensityHistograms[k],(count,value)=>({value,count})).filter(p=>p.count),report.fullSkullMask.labels[k].storedIntensityHistogram);
function invert(p,candidate){
  const m=candidate.matrixColumnMajor,s=candidate.uniformScale,result=[];
  for(let i=0;i<p.length;i+=3)for(let k=0;k<3;k++)result.push(1000*(m[k*4]*(p[i]-m[12])+m[k*4+1]*(p[i+1]-m[13])+m[k*4+2]*(p[i+2]-m[14]))/(s*s));
  return result;
}
function membership(positions,used){
  const counts=[0,0,0];let outside=0;
  for(const i of used){const v=[0,1,2].map(k=>Math.floor(positions[3*i+k]/spacing[k]+.5));if(v.some((v,k)=>v<lo[k]||v>=hi[k])){outside++;continue;}
    const index=((v[2]-lo[2])*(hi[1]-lo[1])+v[1]-lo[1])*(hi[0]-lo[0])+v[0]-lo[0];counts[mask[index]]++;}
  return {counts,outside};
}
let vertexOccurrences=0;const mapped=new Map();
for(const candidate of frame.candidates){
  const recorded=report.membership.find(p=>p.mode===candidate.mode);
  for(const p of brain){const positions=invert(p.positions,candidate),used=[...new Set(p.indices)],r=membership(positions,used),expected=recorded.rows.find(r=>r.id===p.id);
    assert.deepEqual(r.counts,expected.nearestLabelCounts);assert.equal(r.outside,expected.outsideCrop);assert.equal(used.length,expected.points);vertexOccurrences+=used.length;
    if(candidate.mode===sections.mode)mapped.set(p.id,positions);
  }
}
for(const p of rows.filter(p=>p.kind==='source'&&p.id.startsWith('SKULL_'))){const r=membership(p.positions.map(v=>v*1000),Array.from({length:p.positions.length/3},(_,i)=>i)),expected=report.nativeSkullControls.find(r=>r.id===p.id);assert.deepEqual(r.counts,expected.nearestLabelCounts);assert.equal(r.outside,expected.outsideCrop);}
let segments=0,maximumEndpointDifferenceMm=0,pointContacts=0,coplanarTriangles=0;
const epsilon=1e-8;
for(const plane of sections.planes){
  assert.equal(plane.rows.length,brain.length);assert.equal(plane.coordinateLpsMm,plane.index*spacing[plane.axis]);
  for(const p of brain){
    const native=mapped.get(p.id),stored=plane.rows.find(r=>r.id===p.id),segmentMap=new Map(stored.triangleIds.map((id,i)=>[id,stored.segments[i]]));assert.equal(segmentMap.size,stored.triangleIds.length);
    let pointsCount=0,coplanarCount=0,segmentCount=0;
    for(let t=0;t<p.indices.length;t+=3){
      const v=[0,1,2].map(c=>native.slice(3*p.indices[t+c],3*p.indices[t+c]+3)),d=v.map(p=>p[plane.axis]-plane.coordinateLpsMm),on=d.map(x=>Math.abs(x)<=epsilon);
      if(on.every(Boolean)){coplanarCount++;continue;}
      const points=v.filter((_,i)=>on[i]);
      for(let a=0;a<3;a++){const b=(a+1)%3;if(d[a]<-epsilon&&d[b]>epsilon||d[b]<-epsilon&&d[a]>epsilon){const fraction=d[a]/(d[a]-d[b]);points.push(v[a].map((x,k)=>x+fraction*(v[b][k]-x)));}}
      if(points.length===1){pointsCount++;continue;}
      if(!points.length)continue;assert.equal(points.length,2);const saved=segmentMap.get(t/3);assert.ok(saved,`Missing section ${p.id}/${t/3}`);
      const delta=(a,b)=>Math.max(...a.map((v,k)=>Math.abs(v-b[k]))),direct=Math.max(delta(points[0],saved[0]),delta(points[1],saved[1])),reverse=Math.max(delta(points[0],saved[1]),delta(points[1],saved[0]));
      const difference=Math.min(direct,reverse);assert.ok(difference<1e-7);maximumEndpointDifferenceMm=Math.max(maximumEndpointDifferenceMm,difference);segmentCount++;
    }
    assert.equal(segmentCount,segmentMap.size);assert.equal(pointsCount,stored.pointContacts);assert.equal(coplanarCount,stored.coplanarTriangles);
    segments+=segmentCount;pointContacts+=pointsCount;coplanarTriangles+=coplanarCount;
  }
}
const result={status:'Independent streamed crop, inverse-map membership and complete selected-plane section readback; not clinical approval',maskReadback,imageReadback,
  brainMeshes:brain.length,planes:sections.planes.length,vertexOccurrences,segments,pointContacts,coplanarTriangles,maximumEndpointDifferenceMm,maskVoxelIntensitiesVerified:maskReadback.histogram[1]+maskReadback.histogram[2],
  files:[`${out}/report.json`,report.sectionFile,'scripts/verify-bonehub-head-ct.mjs'].map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync(`${out}/readback.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({vertexOccurrences,segments,pointContacts,coplanarTriangles,maximumEndpointDifferenceMm}));
