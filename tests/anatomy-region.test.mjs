import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {limbSkeletonRegion, anatomyRegionMatches} from '../src/anatomy-region.ts';
import {initialView, viewReducer} from '../src/view-state.ts';
const female = JSON.parse(fs.readFileSync('data/female-atlas-structures.json'));
const male = JSON.parse(fs.readFileSync('scripts/model-inputs.json')).assets;
const regions = ['whole','head','upper-body','lower-body','upper-limb','lower-limb','chest','abdomen','pelvis'];

test('all 64 female borrowed arm/hand and shoulder bones keep limb identity at any height', () => {
  const ids = Array.from({length:64},(_,i)=>`BM${String(i+60).padStart(4,'0')}`);
  for (const id of ids) {
    const s = female.find(s=>s.id===id);
    assert.equal(limbSkeletonRegion(s),'upper-limb',id);
    assert.equal(s.bodyRegion,'upper-limb',id);
    for (const y of [.1,.7,.9,1.2,1.5]) for (const region of regions) {
      assert.equal(anatomyRegionMatches([[.3,y,0],[.4,y+.01,.01]],region,s),
        ['whole','upper-body','upper-limb'].includes(region),`${id}/${region}/${y}`);
    }
  }
});

test('all 56 female foot bones exclude arm, chest, abdomen and pelvis views', () => {
  for(let i=124;i<180;i++) {
    const s = female.find(s=>s.id===`BM${String(i).padStart(4,'0')}`);
    assert.equal(limbSkeletonRegion(s),'lower-limb');
    for(const region of regions) assert.equal(anatomyRegionMatches([[.3,1.1,0],[.4,1.2,.01]],region,s),
      ['whole','lower-body','lower-limb'].includes(region),`${s.id}/${region}`);
  }
});

test('male and female matching original bone names classify identically; all 56 male finger/toe phalanges covered', () => {
  let paired=0, phalanges=0;
  for(const s of male.filter(s=>s.layer==='bone')) {
    const counterpart=female.find(f=>f.layer==='bone' && f.name.toLowerCase()===s.name.toLowerCase());
    if(counterpart && limbSkeletonRegion(s)) {paired++;assert.equal(limbSkeletonRegion(s),limbSkeletonRegion(counterpart));}
    if(/phalanx/.test(s.name)) {phalanges++;assert.equal(limbSkeletonRegion(s),/finger|thumb/.test(s.name)?'upper-limb':'lower-limb');}
  }
  assert.equal(phalanges,56);assert.ok(paired>=110);
});

test('unreviewed tissues retain geometric filtering, not bone word guesses', () => {
  for(const layer of ['organ','nerve','vessel','muscle','lymph','skin']) {
    const s={layer,name:'Radial surface of humerus'};
    assert.equal(limbSkeletonRegion(s),undefined);
    assert.equal(anatomyRegionMatches([[.01,.9,0],[.1,1,.1]],'abdomen',s),true);
  }
  for(const name of ['Thoracic vertebra 1','Ilium compact bone (right)','Right first rib','Cuneiform nucleus']) {
    assert.equal(limbSkeletonRegion({layer:name.includes('nucleus')?'nerve':'bone',name}),undefined);
  }
});

test('selection region and layer use the existing reducer; changing region clears selection without moving geometry', () => {
  for(const s of [...male,...female].filter(s=>limbSkeletonRegion(s))) {
    const next=viewReducer(initialView(),{type:'select',layer:s.layer,region:limbSkeletonRegion(s),selection:{kind:'structure',ids:[s.id],name:s.name}});
    assert.equal(next.anatomyRegion,limbSkeletonRegion(s));assert.equal(next.layers.bone,true);
    const changed=viewReducer(next,{type:'anatomy-region',value:next.anatomyRegion==='upper-limb'?'lower-limb':'upper-limb'});
    assert.equal(changed.selection,null);assert.deepEqual(changed.camera,next.camera);
  }
});
