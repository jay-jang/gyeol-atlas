import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const report=JSON.parse(fs.readFileSync('docs/anatomy-alignment/male-skin-components.json'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('male skin does not become an approved outer envelope by selecting its largest component',()=>{
  assert.equal(report.status,'MALE SKIN COMPONENT SCREEN; NO OUTER ENVELOPE APPROVED');
  assert.equal(report.sourceNode,'FMA7163');
  assert.equal(report.triangles,82754);
  assert.equal(report.componentCount,106);
  assert.equal(report.components.length,106);
  assert.equal(report.components.reduce((n,c)=>n+c.triangles,0),report.triangles);
  assert.deepEqual([report.wholeTopology.boundaryEdges,report.wholeTopology.nonManifoldEdges],[0,700]);
  const main=report.components[0];
  assert.deepEqual([main.triangles,main.vertices,main.topology.connectedComponents],[81458,38714,1]);
  assert.deepEqual([main.topology.boundaryEdges,main.topology.nonManifoldEdges],[0,626]);
  assert.deepEqual(main.edgeIncidence,{'2':120929,'4':620,'6':6});
  assert.deepEqual([main.exactDuplicateTriangles,main.duplicateTriangleGroups],[252,246]);
  assert.deepEqual([main.deduplicatedTopology.boundaryEdges,main.deduplicatedTopology.nonManifoldEdges],[353,565]);
  assert.ok(main.topology.nonManifoldEdges>0&&main.deduplicatedTopology.nonManifoldEdges>0);
});

test('male skin component diagnostic pins its actual deployed GLB and algorithm',()=>{
  for(const file of report.files)assert.equal(hash(file.path),file.sha256,file.path);
});
