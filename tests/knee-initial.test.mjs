import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {Matrix4} from 'three';
const root='docs/anatomy-alignment/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const fit=read(`${root}knee-initial.json`),audit=read(`${root}knee-initial-audit.json`),captures=read(`${root}knee-initial-captures.json`);
const modes=['calf-common','whole-leg','knee-only','knee-balanced','knee-fixed-scale'];

test('knee initial fits retain two seeds, fixed ROI, held-out ligaments and the fixed-scale constraint',()=>{
  assert.match(fit.status,/NO RUNTIME EXPORT/);assert.equal(fit.sides.length,2);
  for(const s of fit.sides){
    assert.equal(s.fits.length,6);assert.equal(s.groups.length,7);assert.deepEqual(s.frames.map(f=>f.mode),modes);
    assert.ok(Math.abs(s.kneeBandMetres[1]-s.kneeBandMetres[0]-.14)<1e-14);
    for(const g of s.groups){assert.equal(g.indices.length,400);assert.equal(new Set(g.indices).size,400);assert.ok(g.eligible>=400);}
    const scale=Math.cbrt(new Matrix4().fromArray(s.selectionFrame).determinant());
    for(const f of s.fits){
      assert.equal(f.termination,'rms-delta');assert.equal(f.samples,f.mode==='knee-balanced'?2800:1600);assert.ok(f.historyMm.length<=160);
      for(let i=1;i<f.historyMm.length;i++)assert.ok(f.historyMm[i]<=f.historyMm[i-1]+1e-7);
      if(f.mode==='knee-fixed-scale')assert.ok(Math.abs(f.scale-scale)<1e-12);
    }
    for(const mode of modes.slice(2)){
      const best=s.fits.filter(f=>f.mode===mode).toSorted((a,b)=>a.finalRmsMm-b.finalRmsMm)[0];assert.deepEqual(s.frames.find(f=>f.mode===mode).matrix,best.matrix);
    }
    for(const frame of s.frames){assert.deepEqual(frame.bones.map(b=>b.targetIds.length),[16,1,1,1]);assert.deepEqual(frame.ligaments.map(l=>l.name),['ACL','PCL','MCL','LCL']);}
  }
});

test('all fifty original muscles keep paired-point skin regressions distinct from runtime cross-counts',()=>{
  const expected=[[6676,2282,115,12],[6963,3893,138,51],[21027,14042,137,65],[9426,5779,132,53],[10789,6292,113,37]];
  assert.deepEqual(fit.evaluations.map(e=>e.mode),modes);
  fit.evaluations.forEach((e,i)=>{
    assert.equal(e.muscles.length,50);assert.equal(e.summary.vertices,402434);assert.equal(e.summary.uniquePairs,59725);
    assert.equal(e.summary.currentPairs,152);assert.equal(e.summary.legacyPairs,133);assert.equal(e.summary.legacyOutside,16657);
    assert.deepEqual([e.summary.afterOutside,e.summary.newOutside,e.summary.afterPairs,e.summary.newCurrentPairs],expected[i]);
    for(const side of ['left','right']){
      const rows=e.muscles.filter(m=>m.side===side);assert.equal(rows.length,25);
      if(e.mode!=='calf-common')for(const m of rows)assert.deepEqual(m.matrix,rows[0].matrix);
    }
    assert.equal(e.relations.filter(r=>r.after).length,e.summary.afterPairs);
    assert.equal(e.relations.filter(r=>!r.current&&r.after).length,e.summary.newCurrentPairs);
    assert.equal(e.relations.filter(r=>!r.legacy&&r.after).length,e.summary.newLegacyPairs);
  });
});

test('shared-side placement restores source pair sets but never approves fixed surrounding tissues',()=>{
  for(const e of fit.evaluations){
    assert.equal(e.relations.filter(r=>r.sourceSameSide===true).length,29);
    assert.equal(e.relations.filter(r=>r.sourceSameSide===true&&!r.after).length,0);
    const introduced=e.relations.filter(r=>r.sourceSameSide===false&&r.after);
    assert.equal(introduced.length,e.mode==='calf-common'?4:0);
    assert.ok(e.summary.newCurrentByOtherLayer.bone>0);
    if(e.mode!=='calf-common')assert.ok(e.summary.newCurrentByOtherLayer.muscle>0);
  }
  assert.equal(audit.evaluations.reduce((n,e)=>n+e.vertices,0),2012170);
  assert.equal(audit.evaluations.reduce((n,e)=>n+e.indexReferences,0),12070020);
  assert.equal(audit.evaluations.reduce((n,e)=>n+e.witnesses.length,0),218);
  for(const e of audit.evaluations){assert.ok(e.maximumRoundTripMetres<1e-7);assert.ok(e.maximumSimilarityMetricResidual<1e-12);for(const w of e.witnesses){assert.ok(w.triangleA>=0&&w.triangleB>=0);assert.ok(w.maximumCoordinateResidualMetres<1e-12);}}
  assert.equal(audit.targetResolutionInventory.metadataOnly,true);
  const counts=audit.targetResolutionInventory.bones.map(b=>[b.members.reduce((n,m)=>n+m.sourceVertexCount,0),b.members.reduce((n,m)=>n+m.packedVertexCount,0)]);
  assert.deepEqual(counts,[[5529,1997],[209,204],[1747,385],[607,169],[5529,1996],[209,204],[1747,385],[607,168]]);
});

test('knee experiment evidence and ten fixed-camera diagnostics retain reproducible provenance',()=>{
  for(const report of [fit,audit])for(const f of report.files.filter(f=>!f.file.startsWith('.cache/')))assert.equal(sha(f.file),f.sha256,f.file);
  assert.equal(audit.reportSha256,sha(`${root}knee-initial.json`));assert.equal(captures.reportSha256,sha(`${root}knee-initial.json`));assert.equal(captures.auditSha256,sha(`${root}knee-initial-audit.json`));assert.equal(captures.scriptSha256,sha('scripts/capture-knee-initial.mjs'));
  assert.deepEqual(captures.errors,[]);assert.equal(captures.captures.length,10);
  for(const side of ['left','right']){
    const rows=captures.captures.filter(c=>c.side===side);assert.deepEqual(rows.map(c=>c.mode),modes);
    for(const r of rows){assert.equal(r.ids.length,58);assert.deepEqual(r.ids,rows[0].ids);assert.deepEqual(r.cameraPosition,rows[0].cameraPosition);assert.deepEqual(r.target,rows[0].target);assert.equal(r.extent,rows[0].extent);assert.equal(sha(`${root}${r.file}`),r.sha256);}
  }
});
