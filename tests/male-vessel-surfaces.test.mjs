import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const report=JSON.parse(fs.readFileSync('docs/anatomy-alignment/male-vessel-surfaces.json'));
const readback=JSON.parse(fs.readFileSync('docs/anatomy-alignment/male-vessel-surfaces-readback.json'));
const registration=JSON.parse(fs.readFileSync('data/catalog/male-registration.json'));

test('male vessel surface audit pins actual deployed sources and all 39 matched names',()=>{
  for(const [path,expected] of Object.entries(report.files))
    assert.equal(createHash('sha256').update(fs.readFileSync(path)).digest('hex'),expected,path);
  const names=report.rows.map(r=>r.name);
  assert.equal(names.length,39);
  assert.deepEqual(names,[...new Set(names)].sort());
  assert.deepEqual(names,registration.holdout.map(r=>r.name).sort());
  assert.deepEqual(report.registration,{scale:registration.scale,translation:registration.translation});
  assert.ok(Math.abs(report.syntheticCheck.forward.p95Mm-10)<.00001);
  assert.ok(Math.abs(report.syntheticCheck.reverse.p95Mm-10)<.00001);
});

test('independent sampled triangle readback pins its inputs and keeps zero distance residual',()=>{
  assert.equal(readback.sourceReportSha256,createHash('sha256').update(fs.readFileSync('docs/anatomy-alignment/male-vessel-surfaces.json')).digest('hex'));
  assert.equal(readback.verifierSha256,createHash('sha256').update(fs.readFileSync('scripts/verify-male-vessel-surfaces.mjs')).digest('hex'));
  assert.equal(readback.checks,72);assert.equal(readback.samples.length,72);
  assert.ok(readback.maximumResidualMm<.000001);
  for(const x of readback.samples)assert.ok(Math.abs(x.bvhMm-x.bruteMm)<.000001);
});

test('surface evidence retains direction, referenced-vertex scope and extent asymmetry',()=>{
  let referenced=0;
  for(const r of report.rows){
    const old=registration.holdout.find(p=>p.name===r.name);
    assert.ok(Math.abs(r.centerResidualMm-old.afterMm)<.01,r.name);
    for(const side of ['sourceToTarget','targetToSource']){
      const d=r[side];referenced+=d.vertices;
      assert.ok(d.vertices>0&&d.minimumMm>=0&&d.minimumMm<=d.medianMm&&d.medianMm<=d.p95Mm&&d.p95Mm<=d.maximumMm,r.name);
    }
    for(const side of ['sourceBounds','targetBounds']){
      assert.ok(r[side].extentMm.every(v=>Number.isFinite(v)&&v>0),r.name);
    }
  }
  assert.equal(referenced,81432);
  const jugular=report.rows.find(r=>r.name==='internal jugular vein left');
  assert.ok(jugular.sourceBounds.extentMm[1]>3*jugular.targetBounds.extentMm[1]);
  assert.ok(jugular.sourceToTarget.p95Mm>100&&jugular.targetToSource.p95Mm<10);
  const arch=report.rows.find(r=>r.name==='aortic arch');
  assert.ok(arch.sourceToTarget.p95Mm<10&&arch.targetToSource.p95Mm<10);
});
