// Provenance only: never modify coordinates, identifiers or source hierarchy.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const sourcePath='.cache/neural-bone/hra-united-female-v1.10.glb';
const atlasPath='public/models/female/atlas-female.json';
const bytes=fs.readFileSync(sourcePath);
assert.equal(bytes.readUInt32LE(0),0x46546c67);
assert.equal(bytes.readUInt32LE(4),2);
assert.equal(bytes.readUInt32LE(8),bytes.length);
assert.equal(bytes.readUInt32LE(16),0x4e4f534a);
const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
const atlas=JSON.parse(fs.readFileSync(atlasPath));
const nodes=gltf.nodes.filter(n=>n.mesh!==undefined);
const parts=atlas.parts.filter(p=>p.system==='brain').map(part=>{
  const matches=nodes.filter(n=>`HRA:${n.name.replace(/^(VH_F|VH|Allen|Yao)(_|$)/,'')||'body'}`===part.conceptId);
  assert.equal(matches.length,1,part.id);
  const node=matches[0], extras=node.extras;
  let origin;
  if(extras.anatomical_structure_of==='#VHFAllenBrain' && extras.glb_file_of_single_organs==='Allen_F_Brain&lf;') origin='allen-reference';
  else if(extras.anatomical_structure_of==='#VHFBrain' && extras.glb_file_of_single_organs==='VH_F_Brain&lf;') origin='visible-human';
  else assert.fail(`Unreviewed brain provenance: ${part.id}`);
  return {id:part.id,name:part.name,conceptId:part.conceptId,origin,sourceNode:node.name,
    anatomicalStructureOf:extras.anatomical_structure_of,sourceSpatialEntity:extras.source_spatial_entity,
    originalOrganFile:extras.glb_file_of_single_organs,sourceLabel:extras.label,ontologyId:extras.ontologyid};
});
assert.equal(parts.length,283);
assert.equal(parts.filter(p=>p.origin==='allen-reference').length,282);
assert.deepEqual(parts.filter(p=>p.origin==='visible-human').map(p=>p.id),['HRAF0070']);
const hash=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const report={version:1,sourceUrl:'https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/assets/3d-vh-f-united.glb',
  sourceSha256:hash(sourcePath),atlasSha256:hash(atlasPath),
  limitation:'Original GLB metadata attribution only; not a clinical validation of position, laterality or tissue identity.',parts};
fs.writeFileSync('data/catalog/female-brain-provenance.json',JSON.stringify(report,null,2)+'\n');
console.log('Verified brain provenance: 282 Allen reference parts + 1 Visible Human optic chiasm. Geometry unchanged.');
