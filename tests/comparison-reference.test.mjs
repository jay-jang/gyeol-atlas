import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {comparisonReference} from '../src/comparison-reference.ts';
const read=name=>JSON.parse(fs.readFileSync(`data/${name}.json`));
const male=read('male-organ-groups'),female=read('female-organ-groups'),ct=read('female-detail-groups');
const structures=male.flatMap(g=>g.ids.map(id=>({id,group:g.id})));
const groups=[...male,...female,...ct];
test('female comparisons keep complete native memberships and offer CT only as a separate explicit alternative',()=>{
  const stomach=male.find(g=>g.id==='stomach').ids,kidneys=male.find(g=>g.id==='kidney').ids;
  assert.deepEqual(comparisonReference('male',stomach,structures,groups),{overviewIds:stomach,separateGroupIds:[]});
  assert.deepEqual(comparisonReference('female',stomach,structures,groups),{overviewIds:[],separateGroupIds:['stomach-ct']});
  assert.deepEqual(comparisonReference('female',kidneys,structures,groups),{overviewIds:female.find(g=>g.id==='kidney').ids,separateGroupIds:[]});
  assert.deepEqual(comparisonReference('female',[...stomach,...kidneys],structures,groups).overviewIds,[],'Never silently compare only a subset');
  assert.deepEqual(comparisonReference('female',['unknown'],structures,groups),{overviewIds:[],separateGroupIds:[]});
});
test('a carried female stomach joins the overview comparison while the CT detail stays a separate choice',()=>{
  const carried=read('female-transport-groups'),stomach=male.find(g=>g.id==='stomach').ids;
  assert.deepEqual(comparisonReference('female',stomach,structures,[...groups,...carried]),{overviewIds:['FT_FMA7148'],separateGroupIds:['stomach-ct']});
});
test('female large/small intestine and gallbladder comparisons use the same scope in the HRA female body',()=>{
  const {counterparts}=read('female-comparison-counterparts'),biliary=read('female-biliary-groups'),all=[...groups,...biliary];
  const atlas=new Map(read('female-atlas-structures').map(s=>[s.id,s.name]));
  const intestine=female.find(g=>g.id==='intestine').ids;
  for(const [id,c] of Object.entries(counterparts))for(const member of c.ids||[])assert.ok(intestine.includes(member)&&atlas.has(member),`${id} ${member}`);
  const names=ids=>comparisonReference('female',ids,structures,all).overviewIds.map(id=>atlas.get(id));
  // LI4 compares the male colon mesh: the four colon segments and two flexures, not the caecum, appendix or rectum.
  assert.deepEqual(names(['FMA14543nsn']).sort(),['Ascending colon','Descending colon','Hepatic flexure of colon','Sigmoid colon','Splenic flexure of colon','Transverse colon']);
  // SI4 compares the duodenum, jejunum and ileum.
  const small=names(['FMA7206','FMA7207','FMA7208']);
  assert.equal(small.length,9);assert.ok(small.every(n=>/Duoden|Jejunum|Ileum|hepatopancreatic/.test(n)),small.join());
  assert.deepEqual(names(['FMA7207']),['Jejunum']);
  assert.deepEqual(comparisonReference('female',['FMA7202'],structures,all).overviewIds,biliary[0].ids);
  // Without the female group, nothing is silently compared.
  assert.deepEqual(comparisonReference('female',['FMA7202'],structures,groups).overviewIds,[]);
  assert.deepEqual(comparisonReference('female',['FMA7202','unknown'],structures,all).overviewIds,[]);
});
