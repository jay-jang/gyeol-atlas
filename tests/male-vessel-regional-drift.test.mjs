import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Matrix4,Vector3} from 'three';

const path='docs/anatomy-alignment/male-vessel-surfaces.json';
const source=JSON.parse(fs.readFileSync(path));
const audit=JSON.parse(fs.readFileSync('docs/anatomy-alignment/male-vessel-regional-drift.json'));
const sha256=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-7,`${label}: ${actual} vs ${expected}`);
const regions=['head-neck','thorax','abdomen','pelvis-leg'];
const regionOf=y=>y>=1.35?'head-neck':y>=1.18?'thorax':y>=.92?'abdomen':'pelvis-leg';

test('regional vessel screen pins its actual surface evidence and read-only algorithms',()=>{
  assert.equal(audit.sourceReport.sha256,sha256(path));
  assert.deepEqual(audit.sourceReport.sourceFiles,source.files);
  for(const [file,hash] of Object.entries(source.files))assert.equal(sha256(file),hash,file);
  for(const {path:file,sha256:hash} of audit.files)assert.equal(sha256(file),hash,file);
  assert.equal(audit.rows.length,39);
  assert.deepEqual(audit.rows.map(row=>row.name),source.rows.map(row=>row.name));
  for(let i=0;i<source.rows.length;i++){
    const original=source.rows[i],row=audit.rows[i];
    assert.equal(row.region,regionOf(original.targetBounds.center[1]));
    assert.deepEqual(row.sourceCenter,original.sourceBounds.center);
    assert.deepEqual(row.targetCenter,original.targetBounds.center);
    close(row.centerResidualMm,original.centerResidualMm,row.name);
    close(row.sourceToTargetP95Mm,original.sourceToTarget.p95Mm,row.name);
    close(row.targetToSourceP95Mm,original.targetToSource.p95Mm,row.name);
  }
  assert.deepEqual(audit.summary.map(row=>[row.region,row.count]),
    [['head-neck',8],['thorax',8],['abdomen',15],['pelvis-leg',8]]);
  assert.deepEqual(audit.thoraxTrainingNames,audit.rows.filter(row=>row.region==='thorax').map(row=>row.name));
});

test('regional statistics and chest-trained candidates are arithmetic screens, not surface corrections',()=>{
  const keys=[['centerResidual','centerResidualMm'],['sourceToTargetP95','sourceToTargetP95Mm'],['targetToSourceP95','targetToSourceP95Mm']];
  for(const {region,count,...stats} of audit.summary){
    const group=audit.rows.filter(row=>row.region===region);
    assert.equal(group.length,count);
    for(const [label,key] of keys){
      const values=group.map(row=>row[key]).sort((a,b)=>a-b);
      close(stats[label].minimumMm,values[0],`${region}/${label}/minimum`);
      close(stats[label].medianMm,values[Math.floor((count-1)/2)],`${region}/${label}/median`);
      close(stats[label].maximumMm,values.at(-1),`${region}/${label}/maximum`);
    }
  }
  assert.deepEqual(audit.fits.map(fit=>fit.mode),['translation','rigid','similarity']);
  for(const fit of audit.fits){
    const matrix=new Matrix4().fromArray(fit.matrix);
    close(fit.scale,Math.cbrt(matrix.determinant()),`${fit.mode}/scale`);
    assert.equal(fit.measures.length,39);
    for(let i=0;i<fit.measures.length;i++){
      const row=audit.rows[i],measure=fit.measures[i];
      assert.equal(measure.name,row.name);
      assert.equal(measure.region,row.region);
      close(measure.previousMm,row.centerResidualMm,`${row.name}/previous`);
      const candidate=new Vector3(...row.sourceCenter).applyMatrix4(matrix);
      close(measure.candidateMm,candidate.distanceTo(new Vector3(...row.targetCenter))*1000,`${row.name}/candidate`);
      close(measure.changeMm,measure.candidateMm-measure.previousMm,`${row.name}/change`);
    }
    for(const region of regions){
      const group=fit.measures.filter(row=>row.region===region);
      const stats=fit.regionSummary.find(row=>row.region===region);
      assert.equal(stats.count,group.length);
      close(stats.previousMeanMm,group.reduce((sum,row)=>sum+row.previousMm,0)/group.length,`${fit.mode}/${region}/previous`);
      close(stats.candidateMeanMm,group.reduce((sum,row)=>sum+row.candidateMm,0)/group.length,`${fit.mode}/${region}/candidate`);
      assert.equal(stats.worsenedCount,group.filter(row=>row.changeMm>1e-8).length);
      close(stats.maximumWorseningMm,Math.max(0,...group.map(row=>row.changeMm)),`${fit.mode}/${region}/worst`);
    }
    assert.ok(fit.regionSummary.some(row=>row.worsenedCount>0),`${fit.mode} must retain worsened pairs`);
    assert.ok(fit.regionSummary.find(row=>row.region==='abdomen').candidateMeanMm>20);
  }
});
