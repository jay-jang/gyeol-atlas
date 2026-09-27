import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=new URL('../docs/anatomy-alignment/',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(`bonehub-head-${name}.json`,root)));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const frame=read('frame'),audit=read('audit'),readback=read('readback'),visual=read('visual');

test('native head candidates keep proper common transforms and a held-out cervical level',()=>{
  assert.equal(frame.sourceRevision,'ac8de2b38f5ae1a0996053ca0639dd6ae43358f1');
  assert.deepEqual(frame.candidates.map(c=>c.mode),['initial','rigid','similarity']);
  assert.deepEqual(frame.candidates.map(c=>c.iterations.length),[0,62,56]);
  for(const c of frame.candidates){
    assert.equal(c.bones.length,7);assert.deepEqual(c.bones.filter(b=>!b.training).map(b=>b.sourceName),['VERTEBRA_C1']);
    assert.ok(c.bones.every(b=>b.sourceSamples===1024&&b.targetSamples===1024));
    assert.ok(c.iterations.every(i=>i.matches===6*2*819));
    const m=c.matrixColumnMajor,s=c.uniformScale;assert.ok(s>0);
    for(let a=0;a<3;a++)for(let b=0;b<3;b++)assert.ok(Math.abs([0,1,2].reduce((n,k)=>n+m[a*4+k]*m[b*4+k],0)-(a===b?s*s:0))<1e-12);
    const determinant=m[0]*(m[5]*m[10]-m[9]*m[6])-m[4]*(m[1]*m[10]-m[9]*m[2])+m[8]*(m[1]*m[6]-m[5]*m[2]);assert.ok(Math.abs(determinant-s**3)<1e-12);
  }
  assert.deepEqual(frame.candidates.slice(0,2).map(c=>c.uniformScale),[1,1]);
  assert.ok(frame.candidates[2].uniformScale>1.05&&frame.candidates[2].uniformScale<1.06);
  assert.match(frame.sampling,/equal counts but not uniform surface-area/);
});

test('skin containment is not promoted to acceptance when current neural crossings increase',()=>{
  assert.deepEqual(audit.variants.map(v=>v.summary.outside),[1828,30,0,33853]);
  assert.deepEqual(audit.variants.map(v=>v.summary.intersectingNeuralMeshes),[49,75,74,68]);
  assert.deepEqual(audit.variants.map(v=>v.summary.intersectingBrainMeshes),[35,63,58,54]);
  assert.deepEqual(audit.variants.map(v=>v.summary.cervicalCrossingPairs),[0,1,1,0]);
  assert.equal(audit.skinToleranceMm,2);
  for(const [i,v] of audit.variants.entries()){
    assert.equal(v.parts.length,i===0?18:2);assert.equal(v.neuralMeshes,362);assert.equal(v.testedNeuralPairs,v.parts.length*362);
    assert.equal(v.summary.vertices,i===0?35053:453383);
    assert.equal(v.summary.vertices,v.parts.reduce((n,p)=>n+Object.values(p.counts).reduce((a,b)=>a+b,0),0));
    assert.equal(v.summary.outside,v.parts.reduce((n,p)=>n+p.counts.outside,0));
    assert.equal(v.summary.intersectingNeuralMeshes,new Set(v.crossings.map(p=>p.neuralId)).size);
    if(i)assert.ok(v.summary.newIntersectingNeural.length>0);
  }
  assert.match(audit.status,/NOT anatomical approval/);
  assert.match(audit.limitations.join(' '),/different segmentation membership/);
});

test('independent readback separates source, transformed corners and fixed target evidence',()=>{
  assert.equal(readback.sourceChecks.length,9);assert.equal(readback.candidateChecks.length,6);
  assert.equal(readback.sourceTriangleCorners,3264504);assert.equal(readback.transformedTriangleCorners,8165088);assert.equal(readback.fixedVertices,447528);
  assert.equal(readback.sourceTriangleCorners,readback.sourceChecks.reduce((n,p)=>n+3*p.triangles,0));
  assert.equal(readback.transformedTriangleCorners,readback.candidateChecks.reduce((n,p)=>n+p.triangleCorners,0));
  assert.equal(readback.crossingWitnesses,294);assert.ok(readback.maximumWitnessResidualMetres<1e-12);
  assert.ok(readback.candidateChecks.every(p=>p.maximumCoordinateResidualMetres===0));
  assert.equal(readback.crossingWitnesses,audit.variants.reduce((n,v)=>n+v.crossings.length+v.neckCrossings.length,0));
});

test('eight fixed-camera diagnostics and exact report/script hashes remain reproducible',()=>{
  assert.equal(visual.captures.length,8);assert.deepEqual(visual.errors,[]);
  for(const c of visual.captures){
    assert.equal(c.camera.visibleHeadIds.length,c.variant==='borrowed-baseline'?18:2);
    assert.equal(hash(new URL(`bonehub-head-${c.variant}-${c.view}.png`,root)),c.sha256);
    const reference=visual.captures.find(v=>v.view===c.view);assert.deepEqual(c.camera.position,reference.camera.position);assert.deepEqual(c.camera.target,reference.camera.target);
  }
  for(const r of [frame,audit,readback,visual])for(const f of r.files){
    if(f.file.startsWith('scripts/'))assert.equal(hash(new URL(`../${f.file}`,import.meta.url)),f.sha256);
    for(const name of ['frame','audit'])if(f.file===`.cache/bonehub-head/${name}.json`)assert.equal(hash(new URL(`bonehub-head-${name}.json`,root)),f.sha256);
  }
});
