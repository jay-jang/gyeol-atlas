// Compare the actual deployed BP3 and registered Z-Anatomy vessel surfaces.
// Matching names do not imply identical anatomical extents or clinical fit.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {KHRDracoMeshCompression} from '@gltf-transform/extensions';
import draco from 'draco3dgltf';
import {BufferAttribute, BufferGeometry, Matrix4, Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';

const files = ['public/models/vessel.glb', 'public/models/vessel-full.glb',
  'scripts/model-inputs.json', 'data/catalog/male-registration.json',
  'scripts/audit-male-vessel-surfaces.mjs'];
const hashes = Object.fromEntries(files.map(path => [path, createHash('sha256').update(fs.readFileSync(path)).digest('hex')]));
const assets = JSON.parse(fs.readFileSync(files[2])).assets.filter(a => a.layer === 'vessel');
const registration = JSON.parse(fs.readFileSync(files[3]));
const names = new Map(assets.map(a => [a.id, a.name.toLowerCase()]));
const normalize = name => name.toLowerCase().replace(/ \(ii\)/, '').replace(/\.l$/, ' left').replace(/\.r$/, ' right')
  .replace(/^left (.*)/, '$1 left').replace(/^right (.*)/, '$1 right')
  .replace('arch of aorta', 'aortic arch').replace('celiac artery', 'celiac trunk');
const io = new NodeIO().registerExtensions([KHRDracoMeshCompression])
  .registerDependencies({'draco3d.decoder': await draco.createDecoderModule()});

function geometry(node) {
  const primitives = node.getMesh().listPrimitives();
  assert.equal(primitives.length, 1, `unexpected primitive count: ${node.getName()}`);
  const p = primitives[0], g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(p.getAttribute('POSITION').getArray()), 3));
  if (p.getIndices()) g.setIndex(new BufferAttribute(new Uint32Array(p.getIndices().getArray()), 1));
  g.applyMatrix4(new Matrix4().fromArray(node.getWorldMatrix()));
  return g;
}
function referenced(g) {
  const index = g.getIndex();
  return index ? [...new Set(index.array)] : Array.from({length:g.getAttribute('position').count}, (_,i)=>i);
}
function distribution(from, to) {
  const positions = from.getAttribute('position'), indices = referenced(from), point = new Vector3();
  const distances = indices.map(i => 1000 * to.boundsTree.closestPointToPoint(point.fromBufferAttribute(positions, i)).distance);
  distances.sort((a,b)=>a-b);
  assert.ok(distances.length && distances.every(Number.isFinite));
  return {vertices: distances.length, minimumMm: distances[0], medianMm: distances[Math.floor((distances.length-1)*.5)],
    p95Mm: distances[Math.floor((distances.length-1)*.95)], maximumMm: distances.at(-1)};
}
function bounds(g) {
  g.computeBoundingBox();const b=g.boundingBox;
  return {min:b.min.toArray(),max:b.max.toArray(),center:[0,1,2].map(i=>(b.min.getComponent(i)+b.max.getComponent(i))/2),
    extentMm:[0,1,2].map(i=>1000*(b.max.getComponent(i)-b.min.getComponent(i)))};
}
function summarize(rows, key) {
  const values=rows.map(r=>r[key]).sort((a,b)=>a-b);
  return {count:values.length, minimumMm:values[0], medianMm:values[Math.floor((values.length-1)*.5)],
    p95Mm:values[Math.floor((values.length-1)*.95)], maximumMm:values.at(-1)};
}
// A known 10 mm plane offset checks world-unit conversion and both directions.
const syntheticA=new BufferGeometry(),syntheticB=new BufferGeometry();
for(const [g,z] of [[syntheticA,0],[syntheticB,.01]]) {
  g.setAttribute('position',new BufferAttribute(new Float32Array([0,0,z,.1,0,z,0,.1,z]),3));
  g.setIndex([0,1,2]);g.boundsTree=new MeshBVH(g);
}
const syntheticCheck={forward:distribution(syntheticA,syntheticB),reverse:distribution(syntheticB,syntheticA)};
assert.ok(Math.abs(syntheticCheck.forward.p95Mm-10)<.00001);
assert.ok(Math.abs(syntheticCheck.reverse.p95Mm-10)<.00001);
syntheticA.dispose();syntheticB.dispose();
const targetDoc=await io.read(files[0]), sourceDoc=await io.read(files[1]);
function uniqueNodes(nodes, nameOf) {
  const map=new Map();
  for(const node of nodes){const name=normalize(nameOf(node));
    assert.ok(!map.has(name),`normalized vessel name collision: ${name}`);map.set(name,node);}
  return map;
}
const target = uniqueNodes(targetDoc.getRoot().listNodes().filter(n=>n.getMesh()&&names.has(n.getName())),n=>names.get(n.getName()));
const source = uniqueNodes(sourceDoc.getRoot().listNodes().filter(n=>n.getMesh()),n=>n.getName());
const matched=[...target.keys()].filter(name=>source.has(name)).sort();
assert.equal(matched.length,registration.holdout.length);
assert.deepEqual(matched,registration.holdout.map(r=>r.name).sort());
const rows=[];
for(const name of matched) {
  const a=geometry(source.get(name)), b=geometry(target.get(name));
  a.scale(registration.scale, registration.scale, registration.scale);
  a.translate(...registration.translation);
  const sourceBounds=bounds(a),targetBounds=bounds(b),sourceCenter=sourceBounds.center,targetCenter=targetBounds.center;
  const centerResidualMm=1000*Math.hypot(...sourceCenter.map((v,i)=>v-targetCenter[i]));
  const old=registration.holdout.find(r=>r.name===name);
  assert.ok(Math.abs(centerResidualMm-old.afterMm)<.01, `${name}: center mismatch with registration audit`);
  a.boundsTree=new MeshBVH(a);b.boundsTree=new MeshBVH(b);
  rows.push({name,sourceNode:source.get(name).getName(),targetNode:target.get(name).getName(),
    sourceVertices:a.getAttribute('position').count,targetVertices:b.getAttribute('position').count,
    sourceTriangles:a.getIndex().count/3,targetTriangles:b.getIndex().count/3,
    sourceBounds,targetBounds,centerResidualMm,
    sourceToTarget:distribution(a,b),targetToSource:distribution(b,a)});
  console.log(JSON.stringify({name,centerResidualMm,sourceToTargetP95Mm:rows.at(-1).sourceToTarget.p95Mm,
    targetToSourceP95Mm:rows.at(-1).targetToSource.p95Mm}));
  a.dispose();b.dispose();
}
const report={status:'deployed male overview surface diagnostic; no registration change or clinical approval',
  createdAt:new Date().toISOString(),files:hashes,syntheticCheck,registration:{scale:registration.scale,translation:registration.translation},
  scope:'39 same-name BP3/Z-Anatomy vascular pairs; all referenced vertices in both directions after current shared neural registration',
  limitations:['Same names may cover different source extents or branch segmentation.',
    'Vertex-to-surface distances are not continuous surface Hausdorff distances, solid penetration depths, vascular continuity, or clinical error.',
    'Female HRA, independent organ details, nonmatching vessels and vessel-to-organ/nerve relations are not tested.'],
  summary:{centerResidualMm:summarize(rows,'centerResidualMm'),sourceToTargetP95Mm:summarize(rows.map(r=>({value:r.sourceToTarget.p95Mm})),'value'),
    targetToSourceP95Mm:summarize(rows.map(r=>({value:r.targetToSource.p95Mm})),'value')},rows};
fs.writeFileSync('docs/anatomy-alignment/male-vessel-surfaces.json',JSON.stringify(report,null,2)+'\n');
