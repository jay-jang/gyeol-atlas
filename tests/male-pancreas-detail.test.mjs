import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {initialView,viewReducer,restoreView} from '../src/view-state.ts';

const read=path=>JSON.parse(fs.readFileSync(path));
const hash=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const report=read('docs/anatomy-alignment/male-pancreas-source.json');
const atlas=read('public/models/male-detail/atlas.json');
const catalog=read('data/male-detail-structures.json');
const groups=read('data/male-detail-groups.json');
const whole=groups.find(group=>group.id==='pancreas');
const parenchyma=groups.find(group=>group.id==='pancreas-parenchyma');

test('male pancreas detail contains exactly four official 4.0 part-of meshes in two disjoint views',()=>{
  assert.deepEqual(report.officialMembers,['FJ1895','FJ1896','FJ2629','FJ2630']);
  assert.deepEqual(whole.ids,['BP4_FJ1895','BP4_FJ1896']);
  assert.deepEqual(parenchyma.ids,['BP4_FJ2629','BP4_FJ2630']);
  assert.equal(new Set([...whole.ids,...parenchyma.ids]).size,4);
  assert.deepEqual(report.views.map(view=>[view.id,view.ids]),[[whole.id,whole.ids],[parenchyma.id,parenchyma.ids]]);
  for(const {path,sha256} of report.files){
    if(path.startsWith('.cache/')&&!fs.existsSync(path))continue;
    assert.equal(hash(path),sha256,path);
  }
  for(const [path,expected] of [[report.officialArchive,report.officialArchiveSha256],
                                 [report.officialRelation,report.officialRelationSha256]])
    if(fs.existsSync(path))assert.equal(hash(path),expected,path);
  if(fs.existsSync(report.officialRelation)){
    const members=fs.readFileSync(report.officialRelation,'utf8').split(/\r?\n/)
      .filter(line=>line.startsWith('FMA7198\tpancreas\t')).map(line=>line.split('\t')[2]);
    assert.deepEqual(members,report.officialMembers);
  }
  assert.equal(report.rows.length,4);
  const bytes=gunzipSync(fs.readFileSync('public/models/male-detail/organs.bin.gz'));
  for(const row of report.rows){
    const part=atlas.parts.find(part=>part.id===row.id);
    const item=catalog.find(part=>part.id===row.id);
    assert.ok(part&&item,row.id);
    assert.equal(item.group,row.group);
    assert.equal(item.name,part.name);
    assert.equal(item.fmaId,row.fmaId);
    assert.equal(item.sex,'male');assert.equal(item.detailOnly,true);
    assert.equal(part.vertexCount,row.runtimeVertices);
    assert.equal(part.indexCount/3,row.runtimeTriangles);
    assert.equal(row.exactOfficialSourceVertices,row.runtimeVertices);
    assert.equal(createHash('sha256').update(bytes.subarray(part.positions,part.positions+part.vertexCount*12)).digest('hex'),row.positionSha256);
    assert.deepEqual(part.bounds,row.boundsMetres);
  }
  // Similar AABBs explain why the two whole/parenchyma representations are
  // kept separate; boxes alone are not proof of matching organ surfaces.
  const a=report.rows[0].boundsMetres,b=report.rows[2].boundsMetres;
  assert.ok([0,1].every(end=>[0,1,2].every(axis=>Math.abs(a[end][axis]-b[end][axis])<.0002)));
});

test('pancreas detail selection stays within its view, restores peeling, and rejects mixed-view sessions',()=>{
  const layers={...initialView().layers,skin:false,organ:true};
  const before=viewReducer(initialView('ST36'),{type:'dissection',value:50.5});
  const detail={id:'pancreas',name:whole.name,ids:whole.ids,layers};
  const selected=viewReducer(viewReducer(before,{type:'detail',detail}),{
    type:'select',layer:'organ',selection:{kind:'structure',ids:[whole.ids[1]],name:'Pancreatic duct'}});
  assert.deepEqual(selected.detail.ids,whole.ids);
  assert.deepEqual(viewReducer(selected,{type:'detail-close'}),before);
  assert.deepEqual(restoreView(JSON.stringify(selected),['ST36'],catalog).selection.ids,[whole.ids[1]]);
  const mixed={...selected,detail:{...detail,ids:[whole.ids[0],parenchyma.ids[0]]},
    selection:{kind:'bundle',ids:[whole.ids[0],parenchyma.ids[0]],name:'mixed'},isolated:false};
  assert.deepEqual(restoreView(JSON.stringify(mixed),['ST36'],catalog),initialView());
});
