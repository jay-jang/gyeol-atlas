// Independent @gltf-transform reader checks the exported single-mesh asset.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {NodeIO} from '@gltf-transform/core';
const sha=b=>createHash('sha256').update(b).digest('hex');
const specBytes=fs.readFileSync('data/catalog/female-source-restoration.json'),spec=JSON.parse(specBytes);
const source=fs.readFileSync(spec.sourceFile);assert.equal(sha(source),spec.sourceSha256);
const compressed=fs.readFileSync(`public/${spec.url}`);assert.equal(sha(compressed),spec.sha256);
const data=gunzipSync(compressed);assert.equal(data.length,spec.bytes);assert.equal(compressed.length,spec.gzipBytes);
const doc=await new NodeIO().readBinary(source),record=spec.records[0];assert.equal(spec.records.length,1);
const nodes=doc.getRoot().listNodes().filter(n=>n.getName()===record.sourceName);assert.equal(nodes.length,1);
const node=nodes[0];assert.deepEqual(node.getWorldMatrix(),[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const primitives=node.getMesh().listPrimitives();assert.equal(primitives.length,1);
const p=primitives[0],positions=p.getAttribute('POSITION').getArray(),normals=p.getAttribute('NORMAL').getArray(),indices=p.getIndices().getArray();
assert.equal(positions.length,record.vertexCount*3);assert.equal(normals.length,positions.length);assert.equal(indices.length,record.indexCount);
let normalMaximumResidual=0;
for(let i=0;i<record.vertexCount;i++){
  const length=Math.hypot(...normals.subarray(i*3,i*3+3));assert.ok(length>0);
  for(let axis=0;axis<3;axis++){
    assert.equal(data.readFloatLE(record.positions+4*(i*3+axis)),Math.fround(positions[i*3+axis]+spec.translationFromSkin[axis]));
    normalMaximumResidual=Math.max(normalMaximumResidual,Math.abs(data.readFloatLE(record.normals+4*(i*3+axis))-normals[i*3+axis]/length));
  }
}
for(let i=0;i<indices.length;i++)assert.equal(data.readUInt32LE(record.indices+4*i),indices[i]);
assert.ok(normalMaximumResidual<1e-7);
const result={createdAt:new Date().toISOString(),sourceSha256:sha(source),manifestSha256:sha(specBytes),assetSha256:sha(compressed),uncompressedSha256:sha(data),
  vertices:record.vertexCount,triangles:record.indexCount/3,allPositionsEqualSourcePlusCommonShift:true,allIndicesEqualOriginalOrder:true,normalMaximumResidual,
  reader:'@gltf-transform/core NodeIO, independent of scripts/lib/official-meshes.mjs',scriptSha256:sha(fs.readFileSync('scripts/verify-hra-ilium-restoration.mjs'))};
fs.mkdirSync('.cache/hra-ilium-restoration',{recursive:true});fs.writeFileSync('.cache/hra-ilium-restoration/readback.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
