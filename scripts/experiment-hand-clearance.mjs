// Bounded hand-translation experiment. Whole-hand shape is preserved; proxy
// closure may change. No anatomical contact claim and no public-file writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {jointSurfaceRelation} from './lib/joint-geometry.mjs';
const basePath='.cache/arm-registration/free-upper-candidates.json';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const base=JSON.parse(fs.readFileSync(basePath));
for(const f of base.files)assert.equal(sha(f.path),f.sha256,f.path);
const atlas=JSON.parse(fs.readFileSync('public/models/female/atlas-female.json')),buffers=new Map();
function geometry(row){
  const p=atlas.parts.find(p=>p.id===row.id),path=`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').pop()}`;
  if(!buffers.has(path))buffers.set(path,gunzipSync(fs.readFileSync(path)));
  const bytes=buffers.get(path),g=new BufferGeometry();
  const points=Float32Array.from({length:p.vertexCount*3},(_,i)=>bytes.readFloatLE(p.positions+4*i));
  if(row.transformed)for(let i=0;i<points.length;i+=3){
    const q=Array.from(points.slice(i,i+3));
    for(let j=0;j<3;j++)points[i+j]=row.translation[j]+q.reduce((n,v,k)=>n+v*row.linear[k][j],0);
  }
  g.setAttribute('position',new BufferAttribute(points,3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>bytes.readUInt32LE(p.indices+4*i)),1));
  g.boundsTree=new MeshBVH(g);g.computeBoundingBox();return g;
}
const report=structuredClone(base);
report.status='EXPERIMENT ONLY: bounded whole-hand clearance translation; not anatomical joint fitting';
report.mode='hand-clearance';report.handTranslationSearch={stepMm:.5,maximumNormMm:4,objective:'minimum translation norm with no forearm/hand triangle intersections'};
report.limitations.push('Whole-hand translation changes wrist proxy closure. No cartilage/contact surface target is fitted. Search is a bounded geometric diagnostic only.');
const shifts=[];
for(let x=-8;x<=8;x++)for(let y=-8;y<=8;y++)for(let z=-8;z<=8;z++){
  const mm=[x*.5,y*.5,z*.5],norm=Math.hypot(...mm);if(norm<=4)shifts.push({mm,norm});
}
shifts.sort((a,b)=>a.norm-b.norm||a.mm[0]-b.mm[0]||a.mm[1]-b.mm[1]||a.mm[2]-b.mm[2]);
for(const arm of report.arms){
  const forearm=arm.parts.filter(p=>p.group==='forearm').map(p=>({row:p,g:geometry(p)}));
  const hand=arm.parts.filter(p=>p.group==='hand').map(p=>({row:p,g:geometry(p)}));
  assert.equal(forearm.length,2);assert.equal(hand.length,27);
  let tested=0,chosen=null;
  for(const shift of shifts){
    tested++;
    const delta=new Vector3(...shift.mm).multiplyScalar(.001),matrix=new Matrix4().makeTranslation(delta.x,delta.y,delta.z);
    const collision=forearm.some(a=>hand.some(b=>a.g.boundingBox.intersectsBox(b.g.boundingBox.clone().translate(delta))&&a.g.boundsTree.intersectsGeometry(b.g,matrix)));
    if(!collision){chosen=shift;break;}
  }
  assert.ok(chosen,`${arm.side}: no clearance solution inside 4 mm sphere; do not expand silently`);
  const measurements=[];
  for(const h of hand)h.g.translate(...chosen.mm.map(v=>v*.001));
  for(const a of forearm)for(const name of ['scaphoid','lunate','triquetral']){
    const b=hand.find(p=>p.row.name.toLowerCase()===`${arm.side} ${name}`);
    if(b)measurements.push({pair:[a.row.name,b.row.name],...jointSurfaceRelation(a.g,b.g)});
  }
  for(const p of arm.parts)if(p.group==='hand')p.translation=p.translation.map((v,i)=>v+chosen.mm[i]*.001);
  arm.handClearance={translationMm:chosen.mm,wristProxySeparationMm:chosen.norm,tested,measurements,
    scope:'All 2 forearm x 27 hand pairs, triangle surfaces only; other body bones and skin are separate screens.'};
  console.log(JSON.stringify({side:arm.side,...arm.handClearance}));
  for(const p of [...forearm,...hand])p.g.dispose();
}
report.files.push(...[basePath,'scripts/experiment-hand-clearance.mjs','scripts/lib/joint-geometry.mjs'].map(path=>({path,sha256:sha(path)})));
fs.writeFileSync('.cache/arm-registration/hand-clearance-candidates.json',JSON.stringify(report,null,2)+'\n');
