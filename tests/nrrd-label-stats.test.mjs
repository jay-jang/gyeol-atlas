import test from 'node:test';
import assert from 'node:assert/strict';
import {labelAccumulator} from '../scripts/lib/nrrd-label-stats.mjs';
test('NRRD list axis is fastest and arbitrary chunks preserve per-label voxel coordinates',()=>{
  const labels=[{name:'a',layer:0,labelValue:1},{name:'b',layer:1,labelValue:1}],a=labelAccumulator([2,2,2,2],labels);
  const bytes=Buffer.from([1,0,0,0,0,0,0,0, 0,1,1,0,0,0,0,1]);
  for(const [start,end] of [[0,3],[3,7],[7,12],[12,16]])a.push(bytes.subarray(start,end));
  const result=a.finish();assert.equal(result.bytes,16);
  assert.deepEqual(result.rows.map(r=>({count:r.voxels,min:r.min,max:r.max})),[{count:2,min:[0,0,0],max:[1,0,1]},{count:2,min:[0,0,1],max:[1,1,1]}]);
});
test('NRRD rejects unknown values, incomplete payloads and duplicate layer/value labels',()=>{
  const label={layer:0,labelValue:1};
  assert.throws(()=>labelAccumulator([1,1,1,1],[label,label]));
  assert.throws(()=>labelAccumulator([1,1,1,1],[label]).push(Buffer.from([2])));
  assert.throws(()=>labelAccumulator([1,1,1,1],[label]).finish());
  assert.throws(()=>labelAccumulator([1,1,1,1],[label]).push(Buffer.from([1,1])));
});
