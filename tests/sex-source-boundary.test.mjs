import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {structureForSexId} from '../src/sex-structure.ts';
import {verifyPackedSourceManifest} from '../src/packed-source-guard.ts';
import {initialView,viewReducer} from '../src/view-state.ts';

const read=file=>JSON.parse(fs.readFileSync(file));
const manifests=[
  {source:'female',sex:'female',parts:1220,file:'public/models/female/atlas-female.json'},
  {source:'female-detail',sex:'female',parts:11,file:'public/models/female-detail/atlas.json'},
  {source:'male-detail',sex:'male',parts:754,file:'public/models/male-detail/atlas.json'},
];
const structures=[
  ...read('scripts/model-inputs.json').assets.map(part=>({...part,sex:'male'})),
  ...read('data/full-system-structures.json').map(part=>({...part,sex:'male'})),
  ...read('data/sex-lymph-structures.json').filter(part=>part.sex==='male'),
  ...read('data/female-atlas-structures.json'),
  ...read('data/male-detail-structures.json'),
  ...read('data/female-detail-structures.json'),
];
const catalog=new Map(structures.map(part=>[part.id,part]));

test('all shipped packed meshes are catalogued for their own sex and system',()=>{
  assert.equal(catalog.size,structures.length,'catalog IDs must be unique across sexes');
  for(const {source,sex,parts,file} of manifests){
    const manifest=read(file);
    assert.equal(manifest.parts.length,parts,source);
    assert.doesNotThrow(()=>verifyPackedSourceManifest(source,sex,manifest.parts,catalog),source);
  }
  const female=read(manifests[0].file).parts;
  assert.equal(female.filter(part=>part.system==='borrowed').length,180);
  assert.equal(female.filter(part=>part.system==='donor-muscle').length,76);
  assert.equal(female.filter(part=>part.system==='borrowed'&&catalog.get(part.id).layer==='organ').length,0);
  assert.equal(female.filter(part=>catalog.get(part.id).sex==='male').length,0);
});

test('female source rejects a male organ, unknown ID, duplicate, system swap and male detail frame',()=>{
  const female=read(manifests[0].file).parts;
  const maleOrgan={id:'FMA7148',name:'stomach',system:'digestive'};
  assert.equal(structureForSexId(structures,'female',maleOrgan.id),undefined);
  assert.ok(structureForSexId(structures,'male',maleOrgan.id));
  assert.throws(()=>verifyPackedSourceManifest('female','female',[...female,maleOrgan],catalog),/성별·계통 불일치/);
  assert.throws(()=>verifyPackedSourceManifest('female','female',[{id:'unknown',system:'digestive'}],catalog),/성별·계통 불일치/);
  assert.throws(()=>verifyPackedSourceManifest('female','female',[female[0],female[0]],catalog),/ID 중복/);
  assert.throws(()=>verifyPackedSourceManifest('female','female',[{...female[0],system:'digestive'}],catalog),/성별·계통 불일치/);
  assert.throws(()=>verifyPackedSourceManifest('male-detail','female',read(manifests[2].file).parts,catalog),/성별·출처 불일치/);
});

test('sex switch discards selected male anatomy before female source is selected',()=>{
  const male=structureForSexId(structures,'male','FMA7148');
  assert.ok(male);
  const selected=viewReducer(initialView(),{type:'select',layer:male.layer,selection:{kind:'structure',ids:[male.id],name:male.name}});
  const female=viewReducer(selected,{type:'sex',value:'female'});
  assert.equal(female.sex,'female');
  assert.equal(female.selection,null);
  assert.equal(female.detail,null);
  assert.equal(female.comparison,null);
  assert.equal(female.dissection,0);
});
