import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
const provenance=JSON.parse(fs.readFileSync('data/catalog/female-brain-provenance.json'));
test('female reference-brain provenance preserves original membership and identifiers',()=>{
  const atlas=JSON.parse(fs.readFileSync('public/models/female/atlas-female.json'));
  const catalog=JSON.parse(fs.readFileSync('data/female-atlas-structures.json'));
  const brain=atlas.parts.filter(p=>p.system==='brain');
  assert.equal(brain.length,283);
  assert.equal(provenance.parts.length,283);
  assert.equal(new Set(provenance.parts.map(p=>p.id)).size,283);
  assert.equal(provenance.atlasSha256,createHash('sha256').update(fs.readFileSync('public/models/female/atlas-female.json')).digest('hex'));
  for(const part of brain){
    const entry=catalog.find(p=>p.id===part.id);
    const source=provenance.parts.find(p=>p.id===part.id);
    assert.equal(source.name,part.name);assert.equal(source.conceptId,part.conceptId);
    assert.equal(entry.name,part.name);assert.equal(entry.group,'brain');
    if(part.id==='HRAF0070'){
      assert.equal(source.origin,'visible-human');assert.equal(source.sourceNode,'VH_F_optic_chiasm');
      assert.equal(source.anatomicalStructureOf,'#VHFBrain');assert.equal(source.originalOrganFile,'VH_F_Brain&lf;');
      assert.match(entry.source,/Visible Human/);assert.doesNotMatch(entry.source,/Allen/);
      assert.match(entry.description,/위치·연결 검증은 미완료/);assert.doesNotMatch(entry.description,/여성 기증자 뇌 스캔이 아닙니다/);
    }else{
      assert.equal(source.origin,'allen-reference');assert.equal(source.anatomicalStructureOf,'#VHFAllenBrain');
      assert.equal(source.originalOrganFile,'Allen_F_Brain&lf;');
      assert.match(entry.source,/Allen/);assert.match(entry.description,/여성 기증자 뇌 스캔이 아닙니다/);
    }
  }
  assert.equal(catalog.filter(p=>p.source.includes('Allen')).length,282);
});

const original='.cache/neural-bone/hra-united-female-v1.10.glb';
test('independent GLB reader checks every brain provenance record against original metadata',{skip:!fs.existsSync(original)},async()=>{
  const bytes=fs.readFileSync(original);
  assert.equal(provenance.sourceSha256,createHash('sha256').update(bytes).digest('hex'));
  const document=await new NodeIO().readBinary(bytes);
  const nodes=document.getRoot().listNodes();
  for(const row of provenance.parts){
    const matches=nodes.filter(node=>node.getName()===row.sourceNode && node.getMesh());
    assert.equal(matches.length,1,row.id);
    const extras=matches[0].getExtras();
    assert.equal(row.anatomicalStructureOf,extras.anatomical_structure_of);
    assert.equal(row.originalOrganFile,extras.glb_file_of_single_organs);
    assert.equal(row.sourceSpatialEntity,extras.source_spatial_entity);
    assert.equal(row.ontologyId,extras.ontologyid);
    assert.equal(row.sourceLabel,extras.label);
  }
});
