import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialView, viewReducer} from '../src/view-state.ts';

const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const atlas = read('public/models/female/atlas-female.json');
const original = read('data/female-atlas-structures.json');
const additions = read('data/female-additional-organ-groups.json');

test('additional female organ navigation matches exact source concepts without changing pinned source catalogue', () => {
  assert.deepEqual(additions.map(g => [g.id, g.ids.length]), [['uterine-tube', 8], ['vagina', 2]]);
  const allIds = additions.flatMap(g => g.ids);
  assert.equal(new Set(allIds).size, 10);
  for (const group of additions) {
    assert.equal(group.sex, 'female');
    assert.deepEqual(group.ids, [...new Set(group.sourceConcepts.flatMap(id => atlas.concepts.find(c => c.id === id)?.elements || []))]);
    for (const id of group.ids) {
      const raw = original.find(s => s.id === id);
      assert.ok(raw && atlas.parts.some(p => p.id === id));
      assert.equal(raw.group, undefined);
      assert.equal(raw.layer, 'organ');
      assert.equal(raw.sex, 'female');
    }
  }
  assert.equal(original.length, 1220);
});

test('new female bundles and individual selections use the shared view-state transition rules', () => {
  for (const group of additions) {
    const layers = {...initialView().layers, skin:false, organ:true};
    const start = {...viewReducer(initialView(), {type:'sex', value:'female'}), markers:'hidden', camera:{position:[0,1,3],target:[0,1,0]}};
    const opened = viewReducer(start, {type:'detail', detail:{id:group.id,name:group.name,ids:group.ids,layers}});
    assert.deepEqual(opened.selection.ids, group.ids);
    assert.equal(opened.detail.id, group.id);
    assert.equal(opened.markers, start.markers);
    assert.deepEqual(opened.camera, start.camera);
    const part = original.find(s => s.id === group.ids[0]);
    const selected = viewReducer(opened, {type:'select', layer:'organ',selection:{kind:'structure',ids:[part.id],name:part.name}});
    assert.deepEqual(selected.selection.ids, [part.id]);
    assert.equal(selected.detail.id, group.id);
  }
});
