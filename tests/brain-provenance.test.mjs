import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('female reference-brain provenance preserves original membership and identifiers',()=>{
  const atlas=JSON.parse(fs.readFileSync('public/models/female/atlas-female.json'));
  const catalog=JSON.parse(fs.readFileSync('data/female-atlas-structures.json'));
  const brain=atlas.parts.filter(p=>p.system==='brain');
  assert.equal(brain.length,283);
  for(const part of brain){
    const entry=catalog.find(p=>p.id===part.id);
    assert.equal(entry.name,part.name);assert.equal(entry.group,'brain');
    assert.match(entry.source,/Allen/);assert.match(entry.description,/여성 기증자 뇌 스캔이 아닙니다/);
  }
  assert.equal(catalog.filter(p=>p.source.includes('Allen')).length,283);
});
