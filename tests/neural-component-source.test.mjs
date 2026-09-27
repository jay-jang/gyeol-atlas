import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
const read=name=>JSON.parse(fs.readFileSync(`docs/anatomy-alignment/${name}.json`));
const report=read('neural-component-source'),back=read('neural-component-readback'),visual=read('neural-component-visual');
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('neural component records pin full upstream organ membership and exact array equality, not anatomical correctness',()=>{
  assert.equal(report.upstreamCommit,'fca41ae2e23f825f2921843c276e80509fa778f1');
  assert.deepEqual(report.components.map(c=>[c.organ,c.version,c.bytes,c.rows.length]),[['brain','v1.4',11983380,283],['spinal-cord','v1.1',7657228,29]]);
  for(const c of report.components){
    assert.equal(new Set(c.rows.map(r=>r.name)).size,c.count);
    assert.ok(c.rows.every(r=>r.maxCoordinateDifferenceMm===0&&/^[a-f0-9]{64}$/.test(r.positionSha256)&&/^[a-f0-9]{64}$/.test(r.indexSha256)));
  }
  assert.equal(back.meshes,312);assert.equal(back.vertices,472148);assert.equal(back.indexReferences,2835540);
  assert.match(back.scope,/Not full independent containment or clinical verification/);
});

test('cord audit preserves all 754 pairs per resolution, seven inside pairs and the separate ambiguous witness',()=>{
  const expected=['HRAF0366/HRAF0837','HRAF0370/HRAF0839','HRAF0370/HRAF0840','HRAF0371/HRAF0840','HRAF0372/HRAF0840','HRAF0372/HRAF0841','HRAF0373/HRAF0841'];
  for(const [i,m] of report.modes.entries()){
    assert.equal(m.rows.length,754);assert.equal(m.bones.length,26);assert.equal(m.bones.filter(b=>/^Lumbar vertebra/.test(b.name)).length,6);
    assert.ok(m.bones.every(b=>b.supported));assert.equal(new Set(m.rows.map(r=>`${r.cordId}/${r.boneId}`)).size,754);
    assert.deepEqual(m.rows.filter(r=>r.inside).map(r=>`${r.cordId}/${r.boneId}`),expected);
    for(const r of m.rows){assert.equal(r.inside+r.outside+r['surface-band']+r.ambiguous+r.unsupported,r.vertices);assert.equal(r.ambiguous,r.ambiguousPoints.length);}
    assert.equal(m.rows.reduce((n,r)=>n+r.inside,0),[3772,846][i]);assert.equal(m.summary.ambiguous,[1,0][i]);
    assert.equal(m.summary.unsupported,0);assert.ok(m.summary.maximumInsideBoundaryDistanceMm>2.44&&m.summary.maximumInsideBoundaryDistanceMm<2.45);
  }
  const inside=back.checks.filter(r=>r.kind==='deepest-inside'),ambiguous=back.checks.filter(r=>r.kind==='ambiguous');
  assert.equal(inside.length,14);assert.ok(inside.every(r=>Math.abs(Math.abs(r.winding)-1)<1e-8&&r.differenceMm<1e-8));
  assert.equal(ambiguous.length,1);assert.equal(ambiguous[0].cordId,'HRAF0367');assert.ok(Math.abs(ambiguous[0].winding)<1e-8);
});

test('selected-plane geometry and seven diagnostics retain hashes and bounded readback coverage',()=>{
  const sections=read('neural-component-sections');assert.equal(sections.records.length,7);assert.equal(back.sectionSegments,6580);
  assert.ok(back.maxSectionEndpointDifferenceM<1e-12);assert.equal(visual.images.length,7);assert.deepEqual(visual.errors,[]);
  for(const record of [report,back,visual])for(const f of record.files){
    // Cache assets are separately read by the audit/readback commands. These
    // record gates always validate repository inputs, also on cache-free CI.
    if(!f.file.startsWith('.cache/'))assert.equal(sha(f.file),f.sha256,f.file);
  }
  for(const image of visual.images)assert.equal(sha(image.file),image.sha256);
  assert.match(report.limitations.join(' '),/Triangle interiors, roots, discs and other tissues are not sampled/);
});
