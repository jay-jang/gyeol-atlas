import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root='docs/anatomy-alignment/',read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const r=json(root+'lumbar-source-frames.json'),a=json(root+'lumbar-source-frames-readback.json'),c=json(root+'lumbar-source-frames-captures.json');
test('lumbar audit retains official decoder evidence and two held-out labelled vertebrae',()=>{
  assert.match(r.status,/NO RUNTIME EXPORT/);assert.equal(r.parts.length,6);assert.deepEqual(r.parts.filter(p=>p.training).map(p=>p.name),['VERTEBRA_L2','VERTEBRA_L3','VERTEBRA_L4','VERTEBRA_L5']);
  assert.deepEqual(r.decoderCheck,{meshes:6,positionScalars:164262,indexReferences:328380,differences:0});
  assert.equal(r.parts.reduce((s,p)=>s+p.sourceVertices,0),195990);assert.equal(r.parts.reduce((s,p)=>s+p.sourceIndices,0),1175940);
  assert.ok(r.parts.every(p=>p.sourceComponents.length===1&&p.resolution.runtimeToOfficial.maximumMm===0&&p.resolution.officialToRuntime.maximumMm<.278));
  assert.equal(r.frames.length,8);for(const f of r.frames.filter(f=>f.fit)){assert.equal(f.fit.termination,'maximum-sample-change-threshold');assert.ok(f.fit.history.every(h=>h.correspondences===3272));assert.ok(f.fit.history.at(-1).maximumSampleChangeMm<.00001);assert.equal(f.bones.filter(b=>!b.training).length,2);assert.ok(f.bones.filter(b=>!b.training).every(b=>b.reverse.p95Mm>4));}
});
test('implied source frame separation is not an extra runtime spine or an anatomical attachment measurement',()=>{
  const legacy=r.impliedSideDifferences.find(f=>f.family==='legacy-hip');assert.equal(legacy.bones.length,6);assert.ok(legacy.bones.every(b=>b.centreSeparationMm>36.36&&b.centreSeparationMm<36.41));
  assert.ok(r.limitations.some(s=>s.includes('not duplicated spine meshes')));
  for(const stage of ['final','original']){const original=json(root+`bonehub-denver-${stage}-frame.json`).matrixColumnMajor;assert.deepEqual(r.denverMatrices[stage],original.map((v,i)=>[12,13,14].includes(i)?v*.001:v));}
  assert.ok(a.candidates.every(c=>c.compositionError<1e-12&&c.maximumGramError<1e-12&&c.determinant>0));assert.ok(a.candidates[0].scale<.996&&a.candidates[0].scale>.995);assert.ok(a.candidates[1].scale<1&&a.candidates[1].scale>.999);
});
test('skin-contained psoas candidates retain all new geometric crossings and are not approved',()=>{
  for(const [i,p] of r.psoasCandidates.entries()){
    assert.deepEqual(p.summary,{meshes:2,vertices:18728,examinedPairs:2437,legacyOutside:0,afterOutside:0,newOutside:0,worsenedOutside:0,currentPairs:23,legacyPairs:23,afterPairs:i?26:24,newAgainst_current:i?25:23,newAgainst_legacy:i?25:23});
    const added=p.relations.filter(p=>p.after&&!p.legacy),counts={};for(const pair of added){const key=pair.layers.slice().sort().join('/');counts[key]=(counts[key]||0)+1;assert.ok(pair.interiorWitness);}
    assert.deepEqual(counts,{'muscle/vessel':2,'bone/muscle':i?19:18,'muscle/muscle':i?4:3});assert.equal(p.relations.filter(p=>p.legacy&&!p.after).length,22);
    assert.ok(p.muscles.every(m=>m.legacy.ambiguous===0&&m.after.ambiguous===0&&m.sourceFrameSensitivity.maximumMm<.395));
    const organ=p.relations.filter(p=>p.layers.includes('organ'));assert.equal(organ.length,19);assert.equal(organ.filter(p=>p.after).length,1);assert.equal(organ.filter(p=>p.after&&!p.legacy).length,0);
    assert.ok(organ.filter(p=>/Jejunum|Ileum|Caecum|Kidney|kidney|Renal/.test(p.names.join(' '))).every(p=>p.legacy&&!p.after));
  }
});
test('scalar replay and all stored witness checks are complete within their declared scope',()=>{
  assert.equal(a.reportSha256,sha(read(root+'lumbar-source-frames.json')));assert.equal(a.scriptSha256,sha(read('scripts/verify-lumbar-source-frames.mjs')));
  for(const [i,p] of a.candidates.entries()){assert.equal(p.binarySha256,r.psoasCandidates[i].binary.sha256);assert.equal(p.vertices,18728);assert.equal(p.indexReferences,112344);assert.equal(p.edgeOccurrences,112344);assert.equal(p.coordinateDifferences,0);assert.equal(p.witnesses,i?25:23);assert.ok(p.maximumScaledEdgeResidualMm<.000118);assert.ok(p.maximumWitnessResidualMm<1e-8);}
  for(const f of r.files.filter(f=>!f.file.startsWith('.cache/')))assert.equal(sha(read(f.file)),f.sha256,f.file);
});
test('ten diagnostics preserve paired cameras, full declared context and image hashes',()=>{
  assert.equal(c.reportSha256,a.reportSha256);assert.equal(c.auditSha256,sha(read(root+'lumbar-source-frames-readback.json')));assert.equal(c.scriptSha256,sha(read('scripts/capture-lumbar-source-frames.mjs')));assert.deepEqual(c.errors,[]);assert.equal(c.captures.length,10);assert.equal(c.fixedContext.length,79);
  for(const view of ['spine','front','oblique']){const group=c.captures.filter(p=>p.view===view);assert.equal(group.length,view==='spine'?4:3);for(const p of group){assert.equal(sha(read(root+p.file)),p.sha256);assert.deepEqual(p.cameraPosition,group[0].cameraPosition);assert.deepEqual(p.target,group[0].target);assert.equal(p.extent,group[0].extent);assert.deepEqual(p.ids,group[0].ids);assert.equal(p.ids.length,view==='spine'?12:81);}}
  const expected=[...c.fixedContext.map(p=>p.id),'VHF0034','VHF0072'];assert.deepEqual(c.captures.find(p=>p.view==='front').ids,expected);
});
