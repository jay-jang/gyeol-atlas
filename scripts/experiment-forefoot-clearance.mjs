// Bounded toe-chain translations after rotation, with full bone/skin screens.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3,Matrix4} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {applyBaselinePositions} from './lib/registration-baseline.mjs';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const input='.cache/foot-registration/forefoot-candidate.json',candidate=JSON.parse(fs.readFileSync(input));
for(const f of candidate.files)assert.equal(hash(f.path),f.sha256,f.path);
const atlasPath='public/models/female/atlas-female.json',atlas=JSON.parse(fs.readFileSync(atlasPath));
const regPath='data/catalog/female-arm-registration.json',registration=JSON.parse(fs.readFileSync(regPath));
const records=new Map(candidate.groups.flatMap(g=>g.records).map(r=>[r.id,r])),buffers=new Map();
function geometry(p,after){
  const chunk=atlas.chunks[p.chunk],path=`public/models/female/${chunk.gzip.split('/').pop()}`;
  if(!buffers.has(path)){const zip=fs.readFileSync(path);assert.equal(zip.length,chunk.gzipBytes);const bytes=gunzipSync(zip);
    assert.equal(bytes.length,chunk.bytes);buffers.set(path,bytes);}
  const bytes=buffers.get(path),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>bytes.readFloatLE(p.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>bytes.readUInt32LE(p.indices+4*i)),1));
  applyBaselinePositions(g,p,registration);
  const r=after&&records.get(p.id);if(r){const pos=g.attributes.position;for(let i=0;i<pos.count;i++){
    const q=[pos.getX(i),pos.getY(i),pos.getZ(i)];pos.setXYZ(i,...r.translation.map((v,j)=>v+q.reduce((s,x,k)=>s+x*r.linear[k][j],0)));
  }}g.computeBoundingBox();g.boundsTree=new MeshBVH(g);return g;
}
const skin=geometry(atlas.parts.find(p=>p.id==='HRAF0003'),false),probe=surfaceProbe(skin,.002);
const meshes=atlas.parts.filter(p=>['skeletal','connective','borrowed'].includes(p.system)).map(p=>({part:p,g:geometry(p,true)}));
assert.equal(meshes.length,321);
const shifts=[];
for(let x=-8;x<=8;x++)for(let y=-8;y<=8;y++)for(let z=-8;z<=8;z++){
  const mm=[x*.25,y*.25,z*.25],norm=Math.hypot(...mm);if(norm<=2)shifts.push({mm,norm});
}
shifts.sort((a,b)=>a.norm-b.norm||a.mm[0]-b.mm[0]||a.mm[1]-b.mm[1]||a.mm[2]-b.mm[2]);
for(const group of candidate.groups){
  if(group.chosen.pitch===0&&group.chosen.yaw===0){group.clearance={status:'UNCHANGED: no rotation selected'};continue;}
  const ids=new Set(group.records.map(r=>r.id)),moving=meshes.filter(m=>ids.has(m.part.id)),fixed=meshes.filter(m=>!ids.has(m.part.id));
  const points=moving.flatMap(m=>{
    const original=geometry(m.part,false),pos=original.attributes.position;
    const rows=referencedVertices(original,Infinity).map(index=>{
      const before=probe.classify(new Vector3().fromBufferAttribute(pos,index));assert.notEqual(before.kind,'ambiguous');
      return {before,point:new Vector3().fromBufferAttribute(m.g.attributes.position,index)};
    });original.dispose();return rows;
  });
  let chosen=null,tested=0;
  for(const shift of shifts){
    tested++;const delta=new Vector3(...shift.mm).multiplyScalar(.001),matrix=new Matrix4().makeTranslation(...delta.toArray());
    const collision=moving.some(m=>{
      const box=m.g.boundingBox.clone().translate(delta);
      return fixed.some(f=>box.intersectsBox(f.g.boundingBox)&&f.g.boundsTree.intersectsGeometry(m.g,matrix));
    });if(collision)continue;
    let outside=0,squared=0;const valid=points.every(({before,point})=>{
      const q=point.clone().add(delta);q.set(Math.fround(q.x),Math.fround(q.y),Math.fround(q.z));const c=probe.classify(q);
      if(c.kind==='ambiguous')return false;
      if(c.kind==='outside'){outside++;squared+=((c.distance-.002)*1000)**2;}
      return !(c.kind==='outside'&&before.kind!=='outside')&&
        (c.kind==='outside'?c.distance:0)-(before.kind==='outside'?before.distance:0)<=1e-6;
    });
    // Do not sacrifice the rotation's low protrusion for bone clearance.
    if(valid&&outside<=group.chosen.outside&&squared<=group.chosen.sumSquaredExcessMm+1e-6){chosen={...shift,outside,sumSquaredExcessMm:squared};break;}
  }
  group.clearance={status:chosen?'FOUND':'NONE WITHIN BOUNDS',chosen,tested,stepMm:.25,maximumNormMm:2};
  if(chosen){
    for(const r of group.records)r.translation=r.translation.map((v,i)=>v+chosen.mm[i]*.001);
    for(const m of moving){m.g.dispose();m.g=geometry(m.part,true);}
  }
  console.log(JSON.stringify({side:group.side,digit:group.digit,...group.clearance}));
}
candidate.status='EXPERIMENT ONLY: toe-chain rotation and bounded clearance; inspect failed groups and final audit';
candidate.limitations.push('Clearance bound 2 mm is a numerical search bound, not a biological motion tolerance; groups are updated sequentially.');
candidate.files.push(...[input,atlasPath,regPath,'scripts/experiment-forefoot-clearance.mjs','scripts/lib/registration-baseline.mjs',...buffers.keys()].map(path=>({path,sha256:hash(path)})));
fs.writeFileSync('.cache/foot-registration/forefoot-clearance-candidate.json',JSON.stringify(candidate,null,2)+'\n');
probe.dispose();skin.dispose();meshes.forEach(m=>m.g.dispose());
