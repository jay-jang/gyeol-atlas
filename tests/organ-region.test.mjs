import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sourceOrganRegion, anatomyRegionMatches} from '../src/anatomy-region.ts';
import {initialView, viewReducer, restoreView} from '../src/view-state.ts';
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const female = read('data/female-atlas-structures.json');
const groups = read('data/female-organ-groups.json');
const atlas = read('public/models/female/atlas-female.json');
const expected = {brain:'head', heart:'chest', lung:'chest', 'lung-branches':'chest', breast:'chest', liver:'abdomen', kidney:'abdomen', stomach:'abdomen', pancreas:'abdomen', 'pancreas-parenchyma':'abdomen', spleen:'abdomen', uterus:'pelvis', ovary:'pelvis', bladder:'pelvis'};
const regions = ['whole','head','upper-body','lower-body','upper-limb','lower-limb','chest','abdomen','pelvis'];

test('448 female source-defined organ meshes share a stable UI scope, retaining names and source membership', () => {
  let count = 0;
  for (const group of groups.filter(g => expected[g.id])) {
    const ids = [...new Set(group.sourceConcepts.flatMap(id => atlas.concepts.find(c => c.id === id).elements))].sort();
    assert.deepEqual([...group.ids].sort(), ids);
    for (const id of ids) {
      count++;
      const s = female.find(s => s.id === id), part = atlas.parts.find(p => p.id === id);
      assert.equal(s.group, group.id); assert.equal(s.name, part.name); assert.equal(s.sex, 'female');
      assert.equal(s.bodyRegion, expected[group.id]);
      for (const y of [.1,.8,1.2,1.7]) for (const region of regions)
        assert.equal(anatomyRegionMatches([[.3,y,0],[.4,y+.01,.01]],region,s),
          ['whole',expected[group.id],expected[group.id]==='pelvis'?'lower-body':'upper-body'].includes(region),`${id}/${region}/${y}`);
    }
  }
  assert.equal(count,448);
});

test('male overview 111 and detail 754 source members use the same mapping without changing their layer', () => {
  const assets = read('scripts/model-inputs.json').assets;
  const details = read('data/male-detail-structures.json');
  for (const [groupPath,catalog,expectedCount] of [
    ['data/male-organ-groups.json', assets,111], ['data/male-detail-groups.json', details,754],
  ]) {
    let count=0;
    for (const g of read(groupPath)) for (const id of g.ids) {
      const original=catalog.find(s=>s.id===id); assert.ok(original,id);
      const s={...original,group:g.id};
      const region=sourceOrganRegion(s); assert.equal(region,expected[g.id]);
      assert.equal(anatomyRegionMatches([[0,0,0],[0,.01,0]],region,s),true);
      const state=viewReducer(initialView(),{type:'select',layer:s.layer,region,selection:{kind:'structure',ids:[id],name:s.name}});
      assert.equal(state.anatomyRegion,region);assert.equal(state.layers[s.layer],true);count++;
    }
    assert.equal(count,expectedCount);
  }
});

test('transregional groups and unknown names retain legacy overlap; no inferred missing stomach or inherited keys', () => {
  for (const group of [undefined,'intestine','spinal-cord','stomach-ct','abdomen-ct','constructor','toString','__proto__']) {
    const s={group,name:'Stomach / liver surface',layer:'organ'};
    assert.equal(sourceOrganRegion(s),undefined);
    assert.equal(anatomyRegionMatches([[0,.9,0],[.1,1,.1]],'abdomen',s),true);
    assert.equal(anatomyRegionMatches([[0,.9,0],[.1,1,.1]],'chest',s),false);
  }
  assert.equal(groups.some(g=>g.id==='stomach'),false);
  assert.equal(female.find(s=>s.id==='HRAF0431').group,undefined); // Mesovarium is not an ovary mesh.
});

test('restore repairs only incompatible single-organ scopes and preserves camera, markers, details and comparisons', () => {
  const camera={position:[0,1,2],target:[0,1,0]};
  for (const [id,wrong,right] of [['HRAF0475','chest','abdomen'],['HRAF0432','abdomen','pelvis']]) {
    const s={...initialView(),sex:'female',camera,markers:'hidden',anatomyRegion:wrong,displayMode:'layers',
      layers:{...initialView().layers,organ:true},selection:{kind:'structure',ids:[id],name:id}};
    const restore=value=>restoreView(JSON.stringify(value),[],female);
    assert.deepEqual(restore(s),{...s,anatomyRegion:right});
    for(const region of ['whole',right,right==='pelvis'?'lower-body':'upper-body'])
      assert.equal(restore({...s,anatomyRegion:region}).anatomyRegion,region);
    for(const extras of [
      {selection:null}, {selection:{...s.selection,kind:'bundle'}},
      {comparison:{...s.selection,kind:'bundle',pointId:''}},
      {detail:{id:'test',name:'test',ids:[id],layers:s.layers}},
    ]) assert.equal(restore({...s,...extras}).anatomyRegion,wrong);
  }
});
