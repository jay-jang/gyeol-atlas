import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=new URL('../docs/anatomy-alignment/',import.meta.url);
const path=name=>new URL(`${name}.json`,root),read=name=>JSON.parse(fs.readFileSync(path(name)));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const anchors=read('brain-pose-anchors'),sample=read('brain-pose-fit'),full=read('brain-pose-full-fit');

test('reference brain trials keep the native optic chiasm and cord fixed and bound only numerical witnesses',()=>{
  assert.equal(anchors.movingIds.length,282);assert.equal(new Set(anchors.movingIds).size,282);
  assert.ok(!anchors.movingIds.includes('HRAF0070'));assert.ok(!anchors.movingIds.includes('HRAF0353'));
  assert.deepEqual(anchors.interfaces.map(p=>p.anchors.length),[11,11,2,18,2,23]);
  assert.deepEqual([...new Set(anchors.interfaces.map(p=>p.fixedId))],['HRAF0070','HRAF0353']);
  for(const pair of anchors.interfaces)for(const a of pair.anchors){
    assert.ok(a.distanceMm<=pair.minimumDistanceMm+1);
    assert.ok(Math.abs(Math.hypot(...a.point.map((v,k)=>v-a.targetPoint[k]))*1000-a.distanceMm)<1e-9);
  }
  assert.match(anchors.status,/no clinical landmarks/);
  assert.equal(sample.fullVertexObjective,false);assert.equal(sample.sampleVertices,17119);
  assert.equal(full.fullVertexObjective,true);assert.equal(full.sampleVertices,238719);
  for(const fit of [sample,full]){
    assert.deepEqual(fit.movingIds,anchors.movingIds);
    assert.equal(fit.sampleCounts.reduce((n,p)=>n+p.sampleVertices,0),fit.sampleVertices);
    assert.equal(fit.sampleCounts.reduce((n,p)=>n+p.referencedVertices,0),238719);
    assert.match(fit.objective,/not pure bone tissue/);
  }
});

test('full constrained solver failures remain recorded and recovery does not relax the fitting budgets',()=>{
  const candidate=full.candidates.find(c=>c.mode==='anchored');
  assert.equal(candidate.coupledSolvers.length,2);
  for(const s of candidate.coupledSolvers){
    assert.equal(s.success,false);assert.equal(s.status,9);assert.equal(s.iterations,150);assert.equal(s.rawSolverFeasible,false);
    const b=s.feasibilityBacktrack;assert.ok(b.parameterFraction>0&&b.parameterFraction<1);assert.equal(b.feasible,true);
    assert.ok(b.metrics.maxAnchorDisplacementMm<=2+1e-8);assert.ok(b.metrics.maxPairedDistanceIncreaseMm<=1+1e-8);
    for(let k=0;k<6;k++)assert.equal(b.parameters[k],s.parameters[k]*b.parameterFraction);
  }
  assert.ok(candidate.best.maxAnchorDisplacementMm<=2+1e-8);
  assert.ok(candidate.best.maxPairedDistanceIncreaseMm<=1+1e-8);
  assert.deepEqual(candidate.best.parameters,candidate.coupledSolvers[1].feasibilityBacktrack.parameters);
  for(const fit of [sample,full])for(const s of fit.snapshots){
    const m=s.matrixColumnMajor;
    for(let a=0;a<3;a++)for(let b=0;b<3;b++)assert.ok(Math.abs([0,1,2].reduce((n,k)=>n+m[a*4+k]*m[b*4+k],0)-(a===b?1:0))<1e-12);
    assert.ok(Math.abs(m[0]*(m[5]*m[10]-m[9]*m[6])-m[4]*(m[1]*m[10]-m[9]*m[2])+m[8]*(m[1]*m[6]-m[5]*m[2])-1)<1e-12);
    assert.equal(s.fullVertexMembership.vertices,238719);
    assert.equal(s.fullVertexMembership.nearestLabelCounts.reduce((a,b)=>a+b,0)+s.fullVertexMembership.outsideCrop,238719);
  }
});

test('all saved candidate vertices expose failures instead of promoting a lower label score to anatomical acceptance',()=>{
  for(const [prefix,outs,witnesses] of [['brain-pose',[0,543,0],344],['brain-pose-full',[0,3089,0],435]]){
    const audit=read(`${prefix}-audit`),back=read(`${prefix}-readback`);
    assert.deepEqual(audit.variants.map(v=>v.summary.outside),outs);
    for(const v of audit.variants){
      assert.equal(v.evaluatedPairs,282*27);assert.equal(v.summary.vertices,238719);
      assert.equal(v.interfaces.reduce((n,p)=>n+p.records.length,0),67);
      assert.equal(v.crossings.length,Object.values(v.groups).reduce((n,g)=>n+g.crossingPairs,0));
      assert.equal(v.groups['fixed-cervical'].crossingPairs,0);
    }
    assert.equal(back.vertices,716157);assert.equal(back.triangleCorners,4293639);
    assert.equal(back.maximumCoordinateDifferenceMetres,0);assert.equal(back.bitwiseDifferentCoordinates,0);
    assert.equal(back.witnesses,witnesses);assert.ok(back.maxWitnessResidualMetres<1e-12);
    assert.match(back.limitation,/not independently rediscovered/);
    // Saved Float32 has an explicit 0.0001mm arithmetic allowance, not a clinical margin.
    const constrained=back.checks.find(c=>c.mode==='anchored');
    assert.ok(constrained.maximumAnchorDisplacementMm<=2.0001);assert.ok(constrained.maximumPairedDistanceIncreaseMm<=1.0001);
    for(const f of back.files.filter(f=>f.file.endsWith('/fit.json')||f.file.endsWith('/audit.json')))
      assert.equal(f.sha256,hash(path(`${prefix}-${f.file.endsWith('/fit.json')?'fit':'audit'}`)));
  }
  const audit=read('brain-pose-full-audit');
  assert.deepEqual(audit.variants.map(v=>v.groups['current-borrowed-skull'].crossingPairs),[55,121,60]);
  assert.deepEqual(audit.variants.map(v=>v.groups['native-rigid-skull'].crossingPairs),[58,80,61]);
  assert.deepEqual(full.snapshots.map(s=>s.fullVertexMembership.nearestLabelCounts[2]),[0,17,0]);
});

test('nine offline pictures share cameras by view and pin scripts and copied evidence',()=>{
  const visual=read('brain-pose-full-visual');assert.equal(visual.captures.length,9);assert.deepEqual(visual.errors,[]);
  for(const view of ['head','optic','cord']){
    const captures=visual.captures.filter(c=>c.view===view);assert.equal(captures.length,3);
    for(const c of captures){
      assert.deepEqual(c.camera,captures[0].camera);
      assert.equal(c.visible.filter(p=>p.kind==='brain').length,view==='head'?282:view==='optic'?2:4);
      if(view!=='head')assert.equal(c.visible.length,5);
      assert.equal(hash(new URL(`brain-pose-full-${c.mode}-${c.view}.png`,root)),c.sha256);
    }
  }
  const names=['brain-pose-anchors',...['brain-pose','brain-pose-full'].flatMap(p=>['fit','audit','readback'].map(s=>`${p}-${s}`)),'brain-pose-full-visual'];
  for(const name of names)for(const f of read(name).files){
    if(f.file.startsWith('scripts/'))assert.equal(hash(new URL(`../${f.file}`,import.meta.url)),f.sha256);
    const match=f.file.match(/^\.cache\/(brain-pose(?:-full)?)\/(anchors|fit|audit|readback)\.json$/);
    if(match)assert.equal(hash(path(`${match[1]}-${match[2]}`)),f.sha256);
  }
});
