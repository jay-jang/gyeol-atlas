import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Triangle,Vector3} from 'three';
import {transverseTriangleWitness} from '../scripts/lib/triangle-witness.mjs';
const read=p=>JSON.parse(fs.readFileSync(`docs/anatomy-alignment/${p}.json`));
const audit=read('donor-fidelity-audit'),packed=read('donor-fidelity-packing'),readback=read('donor-fidelity-readback');
test('recorded source and reconstructed donor crossing pairs have independent interior witnesses',()=>{
  assert.equal(audit.summary.evaluatedPairs,2850);assert.equal(audit.meshes.length,76);
  assert.equal(audit.pairs.filter(p=>p.raw).length,33);assert.equal(audit.pairs.filter(p=>p.packed).length,65);
  assert.equal(audit.pairs.filter(p=>!p.raw&&p.packed).length,32);
  for(const pair of audit.pairs)for(const side of ['raw','packed'])if(pair[side]){
    const w=pair[side].witness;assert.ok(w);
    const a=new Triangle(...w.a.map(p=>new Vector3(...p))),b=new Triangle(...w.b.map(p=>new Vector3(...p)));
    assert.ok(transverseTriangleWitness(a,b));
    assert.ok(w.barycentric.every(v=>v>0&&v<1));assert.ok(w.segmentFraction>0&&w.segmentFraction<1);
  }
});
test('packing evidence distinguishes tiny simplification savings from full source triangle preservation',()=>{
  assert.equal(packed.parts.length,76);assert.equal(packed.unsimplifiedAlternative.parts.length,76);
  assert.equal(packed.summary.restoredRawMeshes,62);
  assert.ok(packed.parts.every(p=>p.rawToCandidateMaxMm<=.02));
  assert.equal(packed.unsimplifiedAlternative.triangles,1304042);
  assert.equal(packed.unsimplifiedAlternative.triangles-packed.summary.triangles,706);
  assert.equal(packed.unsimplifiedAlternative.gzipBytes-packed.gzipBytes,7588);
  assert.equal(readback.results.length,2);
  for(const result of readback.results){
    assert.equal(result.meshes,76);assert.equal(result.testedPairs,2850);assert.equal(result.crossingPairs,33);
    const expected=audit.pairs.filter(p=>p.raw).map(p=>[...p.ids].sort().join('/')).sort();
    assert.deepEqual(result.pairs.map(p=>p.key).sort(),expected);
  }
  assert.equal(readback.results.find(r=>r.variant==='full').triangleIdentityChecked,true);
});
