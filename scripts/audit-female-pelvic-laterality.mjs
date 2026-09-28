// Source-frame diagnosis only. Never rewrites the HRA GLB or packed atlas.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';

const sourceFile='.cache/neural-bone/hra-united-female-v1.10.glb';
const manifestFile='public/models/female/atlas-female.json';
const source=fs.readFileSync(sourceFile),manifestBytes=fs.readFileSync(manifestFile);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(source),'95f0c3d2f918582608692ca1139e8bdb18c147a16470e9ee9af8b276bd77c422');
assert.equal(sha(manifestBytes),'349ad9085901db2cced179d467542271289ee0b259414a78814402d5ac374d2f');
const manifest=JSON.parse(manifestBytes),byId=new Map(manifest.parts.map(p=>[p.id,p]));
const native=manifest.parts.filter(p=>!['brain','borrowed','donor-muscle'].includes(p.system));
const pairKeys=new Map();
for(const part of native){
  const name=part.name.toLowerCase(),left=/\bleft\b/.test(name),right=/\bright\b/.test(name);
  if(left===right)continue;
  const key=name.replace(/\b(left|right)\b/g,'side').replace(/[()]/g,'').replace(/\s+/g,' ').trim();
  const pair=pairKeys.get(key)||{};assert.ok(!pair[left?'left':'right'],`Duplicate exact side: ${key}`);
  pair[left?'left':'right']=part;pairKeys.set(key,pair);
}
const paired=[...pairKeys].filter(([,pair])=>pair.left&&pair.right);
const centerX=part=>(part.bounds[0][0]+part.bounds[1][0])/2;
const reversed=paired.filter(([,pair])=>centerX(pair.left)<=centerX(pair.right));
assert.equal(paired.length,185);
assert.deepEqual(reversed.map(([key])=>key),['side round ligament of uterus']);
const ids=['HRAF0417','HRAF0418','HRAF0421','HRAF0422','HRAF0432','HRAF0433'];
const sourceNames={
  HRAF0417:'VH_F_right_round_ligament_of_uterus',HRAF0418:'VH_F_left_round_ligament_of_uterus',
  HRAF0421:'VH_F_right_cardinal_ligament_of_uterus',HRAF0422:'VH_F_left_cardinal_ligament_of_uterus',
  HRAF0432:'VH_F_left_ovary',HRAF0433:'VH_F_right_ovary',
};
const glb=await new NodeIO().readBinary(source);
const coordinates=ids.map(id=>{
  const part=byId.get(id);assert.ok(part);assert.equal(part.system,'reproductive');
  const nodes=glb.getRoot().listNodes().filter(node=>node.getName()===sourceNames[id]);
  assert.equal(nodes.length,1);const node=nodes[0];
  assert.deepEqual(Array.from(node.getWorldMatrix()),[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  const primitives=node.getMesh().listPrimitives();assert.equal(primitives.length,1);
  const positions=primitives[0].getAttribute('POSITION').getArray();
  let minX=Infinity,maxX=-Infinity;for(let i=0;i<positions.length;i+=3){minX=Math.min(minX,positions[i]);maxX=Math.max(maxX,positions[i]);}
  const packedMinX=part.bounds[0][0],packedMaxX=part.bounds[1][0];
  // The importer simplifies geometry but preserves its extreme coordinates;
  // the atlas has one common stage translation, not a left/right reflection.
  assert.ok(Math.abs((packedMinX-minX)-(packedMaxX-maxX))<1e-6,id);
  return {id,name:part.name,conceptId:part.conceptId,sourceNode:node.getName(),sourceVertices:positions.length/3,
    sourceX:[minX,maxX],packedX:[packedMinX,packedMaxX],stageShiftX:packedMinX-minX};
});
const shifts=coordinates.map(r=>r.stageShiftX);assert.ok(Math.max(...shifts)-Math.min(...shifts)<1e-6);
for(const id of ['HRAF0417','HRAF0422','HRAF0432'])assert.ok(centerX(byId.get(id))>0,id);
for(const id of ['HRAF0418','HRAF0421','HRAF0433'])assert.ok(centerX(byId.get(id))<0,id);
// Unlike the cardinal ligament's small midline crossing, both mislabeled
// round ligaments are completely on the opposite side of the X=0 plane.
assert.ok(byId.get('HRAF0417').bounds[0][0]>0);
assert.ok(byId.get('HRAF0418').bounds[1][0]<0);
const report={createdAt:new Date().toISOString(),status:'SOURCE LATERALITY AUDIT; no runtime change',
  source:{file:sourceFile,sha256:sha(source),url:'https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/assets/3d-vh-f-united.glb'},
  packed:{file:manifestFile,sha256:sha(manifestBytes)},
  census:{method:'Exact case-insensitive left/right name pairs among native non-brain parts; bounding-box center X only',pairs:paired.length,reversed:reversed.map(([key,pair])=>({key,leftId:pair.left.id,rightId:pair.right.id,leftCenterX:centerX(pair.left),rightCenterX:centerX(pair.right)}))},
  coordinates,limitations:[
    'Positive X is inferred as anatomical left from the other 184 native exact-name pairs and both ovary/cardinal-ligament controls; this is not an individual clinical position validation.',
    'Exact-name matching omits unpaired, differently named and midline parts; it does not audit every female structure or any neural connection.',
    'The official GLB carries the reversed round-ligament names on opposite sides. This audit does not establish why its authoring labels differ from the rest of the atlas.',
    'Bounding-box extrema and six source meshes do not validate uterine attachment or physiological course.',
  ]};
fs.writeFileSync('docs/anatomy-alignment/female-pelvic-laterality-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pairs:paired.length,reversed:report.census.reversed,coordinates},null,2));
