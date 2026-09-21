// Experimental rigid toe-chain placement; never writes runtime registration.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3,Matrix4} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const priorPath='docs/anatomy-alignment/foot-scale-audit.json',prior=JSON.parse(fs.readFileSync(priorPath));
for(const f of prior.files)assert.equal(hash(f.path),f.sha256,f.path);
const atlasPath='public/models/female/atlas-female.json',atlas=JSON.parse(fs.readFileSync(atlasPath)),buffers=new Map();
function geometry(part){
  assert.ok(part);const chunk=atlas.chunks[part.chunk],path=`public/models/female/${chunk.gzip.split('/').pop()}`;
  if(!buffers.has(path)){const zipped=fs.readFileSync(path);assert.equal(zipped.length,chunk.gzipBytes);
    const bytes=gunzipSync(zipped);assert.equal(bytes.length,chunk.bytes);buffers.set(path,bytes);}
  const bytes=buffers.get(path),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>bytes.readFloatLE(part.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>bytes.readUInt32LE(part.indices+4*i)),1));
  return g;
}
const name=n=>{const p=atlas.parts.find(p=>p.name.toLowerCase()===n);assert.ok(p,n);return p;};
function patch(a,b){
  const clone=b.clone(),tree=new MeshBVH(clone);
  const rows=referencedVertices(a,Infinity).map(index=>{
    const p=new Vector3().fromBufferAttribute(a.attributes.position,index),h=tree.closestPointToPoint(p);
    return {index,distance:h.distance,midpoint:p.add(h.point).multiplyScalar(.5)};
  });
  const minimum=Math.min(...rows.map(r=>r.distance)),selected=rows.filter(r=>r.distance<=minimum+.001);
  assert.ok(selected.length>=3,'Insufficient pivot patch');
  const centre=selected.reduce((v,r)=>v.add(r.midpoint),new Vector3()).multiplyScalar(1/selected.length);
  clone.dispose();return {minimumMm:minimum*1000,vertices:selected.map(r=>r.index),centre:centre.toArray()};
}
const skin=geometry(name('skin')),probe=surfaceProbe(skin,.002);
const report={status:'EXPERIMENT ONLY: skin-constrained rigid toe chains; joint fit not approved',groups:[],
  limits:{angleDegrees:20,coarseStepDegrees:4,refinementStepDegrees:.5,refinementRadiusDegrees:4},
  sourceContext:'https://pubmed.ncbi.nlm.nih.gov/2613125/',
  limitations:['Search bounds are numerical limits, not a physiological joint range or clinical recommendation.',
    'Pivot averages bidirectional nearest-surface patches; it is not an identified anatomical rotation axis.',
    'The five chains are fit independently. Joint surfaces and all inter-chain collisions require a separate audit.',
    'First through fourth metatarsals and all tarsal bones remain fixed; fifth metatarsal moves with its toe.',
    'Skin objective uses all indexed vertices and is not an independent anatomical reference or a complete tissue fit.']};
for(const side of ['left','right'])for(let digit=1;digit<=5;digit++){
  const ordinal=['first','second','third','fourth','fifth'][digit-1],toe=['big','second','third','fourth','little'][digit-1];
  const metatarsal=name(`${side} ${ordinal} metatarsal bone`),proximal=name(`proximal phalanx of ${side} ${toe} toe`);
  const phalanges=['proximal',...(digit===1?[]:['middle']),'distal'].map(stage=>name(`${stage} phalanx of ${side} ${toe} toe`));
  const moving=(digit===5?[metatarsal,...phalanges]:phalanges).map(part=>({part,g:geometry(part)}));
  const fixedPart=digit===5?name(`${side} cuboid bone`):metatarsal,fixed=geometry(fixedPart);
  const root=moving[0],patches=[patch(root.g,fixed),patch(fixed,root.g)];
  const pivot=new Vector3(...patches[0].centre).add(new Vector3(...patches[1].centre)).multiplyScalar(.5);
  const distal=moving.at(-1).g,tip=new Vector3();
  const tipIndices=referencedVertices(distal,Infinity);for(const i of tipIndices)tip.add(new Vector3().fromBufferAttribute(distal.attributes.position,i));
  tip.multiplyScalar(1/tipIndices.length);
  const forward=tip.clone().sub(pivot);forward.y=0;assert.ok(forward.length()>.02);forward.normalize();
  const pitchAxis=new Vector3(0,1,0).cross(forward).normalize();
  const points=moving.flatMap(r=>referencedVertices(r.g,Infinity).map(index=>{
    const point=new Vector3().fromBufferAttribute(r.g.attributes.position,index),before=probe.classify(point);
    assert.notEqual(before.kind,'ambiguous');return {point,before};
  }));
  const rotation=(pitch,yaw)=>new Matrix4().makeRotationY(yaw*Math.PI/180)
    .multiply(new Matrix4().makeRotationAxis(pitchAxis,pitch*Math.PI/180));
  const trials=[],cache=new Map();
  function evaluate(pitch,yaw){
    const key=`${pitch}/${yaw}`;if(cache.has(key))return cache.get(key);
    const matrix=rotation(pitch,yaw),row={pitch,yaw,outside:0,newOutside:0,worsenedOutside:0,maxOutsideMm:0,sumSquaredExcessMm:0,ambiguous:0};
    for(const {point,before} of points){
      const q=point.clone().sub(pivot).applyMatrix4(matrix).add(pivot);
      // Audit the same Float32 position precision used by the renderer.
      q.set(Math.fround(q.x),Math.fround(q.y),Math.fround(q.z));
      const c=probe.classify(q);row.ambiguous+=c.kind==='ambiguous';
      row.outside+=c.kind==='outside';row.newOutside+=c.kind==='outside'&&before.kind!=='outside';
      row.worsenedOutside+=(c.kind==='outside'?c.distance:0)-(before.kind==='outside'?before.distance:0)>1e-6;
      if(c.kind==='outside'){
        row.maxOutsideMm=Math.max(row.maxOutsideMm,c.distance*1000);
        row.sumSquaredExcessMm+=((c.distance-.002)*1000)**2;
      }
    }
    row.cost=row.sumSquaredExcessMm+.001*(pitch*pitch+yaw*yaw);
    row.eligible=row.newOutside===0&&row.worsenedOutside===0&&row.ambiguous===0;
    cache.set(key,row);trials.push(row);return row;
  }
  let best=evaluate(0,0);assert.ok(best.eligible);
  const before={...best},consider=(pitch,yaw)=>{const r=evaluate(pitch,yaw);if(r.eligible&&r.cost<best.cost-1e-10)best=r;};
  for(let p=-20;p<=20;p+=4)for(let y=-20;y<=20;y+=4)consider(p,y);
  const coarse={...best};
  for(let p=Math.max(-20,coarse.pitch-4);p<=Math.min(20,coarse.pitch+4);p+=.5)
    for(let y=Math.max(-20,coarse.yaw-4);y<=Math.min(20,coarse.yaw+4);y+=.5)consider(p,y);
  const matrix=rotation(best.pitch,best.yaw),e=matrix.elements;
  const translation=pivot.clone().sub(pivot.clone().applyMatrix4(matrix));
  const linear=[[e[0],e[1],e[2]],[e[4],e[5],e[6]],[e[8],e[9],e[10]]];
  assert.ok(Math.abs(matrix.determinant()-1)<1e-12);
  const group={side,digit,jointIds:[root.part.id,fixedPart.id],pivot:pivot.toArray(),pitchAxis:pitchAxis.toArray(),patches,
    before,chosen:best,trials,records:moving.map(({part})=>({id:part.id,name:part.name,vertexCount:part.vertexCount,indexCount:part.indexCount,
      linear,translation:translation.toArray()}))};
  report.groups.push(group);console.log(JSON.stringify({...group,trials:trials.length,records:group.records.map(r=>r.id),patches:undefined}));
  moving.forEach(r=>r.g.dispose());fixed.dispose();
}
assert.equal(new Set(report.groups.flatMap(g=>g.records.map(r=>r.id))).size,30);
report.files=[priorPath,atlasPath,'scripts/experiment-forefoot-rotation.mjs','scripts/lib/surface-containment.mjs',...buffers.keys()].map(path=>({path,sha256:hash(path)}));
fs.writeFileSync('.cache/foot-registration/forefoot-candidate.json',JSON.stringify(report,null,2)+'\n');
probe.dispose();skin.dispose();
