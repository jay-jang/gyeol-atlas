import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const report=JSON.parse(fs.readFileSync('docs/anatomy-alignment/male-skin-source-topology.json'));
const manifest=JSON.parse(fs.readFileSync('public/models/manifest.json'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('pinned original male skin is closed, while deployed simplification is nonmanifold',()=>{
  const source=manifest.assets.find(asset=>asset.id==='FMA7163');
  assert.ok(source);
  assert.equal(report.status,'SOURCE STL TOPOLOGY ONLY; NO MALE OUTER ENVELOPE APPROVED');
  assert.equal(report.sourceSha256,source.sha256);
  assert.equal(report.sourceTriangles,source.originalTriangles);
  assert.deepEqual([report.sourceTriangles,report.sourceWeldedVertices,report.componentCount],[1586498,791729,528]);
  assert.deepEqual([report.largestComponentTriangles,report.remainingTriangles],[1532176,54322]);
  assert.equal(report.componentTriangleCounts.reduce((sum,count)=>sum+count,0),report.sourceTriangles);
  assert.deepEqual(report.wholeEdges,{edges:2379747,incidence:{'2':2379747},boundaryEdges:0,nonManifoldEdges:0});
  assert.deepEqual(report.largestEdges,{edges:2298264,incidence:{'2':2298264},boundaryEdges:0,nonManifoldEdges:0});
  assert.equal(report.transformedFloat32Vertices,report.sourceWeldedVertices);
  assert.deepEqual(report.transformedEdges,report.wholeEdges);
  assert.deepEqual([
    report.simplified.deployedPrune.triangles,
    report.simplified.deployedPrune.components,
    report.simplified.deployedPrune.weldedVertices,
    report.simplified.deployedPrune.edges.nonManifoldEdges,
  ],[82754,106,39577,700]);
  assert.equal(report.simplified.deployedPrune.edges.boundaryEdges,0);
  assert.ok(Math.abs(report.simplified.deployedPrune.error-source.simplificationError)<1e-9);
  // Before the finer hands and feet: one simplification pass over the whole skin.
  assert.deepEqual([
    report.simplified.singlePassPrune.triangles,
    report.simplified.singlePassPrune.components,
    report.simplified.singlePassPrune.weldedVertices,
    report.simplified.singlePassPrune.edges.nonManifoldEdges,
  ],[44970,86,20749,834]);
  assert.equal(report.simplified.withoutPrune.edges.nonManifoldEdges,836);
  for(const target of ['target100k','target250k','target500k','target1000k']){
    assert.equal(report.simplified[target].edges.boundaryEdges,0);
    assert.ok(report.simplified[target].edges.nonManifoldEdges>0,target);
  }
});

test('original skin topology diagnostic pins its input and audit code',()=>{
  for(const file of report.files)assert.equal(hash(file.path),file.sha256,file.path);
  if(fs.existsSync(report.sourceFile))assert.equal(hash(report.sourceFile),report.sourceSha256);
});
