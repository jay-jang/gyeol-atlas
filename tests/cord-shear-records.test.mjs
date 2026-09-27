import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const read=name=>JSON.parse(fs.readFileSync(`docs/anatomy-alignment/${name}.json`));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const tags=['cord-shear','cord-shear-seeded'],fits=tags.map(t=>read(`${t}-fit`)),feasibility=tags.map(t=>read(`${t}-feasibility`));
const audit=read('cord-shear-audit'),back=read('cord-shear-readback'),visual=read('cord-shear-visual');
test('both shear fits retain failed convergence and finite-system contradiction evidence, not an anatomical impossibility claim',()=>{
  for(const [i,f] of fits.entries()){
    assert.equal(f.history.length,1);assert.equal(f.history[0].converged,false);assert.equal(f.history[0].constraints,4055);assert.equal(f.history[0].sweeps,1500);
    assert.equal(feasibility[i].primal.status,2);assert.equal(feasibility[i].dual.status,0);
    assert.equal(feasibility[i].certificate.rows.length,[9,17][i]);assert.ok(back.results[i].strictContradictionMarginM>1e-4);
    assert.deepEqual(f.supportY,[1.11,1.31]);assert.equal(f.unavailableSeeds.length,0);
    assert.ok(f.changed.filter(r=>['HRAF0353','HRAF0381'].includes(r.id)).every(r=>r.moved===0));
    assert.match(feasibility[i].scope,/not proof that a valid cord pose/);
  }
  assert.ok(Math.max(...fits[0].field.coefficients.map(Math.abs))>.0052); // Failed solve exceeds its requested bound.
});
test('stored candidate audit preserves new failures and remaining overlaps even when an aggregate improves',()=>{
  for(const [i,m] of audit.modes.entries()){
    assert.deepEqual(m.runs.map(r=>r.summary.inside),[[3772,6639,1895],[846,1421,442]][i]);
    assert.deepEqual(m.runs.map(r=>r.summary.crossingPairs),[7,9,6]);
    assert.ok(m.runs.every(r=>r.summary.pairs===754&&r.summary.cordPairs===406&&r.summary.internalCrossingPairs===28));
    assert.equal(m.runs[1].newCrossingPairs.length,4);assert.equal(m.runs[2].newCrossingPairs.length,0);
    assert.ok(m.runs.slice(1).every(r=>r.newInternalPairs.length===0));
  }
  assert.match(audit.scope,/Other fixed tissues/);assert.match(audit.status,/REJECTED/);
});
test('scalar readback and diagnostic captures retain exact saved inputs without claiming runtime UI validation',()=>{
  for(const r of back.results){assert.equal(r.points,181859);assert.equal(r.fixedOutsideSupport,98077);assert.equal(r.maxScalarDifferenceM,0);assert.ok(r.maxInverseRoundingM<8e-9);assert.ok(r.maxRowDifference<1e-12);}
  assert.equal(visual.images.length,2);assert.deepEqual(visual.errors,[]);
  for(const report of [...fits,...feasibility,audit,back,visual])for(const f of report.files)if(!f.file.startsWith('.cache/'))assert.equal(hash(f.file),f.sha256,f.file);
  for(const image of visual.images)assert.equal(hash(image.file),image.sha256);
});
