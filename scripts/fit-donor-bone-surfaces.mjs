// Read-only candidate fit against actual corresponding bone surfaces.
// Fitting samples are deterministic; independent full vertex distances follow.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3,Matrix4,Quaternion} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {referencedVertices} from './lib/surface-containment.mjs';

const root=process.argv[2];assert.ok(root,'Pass extracted donor STL directory');
const atlas=JSON.parse(fs.readFileSync('public/models/female/atlas-female.json'));
const source=JSON.parse(fs.readFileSync('docs/anatomy-alignment/donor-source-comparison.json'));
const buffers=atlas.chunks.map(c=>gunzipSync(fs.readFileSync(`public/models/female/${c.gzip.split('/').pop()}`)));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const targetSource=JSON.parse(fs.readFileSync('data/catalog/female-atlas-source.json'));
for(const f of targetSource.files)assert.equal(sha(f.path),f.sha256,f.path);
for(const f of source.files)assert.equal(sha(path.join(root,f.file)),f.sha256,f.file);
const point=new Vector3(),loader=new STLLoader();
function geometries(name,side){
  const d=source.files.find(p=>p.kind==='bone'&&p.structure===name&&p.side===side);assert.ok(d);
  const b=fs.readFileSync(path.join(root,d.file)),raw=loader.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
  raw.scale(.001,.001,.001);raw.deleteAttribute('normal');const donor=mergeVertices(raw,1e-8);raw.dispose();
  const p=atlas.parts.find(p=>p.name===`${name} (${side})`);assert.ok(p,`${name}/${side}`);const bytes=buffers[p.chunk],target=new BufferGeometry();
  target.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>bytes.readFloatLE(p.positions+4*i)),3));
  target.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>bytes.readUInt32LE(p.indices+4*i)),1));
  target.boundsTree=new MeshBVH(target);return {name,side,id:p.id,donor,target};
}
// Largest eigenvector of a real symmetric matrix via Jacobi sweeps, not a
// largest-magnitude power iteration (which can choose the wrong quaternion).
function largestEigenvector(matrix){
  const a=matrix.map(r=>[...r]),v=Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>+(i===j)));
  for(let iteration=0;iteration<80;iteration++){
    let p=0,q=1;for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)if(Math.abs(a[i][j])>Math.abs(a[p][q])){p=i;q=j;}
    if(Math.abs(a[p][q])<1e-16)break;
    const angle=.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(angle),s=Math.sin(angle);
    const app=a[p][p],aqq=a[q][q],apq=a[p][q];
    for(let k=0;k<4;k++)if(k!==p&&k!==q){const x=a[k][p],y=a[k][q];a[k][p]=a[p][k]=c*x-s*y;a[k][q]=a[q][k]=s*x+c*y;}
    a[p][p]=c*c*app-2*c*s*apq+s*s*aqq;a[q][q]=s*s*app+2*c*s*apq+c*c*aqq;a[p][q]=a[q][p]=0;
    for(let k=0;k<4;k++){const x=v[k][p],y=v[k][q];v[k][p]=c*x-s*y;v[k][q]=s*x+c*y;}
  }
  const best=[0,1,2,3].sort((i,j)=>a[j][j]-a[i][i])[0];return v.map(row=>row[best]);
}
function fit(from,onto){
  const mean=p=>p.reduce((s,p)=>s.add(p),new Vector3()).multiplyScalar(1/p.length),a=mean(from),b=mean(onto);
  const m=Array.from({length:3},()=>[0,0,0]);let denominator=0;
  for(let n=0;n<from.length;n++){
    const x=from[n].clone().sub(a).toArray(),y=onto[n].clone().sub(b).toArray();
    for(let i=0;i<3;i++){denominator+=x[i]*x[i];for(let j=0;j<3;j++)m[i][j]+=x[i]*y[j];}
  }
  const [[xx,xy,xz],[yx,yy,yz],[zx,zy,zz]]=m;
  const [w,x,y,z]=largestEigenvector([
    [xx+yy+zz,yz-zy,zx-xz,xy-yx],[yz-zy,xx-yy-zz,xy+yx,zx+xz],
    [zx-xz,xy+yx,-xx+yy-zz,yz+zy],[xy-yx,zx+xz,yz+zy,-xx-yy+zz]]);
  const q=new Quaternion(x,y,z,w).normalize();let numerator=0;
  for(let n=0;n<from.length;n++)numerator+=from[n].clone().sub(a).applyQuaternion(q).dot(onto[n].clone().sub(b));
  const scale=numerator/denominator;assert.ok(scale>0);
  return new Matrix4().compose(b.clone().sub(a.clone().applyQuaternion(q).multiplyScalar(scale)),q,new Vector3(scale,scale,scale));
}
// Non-axis-aligned rotation and non-unit scale self-check guards fit convention.
const known=new Matrix4().compose(new Vector3(.1,.2,-.3),new Quaternion().setFromAxisAngle(new Vector3(1,2,3).normalize(),.7),new Vector3(1.07,1.07,1.07));
const synthetic=[[0,0,0],[1,0,0],[0,2,0],[0,0,3],[1,2,3]].map(v=>new Vector3(...v));
const recovered=fit(synthetic,synthetic.map(p=>p.clone().applyMatrix4(known)));
for(let i=0;i<16;i++)assert.ok(Math.abs(known.elements[i]-recovered.elements[i])<1e-10);
function measure(g,target){
  const distances=[];for(const i of referencedVertices(g,Infinity))distances.push(target.boundsTree.closestPointToPoint(point.fromBufferAttribute(g.attributes.position,i)).distance*1000);
  distances.sort((a,b)=>a-b);return {vertices:distances.length,medianMm:distances[Math.floor(distances.length*.5)],p95Mm:distances[Math.floor(distances.length*.95)],maximumMm:distances.at(-1),meanMm:distances.reduce((a,b)=>a+b,0)/distances.length};
}
const report={createdAt:new Date().toISOString(),status:'BONE SURFACE FIT CANDIDATES ONLY; no runtime export',fits:[],
  limitations:['ICP optimizes deterministic samples of same-named bone surfaces, not anatomical landmarks or soft tissues.',
    'Reported surface distances use all indexed vertices in both directions, not triangle interiors or expert alignment.',
    'Closest-point ICP is local and does not prove a global optimum. A lower bone residual cannot authorize muscle placement without a separate audit.']};
for(const side of ['left','right']){
  const all=['Femur','Patella','Tibia','Fibula'].map(name=>geometries(name,side));
  for(const mode of ['shank','whole-leg']){
    const bones=mode==='shank'?all.filter(b=>['Tibia','Fibula'].includes(b.name)):all;
    const initial=source.fits[`${side}-shank`],r=initial.rows,s=initial.scale,t=initial.offset;
    const transform=new Matrix4().set(...r[0].map(v=>v*s),t[0],...r[1].map(v=>v*s),t[1],...r[2].map(v=>v*s),t[2],0,0,0,1);
    const samples=bones.flatMap(b=>referencedVertices(b.donor,2000).map(i=>({p:new Vector3().fromBufferAttribute(b.donor.attributes.position,i),bone:b})));
    const initialTransform=transform.clone(),history=[];let previous=Infinity,converged=false;
    for(let iteration=0;iteration<60;iteration++){
      const from=[],onto=[];let error=0;
      for(const sample of samples){const p=sample.p.clone().applyMatrix4(transform),q=sample.bone.target.boundsTree.closestPointToPoint(p);from.push(p);onto.push(q.point.clone());error+=q.distance*q.distance;}
      const rms=Math.sqrt(error/samples.length);history.push(rms*1000);
      if(Math.abs(previous-rms)<1e-8){converged=true;break;}previous=rms;
      transform.premultiply(fit(from,onto));
      const scale=Math.cbrt(transform.determinant());assert.ok(scale>.8&&scale<1.2,'Reject unstable shrink/expansion');
    }
    const rows=[];
    for(const b of all){
      const before=b.donor.clone().applyMatrix4(initialTransform),after=b.donor.clone().applyMatrix4(transform);
      before.boundsTree=new MeshBVH(before);after.boundsTree=new MeshBVH(after);
      rows.push({id:b.id,name:b.name,inFit:bones.includes(b),before:{forward:measure(before,b.target),reverse:measure(b.target,before)},after:{forward:measure(after,b.target),reverse:measure(b.target,after)}});
      before.dispose();after.dispose();
    }
    const finalSampleRmsMm=Math.sqrt(samples.reduce((n,sample)=>n+sample.bone.target.boundsTree.closestPointToPoint(sample.p.clone().applyMatrix4(transform)).distance**2,0)/samples.length)*1000;
    report.fits.push({side,mode,samples:samples.length,iterations:history.length,converged,convergenceDeltaMetres:1e-8,finalSampleRmsMm,sampleRmsMm:history,sourceToAtlasMatrix:transform.toArray(),bones:rows});
    console.log(JSON.stringify({side,mode,converged,sampleRmsBefore:history[0],finalSampleRmsMm,bones:rows.map(b=>({name:b.name,forward95:b.after.forward.p95Mm,reverse95:b.after.reverse.p95Mm}))}));
  }
  all.forEach(b=>{b.donor.dispose();b.target.dispose();});
}
report.provenance=['scripts/fit-donor-bone-surfaces.mjs','docs/anatomy-alignment/donor-source-comparison.json','data/catalog/female-atlas-source.json','public/models/female/atlas-female.json','package-lock.json'].map(file=>({file,sha256:sha(file)}));
fs.mkdirSync('.cache/calf-registration',{recursive:true});fs.writeFileSync('.cache/calf-registration/bone-surface-fits.json',JSON.stringify(report,null,2)+'\n');
