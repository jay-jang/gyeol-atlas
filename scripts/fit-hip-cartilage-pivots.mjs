import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {lowerBodyPoseContext} from './lib/lower-body-pose-context.mjs';
import {exactPositionComponents} from './lib/exact-position-components.mjs';
import {areaSurfaceSamples} from './lib/area-surface-samples.mjs';
import {fitSphere} from './lib/sphere-fit.mjs';
const root=process.argv[2],ctx=lowerBodyPoseContext(root),{read,sha,finish}=ctx,out='.cache/hip-cartilage-pivots';fs.mkdirSync(out,{recursive:true});const loader=new STLLoader(),parts=[];
for(const side of ['left','right'])for(const name of ['FemurHead','PelvisAcetabulum']){
  const f=ctx.source.files.find(f=>f.side===side&&f.kind==='cartilage'&&f.structure===name);assert.ok(f);const bytes=read(path.join(root,f.file));assert.equal(sha(bytes),f.sha256);const parsed=loader.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),{geometry:g,components}=exactPositionComponents(parsed);parsed.dispose();g.scale(.001,.001,.001);finish(g);const sampling=areaSurfaceSamples(g,2048),fit=fitSphere(sampling.samples.map(s=>s.point)),all=[];
  for(let i=0;i<g.attributes.position.count;i++)all.push(Math.abs(new Vector3().fromBufferAttribute(g.attributes.position,i).distanceTo(new Vector3(...fit.centre))-fit.radius)*1000);all.sort((a,b)=>a-b);const row={side,name,file:f.file,sha256:f.sha256,vertices:g.attributes.position.count,indexReferences:g.index.count,components:components.map(c=>({triangles:c.triangles,vertices:c.vertices})),sampling,fit,fullVertexResidual:{count:all.length,rmsMm:Math.sqrt(all.reduce((s,v)=>s+v*v,0)/all.length),p95Mm:all[Math.floor(all.length*.95)],maximumMm:all.at(-1)}};parts.push(row);console.log(JSON.stringify({side,name,centre:fit.centre,radiusMm:fit.radius*1000,residual:row.fullVertexResidual}));g.dispose();
}
const report={createdAt:new Date().toISOString(),status:'SOURCE CARTILAGE SPHERE ESTIMATES; NOT VERIFIED ANATOMICAL JOINT CENTRES',parts,sideDifferences:['left','right'].map(side=>{const [a,b]=parts.filter(p=>p.side===side);return {side,centreDifferenceMm:1000*Math.hypot(...a.fit.centre.map((v,k)=>v-b.fit.centre[k]))};}),limitations:['Source-labelled femoral-head and acetabular cartilage are real downloaded models, but sphere centres are numerical estimates, not supplied landmarks.','Both inner/outer and rim surfaces contribute. Fitting a sphere does not identify a biological rotation axis or ensure source/HRA joint correspondence.','These source surfaces are not added to the runtime atlas.']};for(const file of ['scripts/fit-hip-cartilage-pivots.mjs','scripts/lib/sphere-fit.mjs','scripts/lib/area-surface-samples.mjs','scripts/lib/exact-position-components.mjs'])read(file);report.files=[...ctx.files].map(([file,sha256])=>({file,sha256}));fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.sideDifferences));
