import test from 'node:test';
import assert from 'node:assert/strict';
import {asciiStlSummary,worksheetRows} from '../scripts/audit-donor-original.mjs';

const triangle=['solid sample','facet normal 0 0 1','outer loop','vertex -2 3 4','vertex 1e1 0 4','vertex 0 -1 4','endloop','endfacet','endsolid sample'];
test('raw ASCII source summary preserves source coordinates and validates triangle structure',async()=>{
  const r=await asciiStlSummary(triangle);assert.equal(r.triangles,1);assert.equal(r.triangleVertexOccurrences,3);
  assert.deepEqual(r.boundsSourceMillimetres,[[-2,-1,4],[10,3,4]]);
  assert.deepEqual(r.extentMillimetres,[12,4,0]);
  await assert.rejects(asciiStlSummary(triangle.slice(0,-1)));
  await assert.rejects(asciiStlSummary(triangle.filter(s=>s!=='vertex 0 -1 4')));
  await assert.rejects(asciiStlSummary(triangle.map(s=>s.replace('1e1','NaN'))));
});
test('metadata reader retains cell addresses and sentinel values without interpreting them as measurements',()=>{
  const strings='<sst><si><t>A &amp; B</t></si></sst>';
  const sheet='<worksheet><row r="2"><c r="A2" t="s"><v>0</v></c><c r="C2"><v>1000</v></c><c r="D2"/></row></worksheet>';
  assert.deepEqual(worksheetRows(strings,sheet),[{row:2,cells:{A:'A & B',C:1000}}]);
  assert.throws(()=>worksheetRows(strings,sheet.replace('<v>0</v>','<v>9</v>')));
  assert.throws(()=>worksheetRows(strings,sheet.replace('<v>1000</v>','<f>1+2</f><v>3</v>')));
});
