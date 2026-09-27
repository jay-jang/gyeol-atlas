import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {BufferGeometry,BufferAttribute} from 'three';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const candidate=JSON.parse(gunzipSync(fs.readFileSync('docs/anatomy-alignment/finger-chain-candidate.json.gz')));
const registration=read('data/catalog/female-arm-registration.json'),base=read('docs/anatomy-alignment/female-arm-registration-v2.json');
test('four finger chains change only fourteen borrowed records without extra scale or shear',()=>{
  assert.equal(registration.version,'female-arm-partial-3');assert.equal(registration.partial,true);
  assert.equal(registration.screening.anatomicallyValidated,false);assert.equal(registration.screening.afterOutside,20);
  assert.deepEqual(candidate.baselineRegistration,base);
  const changed=new Map(candidate.combined.records.map(r=>[r.id,r]));assert.equal(changed.size,14);
  let fixed=0;
  for(const r of registration.records){
    if(!changed.has(r.id)){assert.deepEqual(r,base.records.find(b=>b.id===r.id));fixed++;}
    else assert.deepEqual(r,changed.get(r.id));
  }
  assert.equal(fixed,46);
  for(const group of candidate.combined.selectedGroups){
    const e=group.matrix,m=[[e[0],e[1],e[2]],[e[4],e[5],e[6]],[e[8],e[9],e[10]]];
    for(let i=0;i<3;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(m[i].reduce((s,x,k)=>s+x*m[j][k],0)-(i===j?1:0))<1e-12);
    const input=candidate.groups.find(g=>g.side===group.side&&g.finger===group.finger&&g.includeMetacarpal===group.includeMetacarpal);
    for(const id of input.movingIds){
      const old=base.records.find(r=>r.id===id),now=changed.get(id);assert.ok(old&&now);
      for(let i=0;i<3;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(now.linear[i][j]-old.linear[i].reduce((s,x,k)=>s+x*m[k][j],0))<1e-12);
      for(let j=0;j<3;j++)assert.ok(Math.abs(now.translation[j]-(e[12+j]+old.translation.reduce((s,x,k)=>s+x*m[k][j],0)))<1e-12);
    }
  }
});
test('combined source screen retains remaining skin failures and every changed non-skin pair',()=>{
  for(const f of candidate.files)assert.equal(sha(f.path),f.sha256,f.path);
  const c=candidate.combined;assert.equal(c.nonSkinMeshes,1200);assert.equal(c.pairChecks,14*(1200-14)+14*13/2);
  assert.equal(c.summary.beforeOutside,355);assert.equal(c.summary.afterOutside,3);assert.equal(c.summary.vertices,2575);
  for(const k of ['newOutside','worsenedOutside','ambiguous'])assert.equal(c.summary[k],0);
  for(const k of ['newIntersections','increasedStraddle','increasedTrianglePairs'])assert.deepEqual(c[k],[]);
  assert.ok(c.pairs.some(p=>p.before&&!p.after));assert.ok(c.pairs.some(p=>p.before&&p.after),'Existing internal intersections remain');
  assert.equal(c.parts.reduce((s,p)=>s+p.afterOutside,0),3);
  assert.equal(candidate.groups.length,6,'Both metacarpal and phalange-only alternatives retained');
});
test('independent coordinate readback and eight diagnostic views pin their exact inputs',()=>{
  const r=read('docs/anatomy-alignment/finger-chain-readback.json');
  const candidateHash=createHash('sha256').update(gunzipSync(fs.readFileSync('docs/anatomy-alignment/finger-chain-candidate.json.gz'))).digest('hex');
  assert.equal(r.files.find(f=>f.path==='.cache/finger-chains/candidate.json').sha256,candidateHash);
  assert.equal(r.vertices,2575);assert.equal(r.distancePairs,850433);assert.ok(r.maxCompositionErrorM<1e-12);assert.ok(r.maxPairDistanceErrorMm<.0002);
  assert.equal(r.files.find(f=>f.path==='scripts/build-finger-refinement.mjs').sha256,sha('scripts/build-finger-refinement.mjs'));
  const visual=read('docs/anatomy-alignment/finger-chain-captures.json');assert.equal(visual.screenshots.length,8);assert.deepEqual(visual.errors,[]);
  assert.equal(visual.files.find(f=>f.path==='.cache/finger-chains/candidate.json').sha256,candidateHash);
  assert.equal(registration.evidence.find(f=>f.path==='docs/anatomy-alignment/finger-chain-candidate.json.gz').sha256,sha('docs/anatomy-alignment/finger-chain-candidate.json.gz'));
  for(const f of visual.screenshots)assert.equal(sha(f.path),f.sha256,f.path);
  assert.equal(visual.files.find(f=>f.path==='scripts/capture-finger-chains.mjs').sha256,sha('scripts/capture-finger-chains.mjs'));
});
test('runtime positions equal the independent raw-source scalar readback for all fourteen meshes',()=>{
  const atlas=read('public/models/female/atlas-female.json'),readback=read('docs/anatomy-alignment/finger-chain-readback.json'),buffers=new Map();
  for(const row of readback.rows){
    const p=atlas.parts.find(p=>p.id===row.id);
    if(!buffers.has(p.chunk))buffers.set(p.chunk,gunzipSync(fs.readFileSync(`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').pop()}`)));
    const b=buffers.get(p.chunk),g=new BufferGeometry();
    g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),3));
    g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i)),1));
    assert.equal(applyFemaleArmRegistration(g,'female',p.id,p.system),true);
    assert.equal(createHash('sha256').update(Buffer.from(g.attributes.position.array.buffer)).digest('hex'),row.positionSha256);
    assert.equal(createHash('sha256').update(Buffer.from(g.index.array.buffer)).digest('hex'),row.sourceIndicesSha256);g.dispose();
  }
});
