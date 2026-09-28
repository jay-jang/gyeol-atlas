import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const read=path=>JSON.parse(fs.readFileSync(path));
const report=read('docs/anatomy-alignment/bonehub-clavicle-screen.json');
const thorax=read('docs/anatomy-alignment/bonehub-thorax-screen.json');
const inventory=read('docs/anatomy-alignment/bonehub-female-inventory.json');
const hash=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');

test('held-out female clavicles are not accepted under the thoracic rigid map',()=>{
  assert.equal(report.status,'OFFLINE HELD-OUT CLAVICLE SCREEN; NOT APPLIED');
  assert.equal(report.sourceRevision,inventory.revision);
  assert.deepEqual(report.transformMatrixColumnMajor,thorax.candidates.find(c=>c.mode==='rigid').matrixColumnMajor);
  assert.deepEqual([report.skinTopology.connectedComponents,report.skinTopology.boundaryEdges,report.skinTopology.nonManifoldEdges],[1,0,0]);
  assert.equal(report.donorSternumSkin.skinOutside2mm,0);
  assert.deepEqual(report.sides.map(s=>s.side),['left','right']);
  for(const side of report.sides){
    assert.equal(side.current.skinOutside2mm,0);
    assert.equal(side.current.skinAmbiguous,0);
    assert.equal(side.candidate.skinAmbiguous,0);
    assert.ok(side.candidate.skinOutside2mm>3000);
    assert.ok(side.candidate.maxOutsideMm>15);
    assert.deepEqual(side.candidate.airwayCrossingIds,[]);
    assert.ok(side.current.airwayCrossingIds.length>0);
    assert.ok(side.candidate.medialToSternumMinMm>side.current.medialToSternumMinMm);
    assert.ok(side.candidate.lateralToScapulaMinMm>side.current.lateralToScapulaMinMm);
    assert.ok(side.sameDonor.scapulaSkin.skinOutside2mm>7000);
    assert.ok(side.sameDonor.medialToSternumMinMm<4);
    assert.ok(side.sameDonor.lateralToScapulaMinMm<2);
  }
  assert.deepEqual(report.sides.map(s=>s.candidate.skinOutside2mm),[5522,3087]);
  assert.deepEqual(report.sides.map(s=>s.sameDonor.scapulaSkin.skinOutside2mm),[14766,7262]);
});

test('clavicle screen pins available source and calculation files',()=>{
  for(const file of report.files){
    if(file.path.startsWith('.cache/'))continue; // External source payloads are pinned by receipt but not committed.
    assert.equal(hash(file.path),file.sha256,file.path);
  }
  const receipt=read('docs/anatomy-alignment/bonehub-female-receipt.json');
  for(const side of ['LEFT','RIGHT']){
    const part=inventory.parts.find(p=>p.name===`CLAVICLE_${side}`);
    const source=receipt.files.find(f=>f.path===part.file);
    assert.equal(source.sha256,part.sha256);
    assert.ok(report.files.some(f=>f.path===source.local&&f.sha256===source.sha256));
  }
});
