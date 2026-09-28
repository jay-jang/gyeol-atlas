import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const report=JSON.parse(fs.readFileSync('docs/anatomy-alignment/male-skin-source-envelope.json'));
const source=JSON.parse(fs.readFileSync('docs/anatomy-alignment/male-skin-source-topology.json'));
const manifest=JSON.parse(fs.readFileSync('public/models/manifest.json'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('largest original male skin component is not promoted to a complete body envelope',()=>{
  assert.equal(report.status,'LARGEST ORIGINAL SKIN COMPONENT SCREEN ONLY; NO BODY ENVELOPE APPROVED');
  assert.equal(report.sourceSha256,manifest.assets.find(asset=>asset.id==='FMA7163').sha256);
  assert.equal(report.sourceSha256,source.sourceSha256);
  assert.equal(report.sourceTriangles,source.sourceTriangles);
  assert.equal(report.componentCount,source.componentCount);
  assert.equal(report.largestComponentTriangles,source.largestComponentTriangles);
  assert.equal(report.largestComponentVertices,763528);
  assert.equal(report.toleranceMm,2);
  assert.equal(report.componentProbes.length,report.componentCount-1);
  assert.deepEqual(report.componentProbeCounts,{outside:253,'surface-band':191,inside:83});
  assert.equal(report.componentProbes.reduce((sum,row)=>sum+row.triangles,0),source.remainingTriangles);
  assert.ok(report.componentProbes.some(row=>row.kind==='outside'&&row.distanceMm>10));
});

test('all referenced vertices of nine pinned male organs retain their candidate-surface result',()=>{
  assert.equal(report.organProbes.length,9);
  assert.deepEqual(report.organProbes.map(row=>row.id),report.organIds);
  assert.equal(report.organProbes.reduce((sum,row)=>sum+row.referencedVertices,0),11659);
  assert.equal(report.organProbes.reduce((sum,row)=>sum+row.counts.outside,0),102);
  for(const row of report.organProbes){
    assert.equal(Object.values(row.counts).reduce((sum,count)=>sum+count,0),row.referencedVertices,row.id);
    if(row.counts.outside)assert.ok(row.worstOutside?.distanceMm>2,row.id);
    else assert.equal(row.worstOutside,null,row.id);
  }
  assert.deepEqual(report.organProbes.map(row=>[row.id,row.counts.outside]),[
    ['FMA7148',42],['FMA7197',0],['FMA7204',43],['FMA7205',4],
    ['FMA7274',0],['FMA7333',1],['FMA7370',0],['FMA15900',12],['FMA13889',0],
  ]);
});

test('original skin candidate-surface screen pins source, deployed organs and algorithm',()=>{
  for(const file of report.files)assert.equal(hash(file.path),file.sha256,file.path);
  if(fs.existsSync('.cache/models/FMA7163.stl'))assert.equal(hash('.cache/models/FMA7163.stl'),report.sourceSha256);
});
