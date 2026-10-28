import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pointColor, pointOrgans, pointCategories, organText, organChoices } from '../src/point-display.ts';
import { initialView, viewReducer, restoreView } from '../src/view-state.ts';
const read = p => JSON.parse(fs.readFileSync(p));
const points = read('data/points.json'), concepts = read('data/point-concepts.json'), theory = read('data/acupoint-theory.json');
const point = id => points.find(p => p.id === id);
const sets = {
  yuan: 'LU9 LI4 ST42 SP3 HT7 SI4 BL64 KI3 PC7 TE4 GB40 LR3',
  mu: 'LU1 ST25 CV12 LR13 CV14 CV4 CV3 GB25 CV17 CV5 GB24 LR14',
  'back-shu': 'BL13 BL25 BL21 BL20 BL15 BL27 BL28 BL23 BL14 BL22 BL19 BL18',
  xi: 'LU6 LI7 ST34 SP8 HT6 SI6 BL63 KI5 PC4 TE7 GB36 LR6 KI8 BL59 KI9 GB35',
  luo: 'LU7 LI6 ST40 SP4 HT5 SI7 BL58 KI4 PC6 TE5 GB37 LR5 GV1 CV15 SP21',
};
test('all named special-point sets match the source table and both data exports', () => {
  for (const [category, ids] of Object.entries(sets)) {
    assert.deepEqual(points.filter(p => concepts[p.id].categories.includes(category)).map(p => p.id).sort(), ids.split(' ').sort(), category);
    assert.deepEqual(points.filter(p => theory[p.id].categories.includes(category)).map(p => p.id).sort(), ids.split(' ').sort(), category);
  }
  for (const p of points) assert.deepEqual([...theory[p.id].categories].sort(), pointCategories(p.id).map(c => c.id).sort(), p.id);
  assert.equal(pointCategories('SI3').find(c => c.id === 'back-shu'), undefined);
  assert.equal(theory.KI8.xiMeridian, '음교맥'); assert.equal(theory.GB35.xiMeridian, '양유맥');
  assert.equal(theory.LU6.xiMeridian, null);
});
test('Mu and Back-Shu organ associations coexist with channel membership and retain complete comparison bundles', () => {
  assert.deepEqual(pointOrgans(point('ST25')), ['LI', 'ST']);
  assert.deepEqual(pointOrgans(point('BL13')), ['LU', 'BL']);
  assert.deepEqual(pointOrgans(point('GB25')), ['KI', 'GB']);
  assert.deepEqual(pointOrgans(point('CV12')), ['ST']);
  assert.deepEqual(pointOrgans(point('LU2')), ['LU']);
  for (const id of ['GV1','CV15','EX-HN1']) assert.deepEqual(pointOrgans(point(id)), []);
  assert.equal(organChoices.length, 12);
  assert.match(organText(point('BL13')), /폐\(분류 대응\).*방광\(소속 경맥\)/);
  for (const id of sets['back-shu'].split(' ')) {
    const index = sets['back-shu'].split(' ').indexOf(id), yuan = sets.yuan.split(' ')[index];
    assert.deepEqual(concepts[id].organIds, concepts[yuan].organIds, id);
    assert.equal(concepts[id].traditionalChannel, concepts[yuan].traditionalChannel);
  }
  assert.equal(concepts.BL13.organIds.length, 5); assert.equal(concepts.BL23.organIds.length, 2);
  assert.deepEqual(concepts.BL14.organIds, []); assert.deepEqual(concepts.BL22.organIds, []);
});
test('colour precedence keeps overlapping categories and organ relations meaningful', () => {
  assert.equal(pointColor(point('LU9'), 'category'), '#72d6ca');
  assert.equal(pointColor(point('LU9'), 'category', 'five-shu'), '#cadd80');
  assert.equal(pointCategories('LU9').length, 2);
  assert.equal(pointColor(point('LU6'), 'category'), '#f497c2');
  assert.equal(pointColor(point('BL13'), 'organ'), pointColor(point('LU9'), 'organ'));
  assert.equal(pointColor(point('ST25'), 'organ', 'all', 'ST'), pointColor(point('ST1'), 'organ'));
  assert.equal(pointColor(point('ST25'), 'organ'), pointColor(point('LI4'), 'organ'));
  assert.equal(pointColor(point('EX-HN1'), 'organ'), '#a9bcc5');
});
test('display preferences and new filters restore through system/sex changes with old snapshots migrated', () => {
  let s = { ...initialView(), camera: { position: [0,1,2], target: [0,1,0] }, markers: 'hidden', labels: true };
  s = viewReducer(s, { type: 'marker-color', value: 'category' });
  s = viewReducer(s, { type: 'filters', value: { concept: 'xi', organ: 'KI' } });
  const before = s;
  for (const action of [{ type:'stage', index:2 }, { type:'sex', value:'female' }]) {
    s = viewReducer(s, action);
    for (const key of ['camera','markers','labels','markerColor','filters']) assert.deepEqual(s[key], before[key], key);
  }
  const ids = points.map(p => p.id);
  const restored = restoreView(JSON.stringify(s), ids, []);
  assert.equal(restored.markerColor, 'category'); assert.deepEqual(restored.filters, s.filters);
  const legacy = structuredClone(s); delete legacy.markerColor; delete legacy.filters.organ;
  const migrated = restoreView(JSON.stringify(legacy), ids, []);
  assert.equal(migrated.markerColor, 'meridian'); assert.equal(migrated.filters.organ, 'all');
  assert.deepEqual(migrated.camera, s.camera);
  for (const bad of [{...s, markerColor:'bogus'}, {...s, filters:{...s.filters, organ:'heart'}}]) assert.deepEqual(restoreView(JSON.stringify(bad), ids, []), initialView());
  const reset = viewReducer(s, { type:'reset-filters' });
  assert.equal(reset.filters.organ, 'all'); assert.equal(reset.markerColor, 'category');
});
