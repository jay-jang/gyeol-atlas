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
