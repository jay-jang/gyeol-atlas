import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {femalePelvicBindings as spec,pelvicStructureDisplay,resolveFemalePelvicGeometryPart as resolve,verifyFemalePelvicManifestVersion} from '../src/female-pelvic-bindings.ts';
import {initialView,restoreView,viewReducer} from '../src/view-state.ts';

const text=fs.readFileSync('public/models/female/atlas-female.json','utf8');
const atlas=JSON.parse(text),parts=new Map(atlas.parts.map(part=>[part.id,part]));
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));

test('the official female source names stay searchable while the one reversed pelvic pair uses opposite complete geometry',()=>{
  assert.equal(createHash('sha256').update(text).digest('hex'),spec.atlasSha256);
  assert.equal(spec.records.length,2);
  assert.equal(read('docs/anatomy-alignment/female-pelvic-laterality-audit.json').source.sha256,spec.sourceGlbSha256);
  verifyFemalePelvicManifestVersion('female');
  const original=new Map(),mapped=new Map();
  for(const record of spec.records){
    const part=parts.get(record.id),partner=parts.get(record.partnerId);
    assert.equal(part.name,record.name);assert.equal(part.system,'reproductive');
    assert.equal(partner.name,record.partnerName);assert.equal(partner.system,'reproductive');
    assert.equal(part.conceptId,`HRA:${part.name.toLowerCase().replaceAll(' ','_')}`);
    assert.equal(resolve(part,'female',parts),partner);
    assert.equal(resolve(part,'male',parts),part);
    assert.equal(resolve(part,'female-detail',parts),part);
    const b=gunzipSync(fs.readFileSync(`public/models/female/${atlas.chunks[part.chunk].gzip.split('/').pop()}`));
    const blocks=[[part.positions,part.vertexCount*12],[part.normals,part.vertexCount*6],[part.indices,part.indexCount*4]];
    original.set(part.id,createHash('sha256').update(Buffer.concat(blocks.map(([offset,length])=>b.subarray(offset,offset+length)))).digest('hex'));
  }
  for(const record of spec.records)mapped.set(record.id,original.get(record.partnerId));
  assert.deepEqual([...mapped.values()].sort(),[...original.values()].sort());
  assert.notEqual(original.get(spec.records[0].id),original.get(spec.records[1].id));
  const wrong=new Map(parts);wrong.set('HRAF0418',{...parts.get('HRAF0418'),name:'Changed source'});
  assert.throws(()=>resolve(parts.get('HRAF0417'),'female',wrong),/원본 불일치/);
});

test('exact paired native non-brain names expose one source laterality exception, not a blanket reflection',()=>{
  const report=read('docs/anatomy-alignment/female-pelvic-laterality-audit.json');
  assert.equal(report.census.pairs,185);
  assert.deepEqual(report.census.reversed.map(record=>[record.leftId,record.rightId]),[['HRAF0418','HRAF0417']]);
  const x=id=>{const p=parts.get(id);return(p.bounds[0][0]+p.bounds[1][0])/2};
  for(const id of ['HRAF0432','HRAF0422'])assert.ok(x(id)>0);
  for(const id of ['HRAF0433','HRAF0421'])assert.ok(x(id)<0);
  assert.ok(parts.get('HRAF0417').bounds[0][0]>0);
  assert.ok(parts.get('HRAF0418').bounds[1][0]<0);
  const catalog=read('data/female-atlas-structures.json');
  for(const record of spec.records){
    const sourceItem=catalog.find(part=>part.id===record.id),shown=pelvicStructureDisplay(sourceItem);
    assert.equal(sourceItem.name,record.name);assert.equal(sourceItem.label,record.name);
    assert.equal(shown.name,record.name);assert.equal(shown.label,record.label);
    assert.ok(shown.description.includes(record.partnerId));
  }
});

test('only legacy one-sided pelvic close-ups refit after source binding; whole pairs and preferences remain',()=>{
  const catalog=atlas.parts.map(part=>({id:part.id,layer:'organ',sex:'female'}));
  const pose={position:[0,.82,.6],target:[0,.82,0]};
  const current={...initialView(),sex:'female',layers:{...initialView().layers,skin:false,organ:true},
    markers:'hidden',camera:pose,selection:{kind:'structure',ids:['HRAF0417'],name:'Right round ligament of uterus'}};
  const legacy={...current};delete legacy.pelvicBindingVersion;
  const migrated=restoreView(JSON.stringify(legacy),[],catalog);
  assert.equal(migrated.camera,null);assert.equal(migrated.pelvicBindingVersion,spec.version);
  assert.deepEqual(migrated.selection,current.selection);assert.equal(migrated.markers,'hidden');
  assert.deepEqual(migrated.filters,current.filters);
  const refitted=viewReducer(migrated,{type:'camera',value:pose});
  assert.deepEqual(restoreView(JSON.stringify(refitted),[],catalog).camera,pose);
  assert.deepEqual(restoreView(JSON.stringify(current),[],catalog).camera,pose);
  for(const ids of [['HRAF0417','HRAF0418'],['HRAF0435'],[]]){
    const state={...legacy,selection:ids.length?{kind:'bundle',ids,name:'test'}:null};
    assert.deepEqual(restoreView(JSON.stringify(state),[],catalog).camera,pose);
  }
});
