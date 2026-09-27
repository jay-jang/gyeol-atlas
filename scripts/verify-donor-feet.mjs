// Independent binary STL reader and scalar matrix arithmetic, no STLLoader or
// component helper. Rechecks all serialized candidate triangle occurrences.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=process.argv[2];assert.ok(root);
const out='.cache/donor-feet',sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const audit=JSON.parse(fs.readFileSync(`${out}/audit.json`));
for(const f of audit.files)assert.equal(sha(f.file),f.sha256,f.file);
const visual=JSON.parse(fs.readFileSync(audit.visual.file)),records=[];
let totalCorners=0,maximumResidualMetres=0;
for(const part of visual.filter(p=>p.kind==='donor')){
  const source=audit.inventory.find(p=>p.side===part.side&&p.structure===part.structure);
  const b=fs.readFileSync(path.join(root,source.file));
  const triangles=b.readUInt32LE(80);assert.equal(b.length,84+50*triangles,'Only exact-length binary STL supported');assert.equal(triangles,source.triangles);
  const matrix=audit.candidates.find(c=>c.side===part.side&&c.mode===part.mode).sourceToAtlasMatrix;
  assert.equal(part.indices.length,triangles*3);assert.equal(part.positions.length,source.vertices*3);
  for(let triangle=0;triangle<triangles;triangle++)for(let corner=0;corner<3;corner++){
    const raw=[0,1,2].map(axis=>Math.fround(b.readFloatLE(84+50*triangle+12+12*corner+4*axis)*.001));
    const index=part.indices[3*triangle+corner];assert.ok(Number.isInteger(index)&&index>=0&&index<source.vertices);
    for(let axis=0;axis<3;axis++){
      const expected=Math.fround(matrix[axis]*raw[0]+matrix[4+axis]*raw[1]+matrix[8+axis]*raw[2]+matrix[12+axis]);
      const actual=part.positions[3*index+axis],residual=Math.abs(expected-actual);maximumResidualMetres=Math.max(maximumResidualMetres,residual);
      assert.equal(actual,expected,`${part.side}/${part.mode}/${part.structure}/${triangle}/${corner}/${axis}`);
    }
    totalCorners++;
  }
  const bounds=[0,1].map(end=>[0,1,2].map(axis=>{
    let value=end?-Infinity:Infinity;for(let i=axis;i<part.positions.length;i+=3)value=end?Math.max(value,part.positions[i]):Math.min(value,part.positions[i]);return value;
  }));
  assert.deepEqual(bounds,audit.candidates.find(c=>c.side===part.side&&c.mode===part.mode).parts.find(p=>p.structure===part.structure).boundsMetres);
  records.push({side:part.side,mode:part.mode,structure:part.structure,triangles,sourceSha256:source.sha256});
}
assert.equal(records.length,48);
const result={status:'Candidate STL/transform/triangle serialization verified; all placement candidates remain rejected',
  totalTriangleCornerOccurrences:totalCorners,maximumResidualMetres,records,
  limitations:['Independent source parsing and coordinate arithmetic, not independent containment or intersection algorithms.',
    'Does not validate clinical anatomy, connected-component labels, cartilage gaps or soft-tissue attachment.'],
  files:[`${out}/audit.json`,audit.visual.file,'scripts/verify-donor-feet.mjs'].map(file=>({file,sha256:sha(file)}))};
fs.writeFileSync(`${out}/readback.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,records:undefined},null,2));
