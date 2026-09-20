import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {BufferGeometry,BufferAttribute,Int16BufferAttribute,Matrix4} from 'three';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
const read=p=>JSON.parse(fs.readFileSync(p));
const atlas=read('public/models/female/atlas-female.json'),registration=read('data/catalog/female-arm-registration.json');
const records=new Map(registration.records.map(p=>[p.id,p]));
const buffers=atlas.chunks.map(c=>gunzipSync(fs.readFileSync(`public/models/female/${c.gzip.split('/').pop()}`)));
test('normalized packed Int16 normals are read as normalized floats by installed Three.js',()=>{
  const normal=new Int16BufferAttribute(new Int16Array([-32767,16384,0]),3,true);
  assert.equal(normal.getX(0),-1);assert.equal(normal.getY(0),16384/32767);assert.equal(normal.getZ(0),0);
});
function geometry(part){
  const b=buffers[part.chunk],g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>b.readFloatLE(part.positions+i*4)),3));
  g.setAttribute('normal',new Int16BufferAttribute(Int16Array.from({length:part.vertexCount*3},(_,i)=>b.readInt16LE(part.normals+i*2)),3,true));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>b.readUInt32LE(part.indices+i*4)),1));return g;
}
test('partial female arm registration is pinned and affects exactly 60 borrowed bones, not native anatomy',()=>{
  assert.equal(createHash('sha256').update(fs.readFileSync('public/models/female/atlas-female.json')).digest('hex'),registration.sourceManifestSha256);
  assert.equal(records.size,60);assert.equal(registration.partial,true);
  assert.equal(registration.screening.anatomicallyValidated,false);
  let changed=0,untouched=0,vertices=0;
  for(const part of atlas.parts){
    const g=geometry(part),original=g.getAttribute('position'),normals=g.getAttribute('normal');
    const before=original.array.slice(),beforeNormals=normals.array.slice(),indices=g.index.array.slice();
    const applied=applyFemaleArmRegistration(g,'female',part.id,part.system),record=records.get(part.id);
    assert.equal(applied,Boolean(record));
    assert.deepEqual(original.array,before);assert.deepEqual(normals.array,beforeNormals);
    assert.deepEqual(g.index.array,indices);
    if(record){
      changed++;assert.equal(part.system,'borrowed');assert.equal(part.conceptId,`BORROWED:${record.sourceId}`);
      const after=g.getAttribute('position');vertices+=after.count;
      for(let i=0;i<after.count;i++)for(let axis=0;axis<3;axis++){
        const expected=Math.fround(record.translation[axis]+[0,1,2].reduce((n,k)=>n+before[i*3+k]*record.linear[k][axis],0));
        assert.ok(Math.abs(after.array[i*3+axis]-expected)<1e-7,`${part.id}/${i}/${axis}`);
      }
      const normal=g.getAttribute('normal');
      for(let i=0;i<normal.count;i++)assert.ok(Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1)<1e-5);
      const unchanged=after.array.slice();assert.equal(applyFemaleArmRegistration(g,'female',part.id,part.system),false);
      assert.deepEqual(after.array,unchanged,'Never apply calibration twice');
      const m=record.linear;assert.ok(new Matrix4().set(m[0][0],m[1][0],m[2][0],0,m[0][1],m[1][1],m[2][1],0,m[0][2],m[1][2],m[2][2],0,0,0,0,1).determinant()>0);
    }else{untouched++;assert.equal(g.getAttribute('position'),original);assert.equal(g.getAttribute('normal'),normals);}
    g.dispose();
  }
  assert.equal(changed,60);assert.equal(untouched,1160);assert.ok(vertices>=14112);
});
test('registration excludes other source frames and rejects mismatched metadata',()=>{
  const p=atlas.parts.find(p=>records.has(p.id));
  for(const dataset of ['male','male-detail','female-detail']){
    const g=geometry(p),before=g.attributes.position.array.slice();
    assert.equal(applyFemaleArmRegistration(g,dataset,p.id,'borrowed'),false);
    assert.deepEqual(g.attributes.position.array,before);g.dispose();
  }
  const g=geometry(p);assert.throws(()=>applyFemaleArmRegistration(g,'female',p.id,'skeletal'),/출처/);
  g.setIndex([0,1,2]);assert.throws(()=>applyFemaleArmRegistration(g,'female',p.id,'borrowed'),/버전/);g.dispose();
});

test('thumb refinement changes exactly six v1 records by two rigid group transforms',()=>{
  const baseline=read('docs/anatomy-alignment/female-arm-registration-v1.json');
  assert.equal(registration.version,'female-arm-partial-2');
  assert.equal(registration.refinement.movedParts,6);
  const changes=new Map(registration.refinement.hands.flatMap(h=>h.ids.map(id=>[id,h])));
  assert.equal(changes.size,6);
  for(const record of registration.records){
    const old=baseline.records.find(r=>r.id===record.id),hand=changes.get(record.id);
    if(!hand){assert.deepEqual(record,old);continue;}
    const m=hand.linearFromRegistered,t=hand.translationFromRegistered;
    for(let i=0;i<3;i++)for(let j=0;j<3;j++){
      assert.ok(Math.abs(m[i].reduce((s,x,k)=>s+x*m[j][k],0)-(i===j?1:0))<1e-10,'No additional scale or shear');
      assert.ok(Math.abs(record.linear[i][j]-old.linear[i].reduce((s,x,k)=>s+x*m[k][j],0))<1e-10);
    }
    for(let j=0;j<3;j++)assert.ok(Math.abs(record.translation[j]-(old.translation.reduce((s,x,k)=>s+x*m[k][j],0)+t[j]))<1e-10);
  }
});
