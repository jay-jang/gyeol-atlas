import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const file = name => new URL(`../docs/anatomy-alignment/${name}.json`, import.meta.url);
const read = name => JSON.parse(fs.readFileSync(file(name)));
const stages = ['bonehub-denver-final-frame', 'bonehub-denver-original-frame'];

test('common source-frame fitting preserves fourteen held-out tarsals and full two-way evaluation', () => {
  for (const stage of stages) {
    const report = read(stage);
    assert.equal(report.fitPairs, 10); assert.equal(report.heldOutPairs, 14);
    assert.equal(report.records.length, 24);
    assert.deepEqual([...new Set(report.records.filter(r => r.fitLandmark).map(r => r.name))].sort(), ['Femur','Fibula','Patella','Pelvis','Tibia']);
    assert.equal(report.refinement.stopReason, 'centre-change threshold');
    assert.ok(report.refinement.iterations.at(-1).maximumCentreChangeMm < 1e-5);
    for (const r of report.records) {
      assert.equal(r.sourceComponents.reduce((n,c) => n+c.vertices,0), r.bonehubToDenver.vertices);
      assert.equal(r.targetComponents.reduce((n,c) => n+c.vertices,0), r.denverToBonehub.vertices);
    }
    assert.ok(report.records.filter(r => !r.fitLandmark).every(r => r.bonehubToDenver.p95Mm > 4));
    assert.match(report.status, /no HRA registration or runtime export/);
  }
});

test('original pelvis fragment is retained, not interpreted as whole-bone displacement', () => {
  const original = read(stages[1]).records.find(r => r.name==='Pelvis' && r.side==='right');
  assert.deepEqual(original.targetComponents.map(c => c.triangles), [737688,564]);
  assert.deepEqual(original.targetComponents.map(c => c.vertices), [368844,284]);
  assert.ok(original.fittedCentreResidualMm > 120);
  assert.ok(original.dominantComponentCentreResidualMm < 4);
  assert.ok(original.denverToBonehub.maximum.distanceMm > 260);
  const final = read(stages[0]).records.find(r => r.name==='Pelvis' && r.side==='right');
  assert.equal(final.targetComponents.length, 1);
});

test('independent query-coordinate readback and captures pin both exact reports', () => {
  const readback = read('bonehub-denver-frame-readback'), visual = read('bonehub-denver-frame-visual');
  assert.equal(readback.records.length, 48);
  assert.equal(readback.transformedOccurrences, 1823930);
  assert.equal(readback.maximumQueryVerticesMatched, 96);
  assert.equal(visual.captures.length, 4); assert.deepEqual(visual.errors, []);
  for (const [i, folder] of ['bonehub-denver-frame','bonehub-denver-original-frame'].entries()) {
    const sha = createHash('sha256').update(fs.readFileSync(file(stages[i]))).digest('hex');
    for(const record of [readback,visual]) assert.equal(record.files.find(f => f.file===`.cache/${folder}/report.json`).sha256,sha);
  }
});
