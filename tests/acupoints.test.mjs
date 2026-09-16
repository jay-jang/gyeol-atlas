import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initialView, viewReducer, restoreView } from '../src/view-state.ts';
const read = p => JSON.parse(fs.readFileSync(p));
const points = read('data/points.json'), theory = read('data/acupoint-theory.json');
test('WHO/KMCRIC 361 plus 48 code ranges are complete, unique and source-linked', () => {
  const ranges = {LU:11,LI:20,ST:45,SP:21,HT:9,SI:19,BL:67,KI:27,PC:9,TE:23,GB:44,LR:14,GV:28,CV:24,'EX-HN':15,'EX-CA':1,'EX-B':9,'EX-UE':11,'EX-LE':12};
  const expected = Object.entries(ranges).flatMap(([ch,n]) => Array.from({length:n},(_,i)=>ch+(i+1))).sort();
  assert.deepEqual(points.map(p=>p.id).sort(), expected);
  assert.equal(points.filter(p=>p.catalogue==='classical').length,361);
  assert.equal(points.filter(p=>p.catalogue==='extra').length,48);
  for (const p of points) {
    assert.ok(p.name && p.hanja && p.pinyin && p.bodyRegion);
    assert.ok(p.location && p.nameSource.endsWith('/'+p.id));
    assert.ok(p.traditionSourceUrl.startsWith('https://'));
    assert.ok(p.traditionStatus==='landmark-only' || (p.traditionalIndications.length && p.traditionalTextEn));
    assert.ok(theory[p.id]);
  }
  assert.equal(points.find(p=>p.id==='ST17').traditionStatus,'landmark-only');
});
test('channel phase and individual Five Shu phase are distinct and all 60 are present', () => {
  const values=Object.values(theory);
  assert.equal(values.filter(t=>t.fiveShu).length,60);
  for (const name of ['정(井)','형(滎)','수(輸)','경(經)','합(合)']) assert.equal(values.filter(t=>t.fiveShu?.type===name).length,12);
  assert.equal(theory.LU9.channelElement,'금'); assert.equal(theory.LU9.fiveShu.element,'토');
  assert.equal(theory.LI1.fiveShu.element,'금'); assert.equal(theory.LU11.fiveShu.element,'목');
  assert.equal(theory.SI3.fiveShu.type,'수(輸)'); assert.equal(theory.SI5.fiveShu.type,'경(經)');
  assert.equal(values.filter(t=>t.categories.includes('luo')).length,15);
  for(const p of points.filter(p=>['CV','GV','EX'].includes(p.meridian))) {
    assert.equal(theory[p.id].channelElement,null); assert.equal(theory[p.id].fiveShu,null);
  }
});
test('multiple sites and internal-region references are explicit instead of duplicate point names', () => {
  const anchors=read('data/anchors.json'); assert.equal(new Set(anchors.map(a=>a.key)).size,834);
  for(const [id,count] of [['EX-HN1',4],['EX-B2',34],['EX-UE11',10],['EX-LE12',10],['EX-LE5',4]]) assert.equal(anchors.filter(a=>a.pointId===id).length,count);
  assert.deepEqual(anchors.filter(a=>a.pointId==='EX-HN12').map(a=>a.side),['left']);
  assert.deepEqual(anchors.filter(a=>a.pointId==='EX-HN13').map(a=>a.side),['right']);
  for(const id of ['GV28','EX-HN9','EX-HN10','EX-HN11','EX-HN12','EX-HN13']) assert.ok(anchors.filter(a=>a.pointId===id).every(a=>a.mode==='region-reference'));
});
test('regional model transitions preserve camera and restore compatible older snapshots', () => {
  const pose={position:[0,1,2],target:[0,1,0]};
  let s={...initialView(),camera:pose,markers:'hidden'};
  s=viewReducer(s,{type:'region-filter',value:'손목·손'});
  assert.equal(s.markers,'filtered'); assert.deepEqual(s.camera,pose);
  s=viewReducer(s,{type:'stage',index:2});assert.equal(s.filters.bodyRegion,'손목·손');assert.equal(s.markers,'filtered');
  s=viewReducer(s,{type:'filters',value:{catalogue:'extra',meridian:'EX'}});
  const ids=points.map(p=>p.id);
  assert.deepEqual(restoreView(JSON.stringify(s),ids,[]).filters,s.filters);
  delete s.filters.bodyRegion;delete s.filters.catalogue;
  const restored=restoreView(JSON.stringify(s),ids,[]);
  assert.equal(restored.filters.bodyRegion,'전체');assert.equal(restored.filters.catalogue,'all');
});

 test('regional filters follow location headings rather than incidental anatomical words', () => {
  const expected={LU1:'가슴',LU2:'가슴',LR14:'가슴',CV15:'배·골반',CV22:'목',LU8:'팔꿈치·아래팔'};
  for(const [id,region] of Object.entries(expected)) assert.equal(points.find(p=>p.id===id).bodyRegion,region,id);
 });
