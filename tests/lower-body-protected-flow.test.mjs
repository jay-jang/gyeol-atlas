import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
const root='docs/anatomy-alignment/',read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const r=json(root+'lower-body-protected-flow.json'),a=json(root+'lower-body-protected-flow-readback.json'),c=json(root+'lower-body-protected-flow-captures.json');
test('protected lower-body trial keeps all76 muscles in one post-placement flow and retains failed fitting status',()=>{
  assert.equal(r.muscles.length,76);assert.equal(r.initialMatrices.length,2);assert.equal(r.fit.steps.length,480);assert.equal(r.fit.termination,'iteration-limit');
  assert.match(r.status,/NOT APPROVED/);assert.equal(r.envelope.vertexCount,326280);assert.equal(r.envelope.samples.length,3738);
  assert.deepEqual(['left','right'].map(side=>r.envelope.samples.filter(p=>p.side===side).length),[1862,1876]);
  assert.ok(r.fit.finalLoss<r.fit.history[0].loss);
  for(const s of r.fit.steps){assert.ok(135*Math.hypot(...s.displacement)/(64*s.radius)<=.15+1e-14);assert.ok(s.protectedDistance-s.radius>=1e-6-1e-12);}
  assert.equal(r.muscles.reduce((n,m)=>n+m.jacobianSamples.length,0),9728);
});
test('protected meshes cover exactly the runtime complement without skin and all10 placed source bones',()=>{
  const atlas=json('public/models/female/atlas-female.json'),changed=new Set(r.muscles.map(m=>m.id));
  assert.deepEqual(r.fixedIds,atlas.parts.filter(p=>!changed.has(p.id)&&p.id!=='HRAF0003').map(p=>p.id));
  assert.equal(r.fixedIds.length,1143);assert.equal(r.bones.length,10);assert.equal(r.bones.reduce((n,b)=>n+b.vertices,0),275221);
  assert.deepEqual(r.protectionReadback,{vertices:1534982,coordinateDifferences:0,maximumClearanceDifference:0,supportQueries:480});
  assert.equal(r.protectedIndexReferences,8984601);
});
test('skin improvement is not treated as correction of initial organ and vessel intersections',()=>{
  assert.deepEqual(r.summary,{meshes:76,vertices:652173,examinedPairs:89794,initialOutside:7278,afterOutside:6654,initialAmbiguous:0,afterAmbiguous:0,newOutside:0,worsenedOutside:0,readbackDifferences:0,currentPairs:232,initialPairs:230,afterPairs:230,newAgainst_current:112,newAgainst_initial:0,sourceBonePairs:17,initialBonePairs:17,afterBonePairs:17,newBonePairs:0});
  assert.ok(r.relations.every(p=>p.initial===p.after));assert.equal(r.sourceBoneRelations.length,380);assert.ok(r.sourceBoneRelations.every(p=>p.initial===p.after));
  const counts={};for(const p of r.relations.filter(p=>p.after&&!p.current)){const key=p.layers.slice().sort().join('/');counts[key]=(counts[key]||0)+1;}
  assert.deepEqual(counts,{'muscle/skin':7,'muscle/muscle':3,'muscle/organ':12,'muscle/vessel':9,'bone/muscle':81});
});
test('serialized replay preserves full source triangle membership and code provenance',()=>{
  assert.equal(a.reportSha256,sha(read(root+'lower-body-protected-flow.json')));assert.equal(a.binarySha256,r.binary.sha256);
  assert.deepEqual([a.vertices,a.indexReferences,a.coordinateDifferences],[652173,3912126,0]);
  assert.equal(a.scriptSha256,sha(read('scripts/verify-lower-body-protected-flow.mjs')));
  for(const f of r.files.filter(f=>!f.file.startsWith('.cache/')))assert.equal(sha(read(f.file)),f.sha256,f.file);
  assert.equal(r.binary.gzipBytes,12534403);
});
test('all eight diagnostic captures preserve paired cameras, explicit organ/vessel context and hashes',()=>{
  assert.equal(c.reportSha256,a.reportSha256);assert.equal(c.auditSha256,sha(read(root+'lower-body-protected-flow-readback.json')));
  const prior=json(root+'lower-body-bone-flow.json');assert.equal(c.priorReportSha256,sha(read(root+'lower-body-bone-flow.json')));
  assert.equal(c.scriptSha256,sha(read('scripts/capture-lower-body-protected-flow.mjs')));assert.deepEqual(c.errors,[]);assert.equal(c.captures.length,8);
  for(const side of ['left','right'])for(const view of ['front','back']){
    const own=r.muscles.filter(m=>m.side===side),context=new Set();
    for(const p of r.relations.filter(p=>p.initial&&p.ids.some(id=>own.some(m=>m.id===id))))for(const [i,id] of p.ids.entries())if(['organ','vessel'].includes(p.layers[i]))context.add(id);
    const expected=[...prior.sides.find(s=>s.side===side).bones.flatMap(b=>b.targetIds),...own.map(m=>m.id),...context,'HRAF0003'],pair=c.captures.filter(p=>p.side===side&&p.view===view);
    assert.equal(pair.length,2);
    for(const p of pair){assert.deepEqual(p.ids,expected);assert.equal(sha(read(root+p.file)),p.sha256);assert.deepEqual(p.cameraPosition,pair[0].cameraPosition);assert.deepEqual(p.target,pair[0].target);assert.equal(p.extent,pair[0].extent);}
  }
});
