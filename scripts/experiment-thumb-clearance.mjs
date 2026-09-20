// Bounded whole-thumb translation after rotation, screened against every other
// bone-layer part. Preserves the three-bone internal pose; not cartilage fitting.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {applyBaselinePositions} from './lib/registration-baseline.mjs';
const path='.cache/arm-registration/thumb-candidate.json',candidate=JSON.parse(fs.readFileSync(path));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const f of candidate.files)assert.equal(sha(f.path),f.sha256,f.path);
const atlasPath='public/models/female/atlas-female.json',atlas=JSON.parse(fs.readFileSync(atlasPath)),buffers=new Map();
const baselinePath='docs/anatomy-alignment/female-arm-registration-v1.json',baseline=JSON.parse(fs.readFileSync(baselinePath));
function geometry(p,record){
  const file=`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').pop()}`;
  if(!buffers.has(file))buffers.set(file,gunzipSync(fs.readFileSync(file)));
  const b=buffers.get(file),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i)),1));
  if(record){const pos=g.attributes.position;for(let i=0;i<pos.count;i++){
    const q=[pos.getX(i),pos.getY(i),pos.getZ(i)];pos.setXYZ(i,...record.translation.map((v,j)=>v+q.reduce((s,x,k)=>s+x*record.linear[k][j],0)));
  }}else applyBaselinePositions(g,p,baseline);
  g.computeBoundingBox();g.boundsTree=new MeshBVH(g);return g;
}
const base=atlas.parts.filter(p=>['skeletal','connective','borrowed'].includes(p.system)).map(p=>({id:p.id,g:geometry(p)}));
assert.equal(base.length,321);
const shifts=[];
for(let x=-12;x<=12;x++)for(let y=-12;y<=12;y++)for(let z=-12;z<=12;z++){
  const mm=[x*.25,y*.25,z*.25],norm=Math.hypot(...mm);if(norm<=3)shifts.push({mm,norm});
}
shifts.sort((a,b)=>a.norm-b.norm||a.mm[0]-b.mm[0]||a.mm[1]-b.mm[1]||a.mm[2]-b.mm[2]);
for(const hand of candidate.hands){
  const moving=hand.records.map(r=>({id:r.id,g:geometry(atlas.parts.find(p=>p.id===r.id),r)}));
  const fixed=base.filter(p=>!moving.some(m=>m.id===p.id));
  let chosen=null,tested=0;
  for(const shift of shifts){
    tested++;
    const delta=new Vector3(...shift.mm).multiplyScalar(.001),matrix=new Matrix4().makeTranslation(...delta.toArray());
    const collision=moving.some(m=>{
      const box=m.g.boundingBox.clone().translate(delta);
      return fixed.some(f=>box.intersectsBox(f.g.boundingBox)&&f.g.boundsTree.intersectsGeometry(m.g,matrix));
    });
    if(!collision){chosen=shift;break;}
  }
  assert.ok(chosen,`${hand.side}: no solution within declared 3 mm search`);
  hand.clearance={translationMm:chosen.mm,normMm:chosen.norm,tested,stepMm:.25,maximumNormMm:3,
    scope:'All 3 moved thumb parts versus the other 318 bone-layer parts; internal thumb intersections are unchanged.'};
  for(const record of hand.records)record.translation=record.translation.map((v,i)=>v+chosen.mm[i]*.001);
  hand.translationFromRegistered=hand.translationFromRegistered.map((v,i)=>v+chosen.mm[i]*.001);
  hand.transformedTrack=hand.transformedTrack.map(p=>p.map((v,i)=>v+chosen.mm[i]*.001));
  // Earlier skin-distance scores describe the unshifted rotation fit only.
  hand.rotationOnlyFit={beforeMedianMm:hand.beforeMedianMm,afterMedianMm:hand.afterMedianMm,afterMaxMm:hand.afterMaxMm};
  delete hand.beforeMedianMm;delete hand.afterMedianMm;delete hand.afterMaxMm;
  console.log(JSON.stringify({side:hand.side,...hand.clearance}));moving.forEach(p=>p.g.dispose());
}
candidate.status='EXPERIMENT ONLY: rotated thumb plus bounded whole-group clearance translation';
candidate.limitations.push('Clearance translation changes proximal pivot closure; no biological translation range or cartilage target is asserted.');
candidate.files.push(...[path,'scripts/experiment-thumb-clearance.mjs',atlasPath,baselinePath,'scripts/lib/registration-baseline.mjs',...buffers.keys()].map(path=>({path,sha256:sha(path)})));
fs.writeFileSync('.cache/arm-registration/thumb-clearance-candidate.json',JSON.stringify(candidate,null,2)+'\n');
base.forEach(p=>p.g.dispose());
