import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Int16BufferAttribute} from 'three';
import {applyFemaleKneeSourceRestoration as apply,femaleKneeSourceRestoration as spec} from '../src/female-knee-source-restoration.ts';
import {femaleSourceRestoration as ilium} from '../src/female-source-restoration.ts';
const sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p));
const compressed=read(`public/${spec.url}`),bytes=gunzipSync(compressed),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
const atlas=json('public/models/female/atlas-female.json'),report=json('docs/anatomy-alignment/knee-target-resolution.json'),proof=json('docs/anatomy-alignment/knee-target-resolution-readback.json');
const geometry=p=>{const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(p.vertexCount*3),3));g.setAttribute('normal',new Int16BufferAttribute(new Int16Array(p.vertexCount*3),3,true));g.setIndex(new BufferAttribute(new Uint32Array(p.indexCount),1));return g;};
test('38 native knee source patches are pinned, disjoint from ilium and leave all other atlas parts untouched',()=>{
  assert.equal(sha(compressed),spec.sha256);assert.equal(compressed.length,spec.gzipBytes);assert.equal(bytes.length,spec.bytes);
  assert.equal(sha(read('public/models/female/atlas-female.json')),spec.baselineAtlasSha256);
  assert.equal(spec.records.length,38);assert.equal(new Set(spec.records.map(r=>r.id)).size,38);
  assert.ok(spec.records.every(r=>!ilium.records.some(i=>i.id===r.id)));
  assert.deepEqual(spec.records.map(r=>r.id),report.parts.map(r=>r.id));
  let changed=0,vertices=0,indices=0;
  for(const p of atlas.parts){
    const g=geometry(p),original=g.attributes.position,originalNormal=g.attributes.normal;
    if(apply(g,'female',p.id,p.system,buffer)){
      changed++;vertices+=g.attributes.position.count;indices+=g.index.count;
      assert.ok(g.attributes.normal.array instanceof Float32Array);assert.equal(g.attributes.normal.normalized,false);
      const n=g.attributes.normal.array;assert.ok([...g.attributes.position.array,...n].every(Number.isFinite));
      for(let i=0;i<n.length;i+=3)assert.ok(Math.abs(Math.hypot(n[i],n[i+1],n[i+2])-1)<1e-6);
      assert.ok(g.index.array.every(i=>i<g.attributes.position.count));
      assert.equal(g.attributes.position.array.buffer,buffer);assert.equal(g.attributes.normal.array.buffer,buffer);assert.equal(g.index.array.buffer,buffer);
      assert.equal(apply(g,'female',p.id,p.system,buffer),false);
    }else {assert.equal(g.attributes.position,original);assert.equal(g.attributes.normal,originalNormal);}
    assert.ok(original.array.every(v=>v===0));assert.ok(originalNormal.array.every(v=>v===0));g.dispose();
  }
  assert.deepEqual([changed,vertices,indices],[38,16184,92760]);
});
test('knee restoration cannot cross dataset boundaries and rejects incompatible inputs',()=>{
  const p=atlas.parts.find(p=>p.id===spec.records[0].id);
  for(const dataset of ['male','male-detail','female-detail']){const g=geometry(p),old=g.attributes.position;assert.equal(apply(g,dataset,p.id,p.system,null),false);assert.equal(g.attributes.position,old);g.dispose();}
  const g=geometry(p);
  assert.throws(()=>apply(g,'female',p.id,'borrowed',buffer),/출처/);
  for(const b of [null,new ArrayBuffer(12)])assert.throws(()=>apply(g,'female',p.id,p.system,b),/크기/);
  g.userData.femaleKneeSourceRestoration='other';assert.throws(()=>apply(g,'female',p.id,p.system,buffer),/버전/);delete g.userData.femaleKneeSourceRestoration;
  g.setIndex([0,1,2]);assert.throws(()=>apply(g,'female',p.id,p.system,buffer),/기준/);g.dispose();
});
test('source readback and finite surface witnesses support fidelity restoration, not a new registration',()=>{
  assert.equal(sha(read('docs/anatomy-alignment/knee-target-resolution.json')),spec.auditReportSha256);
  assert.equal(proof.reportSha256,spec.auditReportSha256);assert.equal(proof.binarySha256,spec.sha256);assert.equal(proof.sourceSha256,spec.sourceSha256);
  assert.deepEqual(spec.translationFromSkin,report.translationFromSkin);
  assert.deepEqual([proof.vertices,proof.indexReferences],[16184,92760]);assert.ok(proof.maximumNormalResidual<3e-8);
  assert.equal(report.composites.length,8);let checked=0;
  for(const row of [...report.parts,...report.composites])for(const w of row.maximumWitnessChecks){assert.ok(w.residualMm<1e-6);checked++;}
  assert.equal(checked,184);
  for(const p of report.parts){assert.equal(p.skinOriginal.outside,0);assert.equal(p.skinOriginal.ambiguous,0);assert.ok(p.boundsResidualMm<.01);}
  assert.deepEqual(report.runtimeSummary,{changedMeshes:38,uniquePairs:45619,beforePairs:162,afterPairs:162,removedPairs:0,newPairs:0});
  assert.deepEqual(report.muscleStates.map(s=>[s.summary.examinedPairs,s.summary.packedPairs,s.summary.originalPairs,s.summary.packedOnlyPairs,s.summary.originalOnlyPairs]),[
    [1900,52,52,0,0],[1900,38,37,2,1],[1900,51,50,1,0],[1900,26,27,0,1],[1900,45,46,0,1],[1900,41,41,0,0],
  ]);
});
test('plane straddling without an interior witness is retained and independently classified as point contact',()=>{
  assert.deepEqual(proof.contactSummary,{pairStateOccurrences:85,trianglePairs:582,sharedVertexTrianglePairs:582,maximumOverlapMetres:0,minimumOverlapMetres:0});
  assert.equal(proof.contacts.length,85);let pairs=0;
  for(const row of proof.contacts)for(const c of row.checks){
    assert.ok(c.sharedVertices>=1);assert.equal(c.overlapMetres,0);
    const overlap=Math.min(c.intervalA[1],c.intervalB[1])-Math.max(c.intervalA[0],c.intervalB[0]);
    assert.equal(overlap,0);pairs++;
  }
  assert.equal(pairs,582);
});
