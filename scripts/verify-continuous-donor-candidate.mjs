// Independent binary readback. This verifies serialization, not anatomy.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p));
const packing=read('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative;
const compressed=fs.readFileSync('.cache/donor-fidelity/source-full.bin.gz');assert.equal(hash(compressed),packing.sha256);
const original=gunzipSync(compressed);
const reports=process.argv.slice(2);assert.ok(reports.length,'Pass one or more candidate JSON reports');
for(const file of reports){
  const report=read(file),bytes=fs.readFileSync(report.binary.path);assert.equal(hash(bytes),report.binary.sha256);
  const candidate=gunzipSync(bytes);assert.equal(candidate.length,original.length);assert.equal(candidate.length,report.binary.bytes);
  assert.equal(report.binary.gzipBytes,bytes.length);assert.deepEqual(report.binary.parts,packing.parts);
  assert.equal(report.rows.length,76);assert.equal(new Set(report.rows.map(r=>r.id)).size,76);
  let cursor=0,triangles=0,vertices=0;
  for(const p of packing.parts){
    assert.equal(p.positions,cursor);assert.equal(p.indices,p.positions+p.vertexCount*12);
    for(let i=0;i<p.vertexCount*3;i++)assert.ok(Number.isFinite(candidate.readFloatLE(p.positions+4*i)));
    const end=p.indices+p.indexCount*4;assert.ok(candidate.subarray(p.indices,end).equals(original.subarray(p.indices,end)),'Triangle indices or winding changed');
    const row=report.rows.find(r=>r.id===p.id);assert.equal(row.vertices,p.vertexCount);
    for(const key of ['skinBefore','skinAfter'])assert.equal(['inside','outside','surface-band','ambiguous'].reduce((s,k)=>s+row[key][k],0),p.vertexCount);
    assert.equal(row.skinAfter.outside-row.skinBefore.outside,row.newOutside-row.resolvedOutside);
    if(row.maximumOutsideWitness){
      const w=row.maximumOutsideWitness;assert.ok(w.vertex>=0&&w.vertex<p.vertexCount);
      for(let axis=0;axis<3;axis++){
        assert.equal(original.readFloatLE(p.positions+(w.vertex*3+axis)*4),w.sourcePointMetres[axis]);
        assert.equal(candidate.readFloatLE(p.positions+(w.vertex*3+axis)*4),w.candidatePointMetres[axis]);
      }
    }
    triangles+=p.indexCount/3;vertices+=p.vertexCount;cursor=end;
  }
  assert.equal(cursor,candidate.length);assert.equal(triangles,packing.triangles);assert.equal(vertices,report.summary.vertices);
  const result={candidateReport:file,candidateReportSha256:hash(fs.readFileSync(file)),candidateSha256:hash(bytes),meshes:76,vertices,triangles,allCoordinatesFinite:true,allTriangleIndicesAndWindingUnchanged:true,allMaximumOutsideWitnessesMatchBinary:true,scope:'Serialization only; not registration, clinical validity or a global no-fold proof'};
  fs.writeFileSync(file.replace(/\.json$/,'.readback.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
