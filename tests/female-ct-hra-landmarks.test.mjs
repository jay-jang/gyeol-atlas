import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Matrix4,Vector3} from 'three';
import {fitRigid} from '../scripts/lib/rigid-fit.mjs';
import {fitSimilarity} from '../scripts/lib/similarity-fit.mjs';

const report=JSON.parse(fs.readFileSync('docs/anatomy-alignment/female-ct-hra-landmarks.json'));
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);

test('female CT/HRA landmark screen pins the actual source files and five different-person organ pairs',()=>{
  assert.deepEqual(report.rows.map(row=>row.organ),['liver','kidney-left','kidney-right','pancreas','spleen']);
  assert.deepEqual(report.rows.map(row=>row.ct.id),['CTF_liver','CTF_kidney_left','CTF_kidney_right','CTF_pancreas','CTF_spleen']);
  assert.deepEqual(report.rows.map(row=>row.hra.ids.length),[1,1,1,4,5]);
  assert.match(report.scope,/not accepted anatomy or runtime overlay/);
  for(const file of report.files)assert.equal(createHash('sha256').update(fs.readFileSync(file.path)).digest('hex'),file.sha256,file.path);
  for(const row of report.rows){
    for(const [source,key] of [[row.ct,'ctCenter'],[row.hra,'hraCenter']]){
      assert.ok(source.vertexCount>0&&source.surfaceAreaM2>0);
      for(let axis=0;axis<3;axis++)near(row[key][axis],(source.bounds[0][axis]+source.bounds[1][axis])/2);
    }
    for(const key of ['ctSurfaceCentroid','hraSurfaceCentroid'])assert.ok(row[key].every(Number.isFinite));
  }
});

test('held-out rigid and similarity errors are independently replayed; nearby stomach AABB is not accepted',()=>{
  assert.deepEqual(report.fits.map(fit=>[fit.metric,fit.mode]),[
    ['aabb-center','rigid'],['aabb-center','similarity'],['surface-centroid','rigid'],['surface-centroid','similarity']]);
  for(const fit of report.fits){
    const from=report.rows.map(row=>new Vector3(...row[fit.metric==='aabb-center'?'ctCenter':'ctSurfaceCentroid']));
    const onto=report.rows.map(row=>new Vector3(...row[fit.metric==='aabb-center'?'hraCenter':'hraSurfaceCentroid']));
    const solver=fit.mode==='rigid'?fitRigid:fitSimilarity;
    const matrix=new Matrix4().fromArray(fit.matrix);
    near(Math.cbrt(matrix.determinant()),fit.scale);
    for(let i=0;i<report.rows.length;i++){
      near(from[i].clone().applyMatrix4(matrix).distanceTo(onto[i])*1000,fit.training[i].errorMm);
      const held=solver(from.filter((_,j)=>j!==i),onto.filter((_,j)=>j!==i));
      near(from[i].clone().applyMatrix4(held).distanceTo(onto[i])*1000,fit.heldOut[i].errorMm);
      assert.ok(fit.heldOut[i].errorMm>25,`${fit.metric}/${fit.mode}/${fit.heldOut[i].organ}`);
    }
    assert.equal(fit.stomachCandidate.id,'CTF_stomach');
    assert.equal(fit.stomachCandidate.gastricImpressionAabbOverlap,true);
  }
});
