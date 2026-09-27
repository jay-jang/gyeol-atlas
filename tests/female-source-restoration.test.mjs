import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute} from 'three';
import {applyFemaleSourceRestoration,femaleSourceRestoration as spec} from '../src/female-source-restoration.ts';
const sha=b=>createHash('sha256').update(b).digest('hex');
const compressed=fs.readFileSync(`public/${spec.url}`),data=gunzipSync(compressed);
const buffer=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
const atlas=JSON.parse(fs.readFileSync('public/models/female/atlas-female.json'));
const geometry=p=>{const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(p.vertexCount*3),3));g.setIndex(new BufferAttribute(new Uint32Array(p.indexCount),1));return g;};
test('the original ilium restoration patch is pinned and independently affects only right compact ilium',()=>{
  assert.equal(sha(compressed),spec.sha256);assert.equal(compressed.length,spec.gzipBytes);assert.equal(data.length,spec.bytes);
  assert.equal(sha(fs.readFileSync('public/models/female/atlas-female.json')),spec.baselineAtlasSha256);
  assert.equal(spec.records.length,1);assert.equal(spec.records[0].id,'HRAF0827');let changed=0;
  for(const p of atlas.parts){
    const g=geometry(p),old=g.attributes.position;
    const applied=applyFemaleSourceRestoration(g,'female',p.id,p.system,buffer);
    if(applied){
      changed++;assert.equal(p.id,'HRAF0827');assert.equal(g.attributes.position.count,5907);assert.equal(g.index.count,35430);
      assert.ok([...g.attributes.position.array,...g.attributes.normal.array].every(Number.isFinite));
      for(let i=0;i<5907;i++)assert.ok(Math.abs(Math.hypot(...g.attributes.normal.array.subarray(i*3,i*3+3))-1)<1e-6);
      assert.ok(g.index.array.every(i=>i<5907));
      assert.equal(applyFemaleSourceRestoration(g,'female',p.id,p.system,buffer),false);
    }else assert.equal(g.attributes.position,old);
    assert.ok(old.array.every(v=>v===0),'Base geometry must not be mutated');g.dispose();
  }
  assert.equal(changed,1);
});
test('restoration cannot leak to male or CT datasets and rejects missing or incompatible input',()=>{
  const p=atlas.parts.find(p=>p.id==='HRAF0827');
  for(const dataset of ['male','male-detail','female-detail']){const g=geometry(p);assert.equal(applyFemaleSourceRestoration(g,dataset,p.id,p.system,null),false);g.dispose();}
  const g=geometry(p);
  assert.throws(()=>applyFemaleSourceRestoration(g,'female',p.id,'borrowed',buffer),/출처/);
  assert.throws(()=>applyFemaleSourceRestoration(g,'female',p.id,p.system,null),/크기/);
  g.setIndex([0,1,2]);assert.throws(()=>applyFemaleSourceRestoration(g,'female',p.id,p.system,buffer),/기준/);g.dispose();
});
test('independent source readback and whole-atlas relation screen describe the exact shipped restoration',()=>{
  const proof=JSON.parse(fs.readFileSync('docs/anatomy-alignment/hra-ilium-restoration-readback.json'));
  const audit=JSON.parse(fs.readFileSync('docs/anatomy-alignment/hra-ilium-restoration.json'));
  assert.equal(proof.assetSha256,spec.sha256);assert.equal(proof.uncompressedSha256,sha(data));
  assert.equal(proof.manifestSha256,sha(fs.readFileSync('data/catalog/female-source-restoration.json')));
  assert.equal(proof.sourceSha256,spec.sourceSha256);assert.equal(proof.allPositionsEqualSourcePlusCommonShift,true);assert.equal(proof.allIndicesEqualOriginalOrder,true);
  assert.deepEqual(audit.manifest,spec);
  assert.deepEqual(audit.summary,{examinedOtherParts:1219,beforeCrossingPairs:14,afterCrossingPairs:12,newCrossingPairs:0,resolvedCrossingPairs:2});
  assert.deepEqual(audit.relations.filter(p=>p.before&&!p.after).map(p=>p.id),['HRAF0911','HRAF0957']);
  assert.equal(audit.skinAfter.outside,0);assert.equal(audit.skinAfter.ambiguous,0);
  assert.equal(Object.values(audit.skinAfter).reduce((n,x)=>n+x,0),5907);
});
