import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Vector3} from 'three';
import {surfaceFrameField} from '../scripts/lib/surface-frame-field.mjs';

test('Gaussian surface weighting does not enforce the own frame even directly on an anchor surface',()=>{
  const field=surfaceFrameField([
    {matrix:new Matrix4(),nearest:p=>({point:new Vector3(0,p.y,p.z)})},
    {matrix:new Matrix4().makeTranslation(.01,0,0),nearest:p=>({point:new Vector3(.01,p.y,p.z)})},
  ],.02,'gaussian');
  const result=field(new Vector3());
  const otherWeight=Math.exp(-(.01**2)/(2*.02**2));
  assert.ok(Math.abs(result.point.x-.01*otherWeight/(1+otherWeight))<1e-15);
  assert.ok(result.point.x>.004,'An anchor point can drift by millimetres despite zero own-surface distance');
});

test('full bone diagnostic preserves scope, own-frame comparison and failed-candidate status',()=>{
  const r=JSON.parse(fs.readFileSync('docs/anatomy-alignment/continuous-bone-constraints.json'));
  assert.equal(r.rows.length,10);assert.equal(r.summary.bones,10);
  assert.equal(r.summary.sourceVertices,275221);
  assert.equal(r.summary.sourceVertices,r.rows.reduce((n,row)=>n+row.sourceVertices,0));
  assert.match(r.status,/DIAGNOSTIC ONLY/);
  assert.ok(r.reproducedMuscleWitnesses>0);
  assert.ok(r.summary.maximumFrameDisplacementMm>6&&r.summary.maximumFrameDisplacementMm<7);
  assert.equal(r.summary.worsenedForwardP95,6);assert.equal(r.summary.worsenedReverseP95,3);
  for(const side of ['left','right'])assert.deepEqual(r.rows.filter(row=>row.side===side).map(row=>row.name),['Pelvis','Femur','Patella','Tibia','Fibula']);
  for(const row of r.rows){
    assert.equal(row.displacementFromOwnFrame.vertices,row.sourceVertices);
    assert.equal(row.ownFrame.sourceToTarget.vertices,row.sourceVertices);
    assert.equal(row.blendedField.sourceToTarget.vertices,row.sourceVertices);
    assert.equal(row.ownFrame.targetToSource.vertices,row.blendedField.targetToSource.vertices);
    assert.equal(row.targetIds.length,row.name==='Pelvis'?6:row.name==='Femur'?16:1);
    const w=row.displacementFromOwnFrame.maximumWitness;
    assert.ok(Math.abs(new Vector3(...w.ownFramePointMetres).distanceTo(new Vector3(...w.fieldPointMetres))*1000-w.distanceMm)<1e-10);
    assert.ok(Math.abs(w.weights.reduce((n,x)=>n+x,0)-1)<1e-12);
    assert.equal(w.weights.length,3);
  }
});
