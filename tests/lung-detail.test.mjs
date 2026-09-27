import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialView,restoreView} from '../src/view-state.ts';
const read=p=>JSON.parse(fs.readFileSync(p));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const source=read('data/catalog/male-lung-source.json');
const groups=read('data/male-detail-groups.json');
const catalog=read('data/male-detail-structures.json');
const current=groups.find(g=>g.id==='lung'), branches=groups.find(g=>g.id==='lung-branches');

test('all 563 official lung source members occur once, in disjoint source-cohort scopes',()=>{
  const table=fs.readFileSync('data/catalog/v43-FMA2Obj.txt','utf8');
  assert.equal(hash('data/catalog/v43-FMA2Obj.txt'),source.membershipSha256);
  const official=new Set(table.split('\n').filter(l=>/^FMA(?:7309|7310)\tpart_of\t/.test(l)).flatMap(l=>l.split('\t')[2].split('+')));
  assert.deepEqual(new Set(source.parts.map(p=>p.id)),official);
  assert.equal(official.size,563);
  assert.equal(new Set([...current.ids,...branches.ids]).size,563);
  assert.equal(current.ids.length,285);assert.equal(branches.ids.length,278);
  assert.equal(source.parts.filter(p=>p.header['English name'].startsWith('Parenchyma of ')).length,18);
  for(const p of source.parts){
    const row=catalog.find(s=>s.id===p.runtimeId);
    assert.equal(row.fmaId,p.header['Concept ID']);assert.equal(row.name,p.header['English name']);
    assert.equal(row.sex,'male');assert.equal(row.detailOnly,true);
    assert.equal(row.group,p.listing.artg_name.startsWith('140325')?'lung':'lung-branches');
  }
  for(const id of source.excludedObsoleteIds)assert.equal(catalog.some(p=>p.id==='BP4_'+id),false);
  assert.equal(hash(source.generator.file),source.generator.sha256);
});

test('every shipped lung buffer matches its source-derived position receipt and independent readback',()=>{
  const atlas=read('public/models/male-detail/atlas.json');
  const bytes=gunzipSync(fs.readFileSync('public/models/male-detail/organs.bin.gz'));
  for(const row of source.parts){
    const p=atlas.parts.find(p=>p.id===row.runtimeId);
    assert.equal(p.vertexCount,row.vertices);assert.equal(p.indexCount,row.triangles*3);
    assert.equal(createHash('sha256').update(bytes.subarray(p.positions,p.positions+p.vertexCount*12)).digest('hex'),row.positionSha256);
  }
  const check=read('docs/anatomy-alignment/lung-packing-verification.json');
  assert.deepEqual(check.summary,{lungParts:563,vertices:233880,triangles:358592,maximumCoordinateResidualMetres:0});
  assert.equal(check.unchangedHeartLiverParts,143);
  for(const file of check.files)assert.equal(hash(file.file),file.sha256);
});

test('exact old lung sessions migrate to the retained branch view without moving the camera or resetting preferences',()=>{
  const oldIds=[...branches.ids,'BP4_FJ2041','BP4_FJ2044'];
  const layers={...initialView().layers,skin:false,organ:true,vessel:true};
  const base={...initialView(),displayMode:'layers',layers,markers:'hidden',camera:{position:[0,1,2],target:[0,1,0]},
    detail:{id:'lung',name:'폐',ids:oldIds,layers}};
  for(const selection of [{kind:'bundle',ids:oldIds,name:'폐'}, {kind:'structure',ids:['BP4_FJ2041'],name:'retired'},
                          {kind:'structure',ids:[branches.ids[0]],name:'retained'}]){
    const restored=restoreView(JSON.stringify({...base,selection,isolated:true}),[],catalog);
    assert.equal(restored.detail.id,'lung-branches');assert.deepEqual(restored.detail.ids,branches.ids);
    assert.deepEqual(restored.camera,base.camera);assert.equal(restored.markers,base.markers);assert.deepEqual(restored.alpha,base.alpha);
    assert.deepEqual(restored.selection.ids,selection.name==='retained'?selection.ids:branches.ids);
  }
  const mixed={...base,detail:{id:'lung',name:'mixed',ids:[current.ids[0],branches.ids[0]],layers},selection:null};
  assert.deepEqual(restoreView(JSON.stringify(mixed),[],catalog),initialView());
});
