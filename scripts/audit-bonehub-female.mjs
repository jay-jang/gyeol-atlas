// Real binary STL inventory matched to source NRRD header labels. No registration.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='.cache/bonehub/ac8de2b38f5ae1a0996053ca0639dd6ae43358f1';
const sha=b=>createHash('sha256').update(b).digest('hex'),receipt=JSON.parse(fs.readFileSync(`${root}/receipt.json`));
const bytes=f=>{const b=fs.readFileSync(f.local);assert.equal(sha(b),f.sha256,f.local);return b;};
const labels=[],masks=[];
for(const f of receipt.files.filter(f=>f.path.endsWith('.seg.nrrd'))){
  const b=bytes(f),end=b.indexOf(Buffer.from('\n\n'));assert.ok(end>0&&end<1000000);
  const header=b.subarray(0,end).toString('utf8');assert.match(header,/^NRRD0004/);
  const fields=Object.fromEntries(header.split('\n').filter(l=>l.includes(':')&&!l.startsWith('#')).map(l=>{const i=l.indexOf(':');return [l.slice(0,i),l.slice(i+1).replace(/^=/,'').trim()];}));
  assert.equal(fields.space,'left-posterior-superior');assert.equal(fields.encoding,'gzip');assert.equal(fields.type,'unsigned char');
  const sizes=fields.sizes.split(' ').map(Number),group=path.basename(f.path,'.seg.nrrd');
  const members=Object.entries(fields).filter(([k])=>/^Segment\d+_Name$/.test(k)).map(([k,name])=>{
    const prefix=k.slice(0,k.lastIndexOf('_')),layer=Number(fields[`${prefix}_Layer`]),labelValue=Number(fields[`${prefix}_LabelValue`]);
    const row={group,name,id:fields[`${prefix}_ID`],layer,labelValue,extent:fields[`${prefix}_Extent`].split(' ').map(Number),
      status:/Segmentation.Status:([^|]+)/.exec(fields[`${prefix}_Tags`]||'')?.[1]??null};
    assert.ok(Number.isInteger(layer)&&layer>=0&&layer<(sizes.length===4?sizes[0]:1));assert.ok(Number.isInteger(labelValue)&&labelValue>0&&labelValue<=255);
    return row;
  });
  assert.equal(new Set(members.map(m=>`${m.layer}/${m.labelValue}`)).size,members.length);
  labels.push(...members);masks.push({file:f.path,sha256:f.sha256,group,space:fields.space,directions:fields['space directions'],origin:fields['space origin'],sizes,labels:members.length,
    uncompressedBytes:sizes.reduce((n,v)=>n*v,1),headerOnly:true,voxelPayloadInspected:false});
}
assert.equal(masks.length,11);assert.equal(labels.length,143);assert.equal(new Set(labels.map(l=>l.name)).size,143);
const parts=[];let totalTriangles=0,totalZeroNormals=0;
for(const f of receipt.files.filter(f=>f.path.endsWith('.stl'))){
  const b=bytes(f),count=b.readUInt32LE(80),header=b.subarray(0,80).toString('ascii').replace(/\0+$/,'');
  assert.equal(b.length,84+50*count);assert.ok(count>0);assert.match(header,/SPACE=LPS/);
  const group=path.basename(path.dirname(f.path)),name=path.basename(f.path,'.stl'),label=labels.find(l=>l.group===group&&l.name===name);assert.ok(label,`${group}/${name}`);
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let zeroNormals=0;
  for(let t=0;t<count;t++){
    const offset=84+50*t,n=[0,1,2].map(k=>b.readFloatLE(offset+4*k));assert.ok(n.every(Number.isFinite));if(n.every(x=>x===0))zeroNormals++;
    for(let c=0;c<3;c++)for(let k=0;k<3;k++){const v=b.readFloatLE(offset+12+12*c+4*k);assert.ok(Number.isFinite(v));min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);}
  }
  parts.push({file:f.path,sha256:f.sha256,name,group,triangles:count,triangleVertexOccurrences:3*count,boundsSourceLps:[min,max],header,zeroNormals,label});
  totalTriangles+=count;totalZeroNormals+=zeroNormals;
}
assert.equal(parts.length,143);
const bounds=[0,1].map(end=>[0,1,2].map(k=>end?Math.max(...parts.map(p=>p.boundsSourceLps[1][k])):Math.min(...parts.map(p=>p.boundsSourceLps[0][k]))));
const statusCounts=Object.fromEntries([...new Set(labels.map(l=>l.status))].map(status=>[status,labels.filter(l=>l.status===status).length]));
const report={createdAt:new Date().toISOString(),status:'SOURCE MESH MEMBERSHIP AND COORDINATE INVENTORY; not HRA placement or clinical validation',
  repository:receipt.repository,revision:receipt.revision,license:receipt.license,doi:receipt.doi,subject:receipt.subject,
  summary:{meshes:parts.length,masks:masks.length,totalTriangles,triangleVertexOccurrences:totalTriangles*3,totalZeroNormals,boundsSourceLps:bounds,statusTags:statusCounts},parts,masks,
  limitations:['All binary STL vertex occurrences and finite normals were read; topology, surface crossings and voxel-to-mesh correspondence were not validated here.',
    'NRRD headers and hashes are checked, not their compressed voxel payload. Extent fields are shared layer extents, not confirmed per-bone bounds.',
    'Header inprogress/completed tags are recorded verbatim; neither proves or disproves the authors stated human review.',
    'Source labels are not independent anatomical bones: digits and other structures include compounds, and known elbow/hyoid/sesamoid/cartilage gaps remain.',
    'LPS coordinates are source coordinates, not the atlas Y-up display frame; no placement is applied.'],
  files:[`${root}/receipt.json`,'scripts/audit-bonehub-female.mjs'].map(file=>({file,sha256:sha(fs.readFileSync(file))}))};
fs.writeFileSync(`${root}/inventory.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary,null,2));
