import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {BufferGeometry,BufferAttribute,Int16BufferAttribute} from 'three';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';
const atlas=JSON.parse(fs.readFileSync('public/models/female/atlas-female.json'));
const registration=JSON.parse(fs.readFileSync('data/catalog/female-foot-registration.json'));
const records=new Map(registration.records.map(r=>[r.id,r]));
const buffers=atlas.chunks.map(c=>gunzipSync(fs.readFileSync(`public/models/female/${c.gzip.split('/').pop()}`)));
function geometry(p){
  const b=buffers[p.chunk],g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),3));
  g.setAttribute('normal',new Int16BufferAttribute(Int16Array.from({length:p.vertexCount*3},(_,i)=>b.readInt16LE(p.normals+2*i)),3,true));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i)),1));return g;
}
test('female partial foot registration changes exactly 20 phalanges, preserving source buffers and every other part',()=>{
  assert.equal(registration.sourceManifestSha256,createHash('sha256').update(fs.readFileSync('public/models/female/atlas-female.json')).digest('hex'));
  assert.equal(records.size,20);assert.equal(registration.partial,true);assert.equal(registration.screening.anatomicallyValidated,false);
  let changed=0;
  for(const p of atlas.parts){
    const g=geometry(p),pos=g.attributes.position,normal=g.attributes.normal;
    const before=pos.array.slice(),normals=normal.array.slice(),index=g.index.array.slice(),record=records.get(p.id);
    assert.equal(applyFemaleFootRegistration(g,'female',p.id,p.system),Boolean(record));
    assert.deepEqual(pos.array,before);assert.deepEqual(normal.array,normals);assert.deepEqual(g.index.array,index);
    if(record){
      changed++;assert.equal(p.system,'borrowed');assert.match(p.name,/phalanx/i);assert.equal(p.conceptId,`BORROWED:${record.sourceId}`);
      const m=record.linear;
      for(let i=0;i<3;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(m[i].reduce((s,x,k)=>s+x*m[j][k],0)-(i===j?1:0))<1e-10);
      for(let i=0;i<pos.count;i++)for(let j=0;j<3;j++){
        const expected=Math.fround(record.translation[j]+[0,1,2].reduce((s,k)=>s+before[i*3+k]*m[k][j],0));
        assert.ok(Math.abs(g.attributes.position.array[i*3+j]-expected)<1e-7);
      }
      const n=g.attributes.normal;for(let i=0;i<n.count;i++){
        const raw=[0,1,2].map(j=>Math.max(-1,normals[i*3+j]/32767));
        const expected=[0,1,2].map(j=>raw.reduce((s,x,k)=>s+x*m[k][j],0)),length=Math.hypot(...expected);
        assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);
        for(let j=0;j<3;j++)assert.ok(Math.abs(n.array[i*3+j]-expected[j]/length)<1e-6);
      }
      const after=g.attributes.position.array.slice();assert.equal(applyFemaleFootRegistration(g,'female',p.id,p.system),false);
      assert.deepEqual(g.attributes.position.array,after);
    }else{assert.equal(g.attributes.position,pos);assert.equal(g.attributes.normal,normal);}
    g.dispose();
  }
  assert.equal(changed,20);
});
test('foot registration cannot leak into other datasets and rejects changed source metadata',()=>{
  const p=atlas.parts.find(p=>records.has(p.id));
  for(const dataset of ['male','male-detail','female-detail']){
    const g=geometry(p),pos=g.attributes.position;assert.equal(applyFemaleFootRegistration(g,dataset,p.id,p.system),false);
    assert.equal(g.attributes.position,pos);g.dispose();
  }
  const g=geometry(p);assert.throws(()=>applyFemaleFootRegistration(g,'female',p.id,'skeletal'),/출처/);
  g.setIndex([0,1,2]);assert.throws(()=>applyFemaleFootRegistration(g,'female',p.id,p.system),/버전/);g.dispose();
});
test('every toe chain shares one rigid transform and is disjoint from the existing arm correction',()=>{
  const arm=JSON.parse(fs.readFileSync('data/catalog/female-arm-registration.json'));
  for(const g of registration.groups){
    const first=records.get(g.ids[0]);assert.ok(g.digit<5);
    for(const id of g.ids){assert.deepEqual(records.get(id).linear,first.linear);assert.deepEqual(records.get(id).translation,first.translation);}
  }
  assert.equal(registration.groups.length,7);assert.ok(arm.records.every(r=>!records.has(r.id)));
});
