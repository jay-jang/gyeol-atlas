import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { keyOwners } from '../src/point-display.ts';
// 2026-11-05 Codex·Claude cross-check of the zang-fu special points (docs/acupoint-key-filter/VERIFICATION.md).
const points = Object.fromEntries(JSON.parse(fs.readFileSync('data/points.json')).map(p => [p.id, p]));
const review = JSON.parse(fs.readFileSync('data/acupoint-authoring/position-review-2026-11-05.json')).points;
const y = id => points[id].position[1];
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('reviewed positions are the assembled seeds', () => {
  assert.equal(Object.keys(review).length, 78);
  for (const [id, r] of Object.entries(review)) {
    assert.deepEqual(points[id].position, r.position, id);
    assert.equal(points[id].surface, r.surface, id);
    assert.ok(r.previous && r.basis && r.reviewers, id);
  }
  const keyIds = Object.values(points).filter(p => keyOwners(p).some(o => o !== 'CV' && o !== 'GV')).map(p => p.id);
  assert.equal(keyIds.length, 61);
  assert.equal(keyIds.filter(id => review[id]).length, 33, 'special points moved by the review');
});

test('the abdominal cun follows the measured umbilicus, xiphisternal junction and pubic symphysis', () => {
  // Skin navel pit 0.989, xiphisternal junction 1.2025, upper border of the symphysis 0.8266 (two reviewers agreed within 1.4 mm).
  const navel = 0.989, xiphoid = 1.2025, pubis = 0.8266, upper = (xiphoid - navel) / 8, lower = (navel - pubis) / 5;
  near(y('CV8'), navel, 1e-4, 'CV8 on the navel'); near(y('CV2'), pubis, 1e-4, 'CV2 on the symphysis');
  for (const [id, cun] of [['CV9', 1], ['CV12', 4], ['CV14', 6], ['CV15', 7], ['ST21', 4], ['KI21', 6]]) near(y(id), navel + cun * upper, 6e-4, id);
  for (const [id, cun] of [['CV3', 4], ['CV4', 3], ['CV5', 2], ['CV6', 1.5], ['CV7', 1]]) near(y(id), navel - cun * lower, 6e-4, id);
  for (const id of ['ST25', 'KI16', 'SP15']) near(y(id), navel, 1e-4, `${id} level with the navel`);
});

test('fixed special points keep their landmark order', () => {
  // Lateral mu points lie at the free ends of the 11th and 12th ribs, below the 7th-intercostal GB24.
  assert.ok(y('LR13') < y('GB24') && y('GB25') <= y('LR13') + 1e-3);
  // Leg xi/luo points: GB36 and GB37 sit 7 and 5 cun above the lateral malleolus, GB35 level with GB36.
  assert.ok(y('GB37') < y('GB36')); near(y('GB35'), y('GB36'), 2e-3, 'GB35 level with GB36');
  // Foot source points sit proximal (posterior, -z) to the stream points: SP3 behind SP2, LR3 behind LR2, ST42 behind ST43.
  for (const [a, b] of [['SP3', 'SP2'], ['LR3', 'LR2'], ['ST42', 'ST43']]) assert.ok(points[a].position[2] < points[b].position[2] - 0.03, `${a} proximal to ${b}`);
});
