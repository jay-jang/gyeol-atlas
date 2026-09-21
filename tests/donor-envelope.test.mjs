import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p));
const report=read('docs/anatomy-alignment/donor-envelope-audit.json');
const packing=read('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative;
test('source-envelope evidence covers all 76 final muscles and distinguishes full from sampled screens',()=>{
  assert.match(report.status,/NO ATLAS TRANSFORM OR RUNTIME CHANGE/);
  assert.deepEqual(report.results.map(r=>r.name),['All','Fat_Outer','Inner']);
  for(const surface of report.results){
    assert.equal(surface.rows.length,76);assert.equal(new Set(surface.rows.map(r=>r.id)).size,76);
    for(const row of surface.rows){
      const p=packing.parts.find(p=>p.id===row.id);assert.ok(p);assert.equal(row.sourceVertices,p.vertexCount);
      assert.equal(row.samples,surface.name==='All'?p.vertexCount:Math.min(512,p.vertexCount));
      assert.equal(row.samples,row.inside+row.outside+row['surface-band']+row.ambiguous);
    }
  }
  const all=report.results[0];assert.equal(all.summary.samples,652173);
  assert.equal(all.summary.outside,0);assert.equal(all.summary.ambiguous,1);
  assert.equal(all.summary['surface-band'],2);assert.equal(all.topology.connectedComponents,1);
  assert.equal(all.topology.boundaryEdges,0);assert.equal(all.topology.nonManifoldEdges,0);
});
test('hollow fat is not reinterpreted as failed body containment and ambiguous rays remain explicit',()=>{
  const [all,outer,inner]=report.results;
  assert.equal(outer.topology.connectedComponents,4);assert.equal(outer.summary.samples,38854);
  assert.equal(outer.summary.outside,33243);assert.equal(inner.summary.outside,349);
  const witness=all.ambiguousRayDiagnostics[0];assert.equal(witness.id,'VHF0013');assert.equal(witness.vertex,15540);
  assert.equal(witness.rays.length,35);assert.deepEqual(witness.rays.slice(0,3).map(r=>r.parity),[0,1,1]);
  assert.ok(witness.rays.slice(3).every(r=>r.parity===1));
  assert.equal(witness.rays[0].rawHits,5);assert.equal(witness.rays[0].crossings,4);
  assert.ok(witness.rays[0].hits[3].distanceMetres-witness.rays[0].hits[2].distanceMetres<1e-7);
});
test('diagnostic screenshots pin the same original surface and muscle packing, not runtime geometry',()=>{
  const visual=read('docs/anatomy-alignment/donor-envelope-visual.json');assert.deepEqual(visual.errors,[]);
  assert.equal(visual.sourceAllSha256,report.results[0].sha256);assert.equal(visual.sourceMusclePackingSha256,packing.sha256);
  assert.equal(visual.captures.length,2);
  for(const c of visual.captures){
    const file=`docs/anatomy-alignment/donor-source-${c.mode}.png`;
    assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),c.sha256);
  }
});
