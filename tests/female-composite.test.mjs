import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(fs.readFileSync(p));
const groups=read('data/female-composite-groups.json'),catalog=read('data/female-atlas-structures.json');
const atlas=read('public/models/female/atlas-female.json'),hierarchy=read('docs/anatomy-alignment/hra-bone-targets.json');
test('female femur groups contain the official root and all 15 descendants, including source cartilage',()=>{
  assert.equal(groups.length,3);
  for(const [i,side] of ['left','right'].entries()){
    const group=groups[i],concept=`HRA:femur_${side==='left'?'L':'R'}`;
    assert.equal(group.id,`femur-${side}`);assert.equal(group.sex,'female');assert.deepEqual(group.sourceConcepts,[concept]);
    assert.deepEqual(group.ids,atlas.concepts.find(c=>c.id===concept).elements);
    const target=hierarchy.targets.find(t=>t.side===side&&t.bone==='Femur');
    assert.deepEqual([...group.ids].sort(),target.members.map(p=>p.id).sort());assert.equal(group.ids.length,16);
    for(const id of group.ids){const part=catalog.find(p=>p.id===id);assert.equal(part.sex,'female');assert.equal(part.layer,'bone');assert.equal(part.group,group.id);}
    assert.ok(target.members.some(p=>p.system==='connective'));assert.match(group.description,/관절연골/);
    assert.match(catalog.find(p=>p.id===target.rootId).label,/대퇴골 본체/);
  }
});
test('source composite selection leaves featured organs and other catalog memberships separate',()=>{
  const ids=new Set(groups.flatMap(g=>g.ids));assert.equal(ids.size,61);
  const organs=read('data/female-organ-groups.json');assert.equal(organs.length,12);
  assert.ok(organs.every(g=>g.ids.every(id=>!ids.has(id))));
  assert.equal(catalog.filter(p=>groups.some(g=>g.id===p.group)).length,61);
  assert.equal(catalog.length,1220);
});
test('spinal composite contains every actual source descendant and preserves canonical English names',()=>{
  const group=groups.find(g=>g.id==='spinal-cord'),audit=read('docs/anatomy-alignment/female-neural-source.json');
  assert.equal(group.name,'척수 수록 분절');assert.equal(group.sex,'female');assert.deepEqual(group.sourceConcepts,['HRA:spinal_cord']);
  assert.deepEqual([...group.ids].sort(),audit.spinalHierarchy.descendants.map(p=>p.id).sort());
  assert.equal(group.ids.length,29);assert.equal(new Set(group.ids).size,29);
  assert.match(group.sourceSummary,/29분절/);assert.doesNotMatch(group.sourceSummary,/연골/);
  assert.match(group.description,/S5·미수/);assert.match(group.description,/교차 7쌍/);
  for(const id of group.ids){
    const p=catalog.find(p=>p.id===id),original=atlas.parts.find(p=>p.id===id);
    assert.equal(p.group,'spinal-cord');assert.equal(p.name,original.name);assert.equal(p.layer,'nerve');assert.equal(p.sex,'female');assert.match(p.label,/척수/);
  }
  assert.deepEqual(group.ids.slice(13,16),['HRAF0368','HRAF0366','HRAF0367']);
});
