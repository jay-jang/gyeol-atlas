import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';

// Same pinned BodyParts3D 4.0 frame; this is an exact buffer/membership
// receipt, not an anatomical proof of artery-to-kidney continuity.
const read=file=>JSON.parse(fs.readFileSync(file));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const source=read('.cache/male-details/atlas.json');
const packed=read('public/models/male-detail/atlas.json');
const group=read('data/male-detail-groups.json').find(group=>group.id==='kidney');
const catalog=read('data/male-detail-structures.json');
const output=gunzipSync(fs.readFileSync('public/models/male-detail/organs.bin.gz'));
const concepts=['FMA7203','FMA9704','FMA14751','FMA70494','FMA70485','FMA70488','FMA14334'];
assert.deepEqual(group.sourceConcepts,concepts);
const expected=[...new Set(concepts.flatMap(id=>{
  const concept=source.concepts.find(concept=>concept.id===id);
  assert.ok(concept,`Missing source concept ${id}`);
  return concept.elements.map(id=>`BP4_${id}`);
}))];
assert.deepEqual(group.ids,expected);
const buffers=new Map(),rows=[];
for(const id of expected){
  const original=source.parts.find(part=>`BP4_${part.id}`===id);
  const target=packed.parts.find(part=>part.id===id);
  const item=catalog.find(item=>item.id===id);
  assert.ok(original&&target&&item,`Missing source, target or catalogue ${id}`);
  assert.equal(item.group,'kidney');
  assert.equal(item.name,original.name);
  assert.equal(item.fmaId,original.conceptId);
  assert.equal(item.layer,original.system==='urinary'?'organ':'vessel');
  assert.deepEqual(target.bounds,original.bounds);
  assert.equal(target.vertexCount,original.vertexCount);
  assert.equal(target.indexCount,original.indexCount);
  if(!buffers.has(original.chunk)){
    const filename=source.chunks[original.chunk].gzip.split('/').at(-1);
    const zipped=fs.readFileSync(`.cache/male-details/${filename}`);
    assert.equal(gunzipSync(zipped).length,source.chunks[original.chunk].bytes);
    buffers.set(original.chunk,gunzipSync(zipped));
  }
  const input=buffers.get(original.chunk),fields={};
  for(const [field,length] of [['positions',original.vertexCount*12],['normals',original.vertexCount*6],['indices',original.indexCount*4]]){
    const from=input.subarray(original[field],original[field]+length);
    const to=output.subarray(target[field],target[field]+length);
    assert.equal(to.length,length);
    assert.ok(to.equals(from),`${id} ${field} changed`);
    fields[field]=sha(to);
  }
  rows.push({id,name:original.name,conceptId:original.conceptId,system:original.system,chunk:original.chunk,
    vertices:original.vertexCount,triangles:original.indexCount/3,bounds:original.bounds,fieldSha256:fields});
}
assert.equal(rows.length,35);
assert.equal(rows.filter(row=>row.system==='urinary').length,4);
assert.equal(rows.filter(row=>row.system==='arterial').length,27);
assert.equal(rows.filter(row=>row.system==='venous').length,4);
const report={source:'https://github.com/slorksmo/Human-Atlas/tree/5bb5713aab18d7fe9380c3339eb09f173491ea06',
  version:'BodyParts3D 4.0',concepts,ids:expected,
  scope:'Exact source-to-packed positions, normals and indices, catalog identity and source hierarchy; no kidney interior, complete vascular continuity, spatial registration to the older overview or clinical anatomy approval.',
  rows};
fs.writeFileSync('docs/anatomy-alignment/male-kidney-detail-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({structures:rows.length,urinary:4,arterial:27,venous:4}));
