import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const report=JSON.parse(await readFile(new URL('../docs/anatomy-alignment/nlm-female-head-mri.json',import.meta.url)));

test('NLM female head MRI receipt retains a complete, ordered native scan series',()=>{
  assert.equal(report.rows.length,33);
  assert.equal(report.files,66);
  assert.equal(report.sourceDescription.includes('no segmentation or CT/HRA registration'),true);
  assert.deepEqual(report.nativeGeometry,{pixels:[256,256],pixelSpacingMm:[.859375,.859375],sliceThicknessMm:4,
    sliceCenterStepMm:5,superiorCentersMm:[69.3,-90.7],normalRas:[0,0,1]});
  assert.equal(report.totalFileBytes,report.rows.reduce((sum,row)=>sum+row.image.bytes+row.header.bytes,0));
  assert.deepEqual(report.rows.map(row=>row.scan),Array.from({length:33},(_,i)=>1014+5*i));
  assert.deepEqual(report.rows.map(row=>row.imageNumber),Array.from({length:33},(_,i)=>33-i));
  assert.deepEqual(report.rows.map(row=>row.imageLocationMm),Array.from({length:33},(_,i)=>Number((69.3-5*i).toFixed(1))));
  assert.deepEqual(report.labelAnomalies,[{scan:1174,raw:'Iö'}]);
  for(const row of report.rows){
    assert.equal(row.imageLocationMm,row.centerRasMm[2]);
    assert.equal(row.image.file,`mvf${row.scan}1.png`);
    assert.equal(row.header.file,`m_vf${row.scan}.t1.txt`);
    assert.equal(row.image.width,256);assert.equal(row.image.height,256);
    assert.match(row.image.sha256,/^[0-9a-f]{64}$/);
    assert.match(row.header.sha256,/^[0-9a-f]{64}$/);
  }
});
