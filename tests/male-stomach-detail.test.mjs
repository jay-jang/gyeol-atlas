import fs from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialView,viewReducer,restoreView} from '../src/view-state.ts';

const read=path=>JSON.parse(fs.readFileSync(path));
const group=read('data/male-detail-groups.json').find(g=>g.id==='stomach');
const catalog=read('data/male-detail-structures.json');
const report=read('docs/anatomy-alignment/male-stomach-detail-audit.json');

test('official 4.0 stomach and eight separately named vessels retain exact packed source bytes',()=>{
  assert.ok(group);assert.equal(group.sex,'male');
  assert.equal(group.ids.length,9);
  assert.deepEqual(group.ids,report.rows.map(r=>r.id));
  assert.deepEqual(group.sourceConcepts,report.rows.map(r=>r.conceptId));
  assert.deepEqual(report.rows.map(r=>r.system),
    ['digestive','arterial','arterial','venous','venous','arterial','arterial','venous','venous']);
  for(const file of report.files){
    if(file.path.startsWith('.cache/')&&!fs.existsSync(file.path))continue;
    assert.equal(createHash('sha256').update(fs.readFileSync(file.path)).digest('hex'),file.sha256,file.path);
  }
  for(const row of report.rows){
    const structure=catalog.find(s=>s.id===row.id);
    assert.ok(structure);assert.equal(structure.group,'stomach');
    assert.equal(structure.name,row.name);assert.equal(structure.fmaId,row.conceptId);
    assert.equal(structure.layer,row.system==='digestive'?'organ':'vessel');
    assert.match(structure.description,/연결.*검증한 것은 아닙니다/);
    for(const hash of Object.values(row.fieldSha256))assert.match(hash,/^[a-f0-9]{64}$/);
  }
  assert.ok(report.rows.slice(1).every(r=>Number.isFinite(r.stomachVertexSurfaceDistanceMm.minimum)));
  assert.match(report.limitations[0],/not an official/);
});

test('stomach detail enters organ and vessel layers and restores the previous peel and camera',()=>{
  const initial={...initialView(),camera:{position:[0,1,2],target:[0,1,0]}};
  const peel=viewReducer(initial,{type:'dissection',value:50.5});
  const layers={skin:false,muscle:false,bone:false,organ:true,vessel:true,lymph:false,nerve:false};
  const detail={id:group.id,name:group.name,ids:group.ids,layers};
  const opened=viewReducer(peel,{type:'detail',detail});
  assert.equal(opened.detail.id,'stomach');assert.equal(opened.layers.organ,true);
  assert.equal(opened.layers.vessel,true);
  const vessel=catalog.find(s=>s.id==='BP4_FJ3501');
  const selected=viewReducer(opened,{type:'select',layer:'vessel',detail,
    selection:{kind:'structure',ids:[vessel.id],name:vessel.label}});
  assert.deepEqual(selected.selection.ids,[vessel.id]);
  assert.deepEqual(restoreView(JSON.stringify(selected),[],catalog),selected);
  const closed=viewReducer(selected,{type:'detail-close'});
  assert.equal(closed.detail,null);assert.equal(closed.dissection,50.5);
  assert.deepEqual(closed.layers,peel.layers);assert.deepEqual(closed.camera,peel.camera);
});

test('older one-mesh stomach detail remains a valid 3.0 view instead of mixing source frames',()=>{
  const legacy=read('scripts/model-inputs.json').assets.find(s=>s.id==='FMA7148');
  assert.ok(legacy);
  const layers={skin:false,muscle:false,bone:false,organ:true,vessel:false,lymph:false,nerve:false};
  const old=viewReducer(initialView(),{type:'detail',detail:{id:'stomach',name:'위',ids:[legacy.id],layers}});
  const restored=restoreView(JSON.stringify(old),[],[...catalog,legacy]);
  assert.deepEqual(restored.detail.ids,['FMA7148']);
  assert.deepEqual(restored.selection.ids,['FMA7148']);
  assert.equal(restored.layers.vessel,false);
});
