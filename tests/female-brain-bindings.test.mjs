import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {femaleBrainBindings as spec,resolveFemaleBrainGeometryPart as resolve,verifyFemaleBrainManifest} from '../src/female-brain-bindings.ts';
import {initialView,restoreView,viewReducer} from '../src/view-state.ts';
const text=fs.readFileSync('public/models/female/atlas-female.json','utf8'),atlas=JSON.parse(text),parts=new Map(atlas.parts.map(p=>[p.id,p]));
const auditBytes=fs.readFileSync('docs/anatomy-alignment/brain-pair-geometry.json'),audit=JSON.parse(auditBytes);
const shift=JSON.parse(fs.readFileSync('docs/anatomy-alignment/hra-brain-source.json')).translationFromSkin;
test('all 282 Allen bindings are an involutive full-buffer permutation; 938 other parts stay identical',()=>{
  const chunks=atlas.chunks.map(c=>gunzipSync(fs.readFileSync(`public/models/female/${c.gzip.split('/').pop()}`)));
  const hash=part=>{
    const b=chunks[part.chunk],h=createHash('sha256');
    for(const [offset,bytes] of [[part.positions,part.vertexCount*12],[part.normals,part.vertexCount*6],[part.indices,part.indexCount*4]])h.update(b.subarray(offset,offset+bytes));
    return h.digest('hex');
  };
  const original=[],bound=[];let changed=0;
  assert.equal(createHash('sha256').update(auditBytes).digest('hex'),spec.auditSha256);
  assert.equal(audit.completeTriangleCorrespondencePairs,141);
  for(const part of atlas.parts){
    const actual=resolve(part,'female',parts),record=spec.records.find(r=>r.id===part.id);
    if(record){
      assert.equal(actual.id,record.partnerId);assert.equal(resolve(actual,'female',parts),part);
      assert.equal(actual.name,record.partnerName);assert.notEqual(actual.id,part.id);changed++;
      const center=[0,0,0],b=chunks[actual.chunk];
      for(let i=0;i<actual.vertexCount;i++)for(let axis=0;axis<3;axis++)center[axis]+=b.readFloatLE(actual.positions+i*12+axis*4)/actual.vertexCount;
      const signed=center.reduce((sum,v,axis)=>sum+(v-shift[axis]-audit.symmetryPlane.point[axis])*audit.symmetryPlane.normal[axis],0);
      assert.ok(part.name.endsWith('(left)')?signed>0:signed<0,`${part.id}: packed geometry hemisphere mismatch`);
    }else assert.equal(actual,part);
    original.push(hash(part));bound.push(hash(actual));
    for(const dataset of ['male','male-detail','female-detail'])assert.equal(resolve(part,dataset,parts),part);
  }
  assert.equal(changed,282);assert.equal(atlas.parts.length-changed,938);
  assert.deepEqual(bound.sort(),original.sort());
  assert.equal(resolve(parts.get('HRAF0070'),'female',parts),parts.get('HRAF0070'));
});
test('binding rejects a changed atlas, missing partners and unreviewed brain sources',async()=>{
  await verifyFemaleBrainManifest('female',text);
  await assert.rejects(verifyFemaleBrainManifest('female',text+' '));
  await verifyFemaleBrainManifest('female-detail','not the HRA manifest');
  const p=parts.get(spec.records[0].id);
  assert.throws(()=>resolve(p,'female',new Map()));
  assert.throws(()=>resolve({...p,name:'changed'},'female',parts));
  assert.throws(()=>resolve({...p,id:'unknown'},'female',parts));
});
test('updated neural audit preserves the same physical crossing pairs after canonical ID rebinding',()=>{
  const previous=JSON.parse(fs.readFileSync('docs/anatomy-alignment/female-neural-source.json'));
  const current=JSON.parse(fs.readFileSync('docs/anatomy-alignment/female-neural-bound.json'));
  const readback=JSON.parse(fs.readFileSync('docs/anatomy-alignment/female-neural-bound-readback.json'));
  assert.equal(current.summary.evaluatedPairs,116202);
  assert.equal(current.summary.all.witnessPairs.runtime,82);
  assert.equal(readback.nativeMeshes,503);assert.equal(readback.allNativeSourcePositionHashesMatch,true);
  assert.equal(readback.auditSha256,createHash('sha256').update(fs.readFileSync('docs/anatomy-alignment/female-neural-bound.json')).digest('hex'));
  const source=new Map(current.records.map(r=>[r.id,r.sourceGeometryId]));
  const actual=current.pairs.filter(p=>p.runtime).map(p=>`${source.get(p.neuralId)}/${p.boneId}`).sort();
  const original=previous.pairs.filter(p=>p.runtime).map(p=>`${p.neuralId}/${p.boneId}`).sort();
  assert.deepEqual(actual,original);
});
test('only legacy asymmetric brain selections refit once; complete bundles and preferences are preserved',()=>{
  const catalog=atlas.parts.map(p=>({id:p.id,layer:'nerve',sex:'female'}));
  const current={...initialView(),sex:'female',layers:{...initialView().layers,skin:false,nerve:true},
    markers:'hidden',camera:{position:[0,1.5,1],target:[0,1.5,0]},
    selection:{kind:'structure',ids:['HRAF0134'],name:'Superior frontal gyrus (left)'}};
  const legacy={...current};delete legacy.brainBindingVersion;
  const migrated=restoreView(JSON.stringify(legacy),[],catalog);
  assert.equal(migrated.camera,null);assert.equal(migrated.brainBindingVersion,spec.version);
  assert.deepEqual(migrated.selection,current.selection);assert.equal(migrated.markers,'hidden');
  assert.deepEqual(migrated.filters,current.filters);
  const refitted=viewReducer(migrated,{type:'camera',value:current.camera});
  assert.deepEqual(restoreView(JSON.stringify(refitted),[],catalog).camera,current.camera);
  assert.deepEqual(restoreView(JSON.stringify(current),[],catalog).camera,current.camera);
  for(const ids of [['HRAF0134','HRAF0267'],['HRAF0070'],[]]){
    const state={...legacy,selection:ids.length?{kind:'bundle',ids,name:'test'}:null};
    assert.deepEqual(restoreView(JSON.stringify(state),[],catalog).camera,current.camera);
  }
});
