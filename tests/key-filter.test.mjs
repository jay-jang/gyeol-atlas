import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { keyOwners, organChoices, organKeyPointIds } from '../src/point-display.ts';
import { initialView, restoreView } from '../src/view-state.ts';
const points = JSON.parse(fs.readFileSync('data/points.json'));
const own = m => points.filter(p => keyOwners(p).includes(m)).map(p => p.id);

test('the per-meridian 원·모·유·극·락 filter keeps each meridian\'s own five classes wherever they lie', () => {
  assert.deepEqual(own('LU'), ['LU1', 'LU6', 'LU7', 'LU9', 'BL13']);
  assert.deepEqual(own('BL').sort(), ['BL28', 'BL58', 'BL63', 'BL64', 'CV3'].sort(), 'BL13–BL27 lie on BL but belong to other zang-fu');
  assert.deepEqual(own('ST').sort(), ['BL21', 'CV12', 'ST34', 'ST40', 'ST42'].sort(), 'ST25 lies on ST but is the large intestine mu');
  assert.deepEqual(own('KI').sort(), ['BL23', 'GB25', 'KI3', 'KI4', 'KI5'].sort(), 'KI8/KI9 are extra-vessel xi');
  assert.deepEqual(own('SP').sort(), ['BL20', 'LR13', 'SP21', 'SP3', 'SP4', 'SP8'].sort());
  assert.deepEqual(own('CV'), ['CV15']); assert.deepEqual(own('GV'), ['GV1']); assert.deepEqual(own('EX'), []);
  for (const { id } of organChoices) assert.deepEqual([...own(id)].sort(), [...organKeyPointIds(id, points)].sort(), id);
  assert.equal(points.filter(p => keyOwners(p).length).length, 63, '12 zang-fu × 5 + SP21 + CV15 + GV1');
  for (const id of ['KI8', 'BL59', 'KI9', 'GB35', 'ST36', 'LU5']) assert.deepEqual(keyOwners(points.find(p => p.id === id)), [], id);
  // Every point is owned by one meridian at most.
  assert.ok(points.every(p => keyOwners(p).length <= 1));
});

test('a saved per-meridian filter restores', () => {
  const view = { ...initialView('LU9'), filters: { ...initialView().filters, concept: 'key', meridian: 'LU' } };
  assert.equal(restoreView(JSON.stringify(view), points.map(p => p.id), []).filters.concept, 'key');
});
