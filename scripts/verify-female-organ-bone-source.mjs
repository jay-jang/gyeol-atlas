// Compare two current organ/bone crossings directly with the pinned official
// HRA GLB, independently of the packed female runtime geometry reader.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Matrix4} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {officialMeshes} from './lib/official-meshes.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';

const sourcePath='.cache/neural-bone/hra-united-female-v1.10.glb';
const source=fs.readFileSync(sourcePath);
const sha256=buffer=>createHash('sha256').update(buffer).digest('hex');
const atlas=JSON.parse(fs.readFileSync('public/models/female/atlas-female.json'));
const restoration=JSON.parse(fs.readFileSync('data/catalog/female-source-restoration.json'));
assert.equal(sha256(source),restoration.sourceSha256);
assert.equal(restoration.baselineAtlasSha256,sha256(fs.readFileSync('public/models/female/atlas-female.json')));
const pairs=[
  ['HRAF0754','HRAF0837'], // Native lung surface and native T7.
  ['HRAF0421','HRAF0827'], // Native uterine support and restored native ilium.
];
const part=id=>{const p=atlas.parts.find(part=>part.id===id);assert.ok(p,id);return p;};
const sourceName=id=>`VH_F_${part(id).conceptId.slice(4)}`;
const names=[...new Set(pairs.flatMap(pair=>pair.map(sourceName)))];
const meshes=officialMeshes(source,names,restoration.translationFromSkin);
const rows=[];
for(const [organId,boneId] of pairs){
  const a=meshes.get(sourceName(organId)),b=meshes.get(sourceName(boneId));
  a.geometry.computeBoundingBox();b.geometry.computeBoundingBox();
  a.geometry.boundsTree=new MeshBVH(a.geometry);b.geometry.boundsTree=new MeshBVH(b.geometry);
  const broad=a.geometry.boundingBox.intersectsBox(b.geometry.boundingBox);
  const intersects=broad&&a.geometry.boundsTree.intersectsGeometry(b.geometry,new Matrix4());
  assert.equal(intersects,true,`${organId}/${boneId} source crossing disappeared`);
  const crossing=triangleCrossings(a.geometry,b.geometry);
  assert.ok(crossing.strictPlaneStraddlingPairs>0);
  rows.push({organId,organName:part(organId).name,boneId,boneName:part(boneId).name,
    sourceNodes:[a.name,b.name],sourceNodeIndices:[a.nodeIndex,b.nodeIndex],
    sourceVertices:[a.geometry.attributes.position.count,b.geometry.attributes.position.count],
    ...crossing});
}
const report={status:'TWO ORIGINAL SOURCE PAIRS CROSS; NOT A CLINICAL POSITION APPROVAL',sourcePath,
  sourceSha256:sha256(source),sourceTranslation:restoration.translationFromSkin,
  limitations:[
    'Only two selected native HRA pairs were reread; this is not an independent audit of all 203 current pairs.',
    'Original high-resolution surfaces and simplified packed surfaces can have different crossing counts.',
    'A triangle crossing does not measure penetration depth or prove an invalid attachment.',
    'Borrowed male ribs and skull are not members of the original native HRA GLB pair check.',
  ],rows,files:['public/models/female/atlas-female.json','data/catalog/female-source-restoration.json',
    'scripts/verify-female-organ-bone-source.mjs','scripts/lib/official-meshes.mjs','scripts/lib/triangle-crossings.mjs']
      .map(path=>({path,sha256:sha256(fs.readFileSync(path))}))};
fs.writeFileSync('.cache/female-organ-bone/source-readback.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(rows.map(row=>({organId:row.organId,boneId:row.boneId,
  sourceVertices:row.sourceVertices,strictPairs:row.strictPlaneStraddlingPairs}))));
for(const mesh of meshes.values())mesh.geometry.dispose();
