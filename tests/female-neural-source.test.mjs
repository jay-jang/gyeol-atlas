import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Triangle,Vector3} from 'three';
import {transverseTriangleWitness} from '../scripts/lib/triangle-witness.mjs';
const file='docs/anatomy-alignment/female-neural-source.json';
const read=p=>JSON.parse(fs.readFileSync(p)),audit=read(file),proof=read('docs/anatomy-alignment/female-neural-source-readback.json');
const modes=['source','runtime','sourceNeuralRuntimeBone','runtimeNeuralSourceBone'];
test('female neural diagnostic distinguishes native source and unchanged borrowed bones',()=>{
  assert.equal(audit.summary.evaluatedPairs,362*321);assert.equal(audit.records.length,683);
  assert.equal(audit.records.filter(r=>r.sourceFile).length,503);
  assert.equal(audit.records.filter(r=>r.sourceFile?.includes('v1.5')).length,8);
  assert.equal(audit.records.filter(r=>!r.sourceFile).length,180);
  for(const r of audit.records.filter(r=>!r.sourceFile)){
    assert.equal(r.system,'borrowed');assert.equal(r.sourcePositionSha256,r.runtimePositionSha256);
  }
  assert.equal(audit.pairs.length,82);
  for(const p of audit.pairs)for(const mode of modes){
    const w=p[mode];assert.ok(w);assert.ok(w.planeStraddleExtentMm>.001);
    assert.ok(w.point.every(Number.isFinite));
    const triangle=points=>new Triangle(...points.map(p=>new Vector3(...p)));
    assert.ok(transverseTriangleWitness(triangle(w.a),triangle(w.b)));
  }
  assert.equal(audit.pairs.filter(p=>p.boneSystem==='skeletal').length,7);
  assert.ok(audit.pairs.filter(p=>p.boneSystem==='skeletal').every(p=>p.neuralSystem==='nervous'));
  assert.equal(audit.pairs.filter(p=>p.boneSystem==='borrowed').length,75);
  assert.deepEqual(audit.summary.all.newlyPresentInRuntime,[]);assert.deepEqual(audit.summary.all.absentInRuntime,[]);
});
test('independent source reader covers all native positions and source spinal hierarchy',()=>{
  assert.equal(proof.auditSha256,createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
  assert.equal(proof.allNativeSourcePositionHashesMatch,true);assert.equal(proof.nativeMeshes,503);assert.equal(proof.nativeVertices,3572307);
  assert.equal(proof.records.length,503);
  for(const r of proof.records){const original=audit.records.find(p=>p.id===r.id);assert.equal(r.positionSha256,original.sourcePositionSha256);assert.equal(r.vertices,original.sourceVertices);}
  const hierarchy=audit.spinalHierarchy;assert.equal(hierarchy.rootName,'VH_F_spinal_cord');assert.equal(hierarchy.rootHasMesh,false);
  assert.equal(hierarchy.descendants.length,29);assert.ok(hierarchy.descendants.every(p=>p.parentIndex===hierarchy.rootIndex));
  const atlas=read('public/models/female/atlas-female.json');
  assert.deepEqual(hierarchy.descendants.map(p=>p.id),atlas.concepts.find(c=>c.id==='HRA:spinal_cord').elements);
});
