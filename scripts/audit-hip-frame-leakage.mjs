// Locate the recorded worst tibial own-frame error and expose its weights.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {lowerBodyPoseContext} from './lib/lower-body-pose-context.mjs';
import {surfaceFrameField} from './lib/surface-frame-field.mjs';
const ctx=lowerBodyPoseContext(process.argv[2]),{read,sha,finish}=ctx,out='.cache/hip-rotation-muscles',bytes=read(`${out}/report.json`),r=JSON.parse(bytes),root=new Matrix4().fromArray(r.root),lumbar=JSON.parse(read('docs/anatomy-alignment/lumbar-source-frames.json')),packed=JSON.parse(gunzipSync(read(lumbar.partsFile)));
const bones=new Map(ctx.bones.map(b=>[`${b.side}-${b.name}`,finish(b.raw.clone().applyMatrix4(root))]));
for(const p of lumbar.parts){const d=packed.find(q=>q.id===p.name),g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(d.positions),3));g.setIndex(new BufferAttribute(new Uint32Array(d.indices),1));bones.set(p.name,finish(g.applyMatrix4(new Matrix4().fromArray(lumbar.denverMatrices.final)).applyMatrix4(root)));}
const frames=r.frames.map(f=>{const g=finish(mergeGeometries(f.members.map(n=>bones.get(n))));return {...f,matrix:new Matrix4().fromArray(f.matrix),nearest:p=>g.boundsTree.closestPointToPoint(p)};}),rows=[];
for(const c of r.candidates)for(const side of ['left','right']){
  const name=`${side}-Tibia`,g=bones.get(name),field=surfaceFrameField(frames,c.widthMetres,'gaussian'),own=frames.find(f=>f.name===side).matrix;let worst=null;
  for(let i=0;i<g.attributes.position.count;i++){
    const p=new Vector3().fromBufferAttribute(g.attributes.position,i),q=field(p),mapped=q.point.clone().fromArray(q.point.toArray().map(Math.fround)),intended=p.clone().applyMatrix4(own),distanceMm=1000*mapped.distanceTo(intended);
    if(!worst||distanceMm>worst.distanceMm)worst={vertex:i,point:p.toArray(),mapped:mapped.toArray(),intended:intended.toArray(),distanceMm,weights:q.weights,distancesMm:q.distancesMetres.map(d=>1000*d),frameMappedPoints:frames.map(f=>p.clone().applyMatrix4(f.matrix).toArray())};
  }
  assert.ok(Math.abs(worst.distanceMm-c.bones.find(b=>b.name===name).ownFrameDifference.maximumMm)<1e-8);
  const ownIndex=frames.findIndex(f=>f.name===side),otherIndex=frames.findIndex(f=>f.name!=='root'&&f.name!==side);assert.ok(worst.distancesMm[ownIndex]<1e-8);assert.ok(worst.weights[otherIndex]>.1);
  const reconstructed=[0,1,2].map(k=>Math.fround(worst.frameMappedPoints.reduce((n,p,i)=>n+p[k]*worst.weights[i],0)));assert.deepEqual(reconstructed,worst.mapped);
  const row={mode:c.mode,side,name,examinedVertices:g.attributes.position.count,frameOrder:frames.map(f=>f.name),...worst};rows.push(row);console.log(JSON.stringify(row));
}
for(const file of ['scripts/audit-hip-frame-leakage.mjs','scripts/lib/surface-frame-field.mjs'])read(file);
fs.writeFileSync(`${out}/leakage.json`,JSON.stringify({createdAt:new Date().toISOString(),reportSha256:sha(bytes),rows,limits:'Worst-point diagnostic of Gaussian cross-frame influence, not an anatomical or clinical displacement measurement. Own-frame target is the prior numerical cartilage-pivot rotation, itself not validated anatomy. These four maxima do not prove the source of every candidate mismatch.',files:[...ctx.files].map(([file,sha256])=>({file,sha256}))},null,2)+'\n');
