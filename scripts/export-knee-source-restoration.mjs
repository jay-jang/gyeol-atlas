// Explicit export of the already audited, unmodified official target surfaces.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p));
assert.deepEqual(process.argv.slice(2),['--export']);
const root='.cache/knee-target-resolution',reportBytes=read(`${root}/report.json`),report=JSON.parse(reportBytes),proof=json(`${root}/readback.json`);
assert.equal(proof.reportSha256,sha(reportBytes));assert.equal(proof.sourceSha256,report.sourceSha256);assert.equal(proof.binarySha256,report.binary.sha256);
for(const f of report.files)assert.equal(sha(read(f.file)),f.sha256,f.file);
assert.equal(report.binary.records.length,38);assert.equal(report.runtimeSummary.newPairs,0);
for(const p of report.parts){assert.equal(p.skinOriginal.outside,0);assert.equal(p.skinOriginal.ambiguous,0);}
const atlasFile='public/models/female/atlas-female.json',atlas=json(atlasFile);
const manifest={version:'hra-female-knee-source-1',sourceFile:report.sourceFile,sourceSha256:report.sourceSha256,translationFromSkin:report.translationFromSkin,
  baselineAtlasSha256:sha(read(atlasFile)),url:'models/female-source-restoration/knee-native.bin.gz',bytes:report.binary.bytes,gzipBytes:report.binary.gzipBytes,sha256:report.binary.sha256,
  auditReportSha256:sha(reportBytes),records:report.binary.records.map(r=>{const p=atlas.parts.find(p=>p.id===r.id);assert.equal(p.system,r.system);return {id:r.id,system:r.system,sourceName:r.sourceName,sourceNodeIndex:r.nodeIndex,originalVertexCount:p.vertexCount,originalIndexCount:p.indexCount,vertexCount:r.vertexCount,indexCount:r.indexCount,positions:r.positions,normals:r.normals,indices:r.indices};})};
const compressed=read(report.binary.path);assert.equal(sha(compressed),manifest.sha256);
fs.mkdirSync('public/models/female-source-restoration',{recursive:true});fs.writeFileSync(`public/${manifest.url}`,compressed);fs.writeFileSync('data/catalog/female-knee-source-restoration.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({version:manifest.version,parts:manifest.records.length,gzipBytes:manifest.gzipBytes,sha256:manifest.sha256}));
