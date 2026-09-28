import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const read=path=>JSON.parse(fs.readFileSync(path));
const prefix='docs/anatomy-alignment/';
const organ=read(`${prefix}female-organ-bone-relations.json`);
const source=read(`${prefix}female-organ-bone-source-readback.json`);
const thorax=read(`${prefix}bonehub-thorax-screen.json`);
const visual=read(`${prefix}bonehub-thorax-visual.json`);
const hash=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');

test('female organ/bone audit distinguishes borrowed bone crossings from native source relations',()=>{
  assert.deepEqual([organ.scope.organSurfaces,organ.scope.defaultOrganSurfaces,organ.scope.boneLayerSurfaces,organ.scope.evaluatedPairs],
    [301,293,321,301*321]);
  assert.equal(organ.pairs.length,203);
  assert.deepEqual([organ.summary.defaultIntersectingPairs,organ.summary.defaultBorrowedBonePairs,
    organ.summary.defaultNativeBonePairs,organ.summary.strictDefaultPairs],[203,177,26,203]);
  assert.equal(organ.rows.filter(r=>r.intersectingBoneIds.length).length,65);
  assert.ok(organ.pairs.every(p=>p.strictPlaneStraddlingPairs>0));
  assert.equal(source.sourceSha256,read('data/catalog/female-source-restoration.json').sourceSha256);
  assert.deepEqual(source.rows.map(p=>[p.organId,p.boneId]),[['HRAF0754','HRAF0837'],['HRAF0421','HRAF0827']]);
  assert.ok(source.rows.every(p=>p.strictPlaneStraddlingPairs>0));
});

test('female donor-rib candidate retains the held-out, skin and cartilage failure evidence',()=>{
  assert.equal(thorax.ribSourceCount,24);
  assert.equal(thorax.skinTopology.connectedComponents,1);
  assert.equal(thorax.skinTopology.boundaryEdges,0);
  assert.equal(thorax.skinTopology.nonManifoldEdges,0);
  const rigid=thorax.candidates.find(c=>c.mode==='rigid');
  assert.equal(rigid.spine.filter(p=>p.training).length,6);
  assert.equal(rigid.heldOutSurfaces.length,6);
  assert.ok(Math.max(...rigid.spine.filter(p=>!p.training).map(p=>p.centreResidualMm))<1.725);
  assert.ok(Math.max(...rigid.heldOutSurfaces.map(p=>p.sourceToAtlas.p95Mm))<2.64);
  assert.ok(Math.max(...rigid.heldOutSurfaces.map(p=>p.atlasToSource.p95Mm))<3.03);
  const current=thorax.measure.find(p=>p.mode==='current-male-borrowed');
  const candidate=thorax.measure.find(p=>p.mode==='rigid');
  assert.deepEqual([current.fullVertices,current.fullOutside,current.fullAmbiguous,current.respiratorySurfacePairs],
    [19489,0,0,51]);
  assert.deepEqual([candidate.fullVertices,candidate.fullOutside,candidate.fullAmbiguous,candidate.respiratorySurfacePairs],
    [402418,0,0,53]);
  assert.equal(current.rows.filter(p=>p.cartilageRelation).length,14);
  assert.ok(current.rows.filter(p=>p.cartilageRelation).every(p=>p.cartilageRelation.crossing));
  for(const side of ['left','right'])for(const number of side==='left'?[3,4,5,6,7]:[3,4,5,6]){
    const relation=candidate.rows.find(p=>p.side===side&&p.number===number).cartilageRelation;
    assert.equal(relation.crossing,false);
    assert.ok(relation.ribToCartilageMinimumMm>4.8);
  }
});

test('saved diagnostics pin repo inputs and four directly inspected camera captures',()=>{
  for(const report of [organ,source,thorax])for(const file of report.files||[]){
    const path=file.path||file.file;
    if(path.startsWith('.cache/'))continue; // Pinned external BoneHub/HRA payloads are not committed.
    assert.equal(hash(path),file.sha256,path);
  }
  assert.deepEqual(visual.errors,[]);
  assert.equal(visual.captures.length,4);
  assert.equal(hash(`${prefix}bonehub-thorax-screen.json`),visual.sourceReportSha256);
  assert.equal(hash('scripts/capture-bonehub-thorax-candidate.mjs'),visual.scriptSha256);
  for(const capture of visual.captures){
    assert.equal(capture.camera.ribIds.length,6);
    assert.equal(hash(`${prefix}bonehub-thorax-${capture.variant}-${capture.view}.png`),capture.sha256);
  }
});
