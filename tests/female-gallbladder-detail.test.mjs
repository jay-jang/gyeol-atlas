import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {sourceOrganRegion,anatomyRegionMatches} from '../src/anatomy-region.ts';
import {femaleBiliaryGroups,femaleBiliaryDisplay} from '../src/female-biliary-navigation.ts';
import {initialView,viewReducer} from '../src/view-state.ts';

const read=path=>JSON.parse(fs.readFileSync(path));
const manifest=read('public/models/female/atlas-female.json');
const catalog=read('data/female-atlas-structures.json');
const group=femaleBiliaryGroups.find(item=>item.id==='gallbladder'&&item.sex==='female');
const ids=['HRAF0527','HRAF0505','HRAF0687','HRAF0688'];
const concepts=['HRA:gallbladder','HRA:ducts_of_gallbladder','HRA:blood_vasculature_of_gallbladder'];

test('female gallbladder detail uses four real source-defined packed meshes without new geometry',()=>{
  assert.ok(group);
  assert.deepEqual(group.sourceConcepts,concepts);
  assert.deepEqual(group.ids,ids);
  assert.deepEqual(concepts.flatMap(id=>manifest.concepts.find(concept=>concept.id===id)?.elements||[]),ids);
  const expected=[
    ['Gallbladder','담낭','organ','digestive'],
    ['Cystic duct','담낭관','organ','digestive'],
    ['Cystic artery','담낭동맥','vessel','arterial'],
    ['Cystic vein','담낭정맥','vessel','venous'],
  ];
  const buffers=new Map();
  for(const [index,id] of ids.entries()){
    const part=manifest.parts.find(item=>item.id===id),source=catalog.find(item=>item.id===id);
    assert.ok(part&&source,id);
    const item=femaleBiliaryDisplay(source);
    assert.equal(item.name,source.name);
    assert.equal(source.group,undefined);
    assert.deepEqual([item.name,item.label,item.layer,part.system],expected[index]);
    assert.equal(item.sex,'female');assert.equal(item.group,group.id);
    assert.ok(item.hierarchy.includes(group.name));
    assert.equal(sourceOrganRegion(item),'abdomen');
    assert.equal(anatomyRegionMatches(part.bounds,'abdomen',item),true);
    assert.equal(anatomyRegionMatches(part.bounds,'chest',item),false);
    assert.ok(part.vertexCount>0&&part.indexCount>0&&part.indexCount%3===0);
    if(!buffers.has(part.chunk))buffers.set(part.chunk,gunzipSync(fs.readFileSync(`public/models/female/${manifest.chunks[part.chunk].gzip.split('/').pop()}`)));
    const bytes=buffers.get(part.chunk),used=new Set();
    for(let i=0;i<part.indexCount;i++){
      const vertex=bytes.readUInt32LE(part.indices+4*i);
      assert.ok(vertex<part.vertexCount,`${id}/index/${i}`);
      used.add(vertex);
    }
    assert.ok(used.size>100,id);
    for(const vertex of used)for(let axis=0;axis<3;axis++){
      const value=bytes.readFloatLE(part.positions+4*(vertex*3+axis));
      assert.ok(Number.isFinite(value),`${id}/position`);
      assert.ok(value>=part.bounds[0][axis]-1e-5&&value<=part.bounds[1][axis]+1e-5,`${id}/bounds/${axis}`);
    }
  }
});

test('biliary display leaves unrelated and male source structures unchanged',()=>{
  const unrelated=catalog.find(item=>item.id==='HRAF0503');
  assert.ok(unrelated);
  assert.equal(femaleBiliaryDisplay(unrelated),unrelated);
  const male={...catalog.find(item=>item.id==='HRAF0527'),sex:'male'};
  assert.equal(femaleBiliaryDisplay(male),male);
});

test('gallbladder organ/vessel detail and a child selection restore the preceding female peel',()=>{
  const layers={...initialView().layers,skin:false,organ:true,vessel:true};
  const camera={position:[.25,1.3,1.8],target:[0,1.1,0]};
  const original=viewReducer({...initialView(),sex:'female',camera,markers:'hidden'},
    {type:'dissection',value:50.5});
  const detail={id:group.id,name:group.name,ids:group.ids,layers};
  const opened=viewReducer(original,{type:'detail',detail});
  assert.equal(opened.detail.id,'gallbladder');
  assert.deepEqual(opened.selection.ids,ids);
  assert.equal(opened.layers.organ,true);assert.equal(opened.layers.vessel,true);
  const child=viewReducer(opened,{type:'select',layer:'vessel',selection:{kind:'structure',ids:['HRAF0687'],name:'담낭동맥'}});
  assert.equal(child.detail.id,'gallbladder');
  assert.equal(child.isolated,true);
  const restored=viewReducer(child,{type:'detail-close'});
  for(const key of ['sex','camera','markers','dissection','displayMode','stage','layers'])assert.deepEqual(restored[key],original[key],key);
  assert.equal(restored.selection,null);assert.equal(restored.detail,null);
});
