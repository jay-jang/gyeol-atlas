// Offline comparison of two reconstructions of Visible Human Female.
// One common proper similarity; no per-bone fitting, deformation or app export.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Matrix4, Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {MeshBVH} from 'three-mesh-bvh';
import {exactPositionComponents} from './lib/exact-position-components.mjs';
import {fitSimilarity} from './lib/similarity-fit.mjs';

const originalTarget = process.argv.includes('--original-target');
const out = originalTarget ? '.cache/bonehub-denver-original-frame' : '.cache/bonehub-denver-frame';
fs.mkdirSync(out, {recursive:true});
const tracked = new Map();
function bytes(file) {
  const b = fs.readFileSync(file);
  tracked.set(file, createHash('sha256').update(b).digest('hex'));
  return b;
}
const read = file => JSON.parse(bytes(file));
const denver = read('docs/anatomy-alignment/donor-source-comparison.json');
const bonehub = read('docs/anatomy-alignment/bonehub-female-inventory.json');
const receipt = read('docs/anatomy-alignment/bonehub-female-receipt.json');
const previous = read('docs/anatomy-alignment/donor-feet-audit.json');
const referencePath = previous.files.find(f => f.file.endsWith('/Left/VHF_Left_Bone_Talus_smooth.stl')).file;
const denverRoot = path.dirname(path.dirname(referencePath));
const names = {
  Femur:'FEMUR', Tibia:'TIBIA', Fibula:'FIBULA', Patella:'PATELLA', Pelvis:'HIP',
  Talus:'TALUS', Calcaneous:'CALCANEUS', Navicular:'NAVICULAR', Cuboid:'CUBOID',
  LateralCuneiform:'LATERAL_CUNEIFORM', MedialCuneiform:'MEDIAL_CUNEIFORM', IntermediateCuneiform:'INTERMEDIATE_CUNEIFORM',
};
let originalRoot;
if (originalTarget) {
  const archive = '/Users/nuinuri/Downloads/Original 3D STL Models-stl.zip';
  bytes(archive);
  assert.equal(tracked.get(archive), 'cabc34be5b6d9ebed92983257aec8c394bbca658bb7d218cb4a48d84ba4cc5eb');
  const members = ['Left', 'Right'].flatMap(side => Object.keys(names).map(name => `Original 3D STL Models-stl/${side}/VHF_${side}_Bone_${name}.stl`));
  // Explicit members and never overwrite an existing extracted source.
  execFileSync('unzip', ['-nq', archive, ...members, '-d', `${out}/source`]);
  originalRoot = `${out}/source/Original 3D STL Models-stl`;
}
const training = new Set(['Femur', 'Tibia', 'Fibula', 'Patella', 'Pelvis']);
function load(file, expected) {
  const b = bytes(file); if (expected) assert.equal(tracked.get(file), expected, file);
  const raw = new STLLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const {geometry, components} = exactPositionComponents(raw); raw.dispose();
  geometry.userData.components = components;
  geometry.computeBoundingBox(); return geometry;
}
const pairs = [];
for (const side of ['left', 'right']) for (const [name, hubName] of Object.entries(names)) {
  const d = denver.files.find(f => f.kind === 'bone' && f.side === side && f.structure === name);
  const h = bonehub.parts.find(p => p.name === `${hubName}_${side.toUpperCase()}`);
  assert.ok(d && h);
  const titleSide = side === 'left' ? 'Left' : 'Right';
  const originalFile = originalTarget ? `${originalRoot}/${titleSide}/VHF_${titleSide}_Bone_${name}.stl` : null;
  // Read the archive member again and compare cached extraction byte-for-byte.
  if (originalTarget) {
    const archiveMember = `Original 3D STL Models-stl/${titleSide}/VHF_${titleSide}_Bone_${name}.stl`;
    const archived = execFileSync('unzip', ['-p', '/Users/nuinuri/Downloads/Original 3D STL Models-stl.zip', archiveMember], {maxBuffer:256*1024*1024});
    assert.equal(createHash('sha256').update(archived).digest('hex'), createHash('sha256').update(fs.readFileSync(originalFile)).digest('hex'));
  }
  const dg = load(originalTarget ? originalFile : path.join(denverRoot, d.file), originalTarget ? null : d.sha256);
  const hg = load(receipt.files.find(f => f.path === h.file).local, h.sha256);
  pairs.push({side, name, sourceName:h.name, fitLandmark:training.has(name), dg, hg,
    dc:dg.boundingBox.getCenter(new Vector3()), hc:hg.boundingBox.getCenter(new Vector3())});
}
assert.equal(pairs.length, 24);
const fitPairs = pairs.filter(p => p.fitLandmark);
const initialMatrix = fitSimilarity(fitPairs.map(p => p.hc), fitPairs.map(p => p.dc));
let matrix = initialMatrix.clone();
const sampledIndices = g => Array.from({length:Math.min(512, g.attributes.position.count)}, (_, i) =>
  Math.floor(i * (g.attributes.position.count-1) / (Math.min(512, g.attributes.position.count)-1)));
const trainingSurfaces = fitPairs.map(p => {
  const source = p.hg.clone(), target = p.dg.clone();
  return {...p, source, target, sourceTree:new MeshBVH(source), targetTree:new MeshBVH(target),
    sourceIndices:sampledIndices(p.hg), targetIndices:sampledIndices(p.dg)};
});
const iterations = [];
for (let iteration = 0; iteration < 240; iteration++) {
  const inverse = matrix.clone().invert(), from = [], onto = [];
  for (const p of trainingSurfaces) {
    const forward = p.sourceIndices.map(i => {
      const source = new Vector3().fromBufferAttribute(p.hg.attributes.position, i);
      const q = p.targetTree.closestPointToPoint(source.clone().applyMatrix4(matrix));
      return {source, target:q.point.clone(), distance:q.distance};
    });
    const reverse = p.targetIndices.map(i => {
      const target = new Vector3().fromBufferAttribute(p.dg.attributes.position, i);
      const q = p.sourceTree.closestPointToPoint(target.clone().applyMatrix4(inverse));
      return {source:q.point.clone(), target, distance:q.point.clone().applyMatrix4(matrix).distanceTo(target)};
    });
    // Equal sample budget per named bone and direction. Trim the farthest 20%
    // within each direction, not whole bones; preserve all pairs in final audit.
    for (const matches of [forward, reverse]) {
      matches.sort((a,b) => a.distance-b.distance);
      for (const m of matches.slice(0, Math.floor(matches.length*.8))) {from.push(m.source); onto.push(m.target);}
    }
  }
  const next = fitSimilarity(from, onto);
  const maximumCentreChangeMm = Math.max(...fitPairs.map(p => p.hc.clone().applyMatrix4(matrix).distanceTo(p.hc.clone().applyMatrix4(next))));
  iterations.push({iteration, correspondences:from.length, maximumCentreChangeMm, scale:Math.cbrt(next.determinant())});
  matrix = next;
  if (maximumCentreChangeMm < 1e-5) break;
}
for (const p of trainingSurfaces) {p.source.dispose(); p.target.dispose();}
const scale = Math.cbrt(matrix.determinant());
assert.ok(scale > 0);
// AABB centres are approximate geometric anchors, not anatomical landmarks.
// Held-out tarsals do not influence the fitted matrix.
const transformed = pairs.map(p => ({...p, placed:p.hg.clone().applyMatrix4(matrix)}));
function nearest(from, to) {
  const g = to.clone(), tree = new MeshBVH(g), point = new Vector3();
  const distances = [], position = from.getAttribute('position');
  let maximum = null, sum = 0, squares = 0;
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    const hit = tree.closestPointToPoint(point), distance = hit.distance;
    distances.push(distance); sum += distance; squares += distance * distance;
    if (!maximum || distance > maximum.distanceMm) maximum = {vertex:i, point:point.toArray(), nearest:hit.point.toArray(), distanceMm:distance};
  }
  distances.sort((a,b) => a-b); g.dispose();
  return {vertices:position.count, meanMm:sum / position.count, rmsMm:Math.sqrt(squares / position.count),
    p50Mm:distances[Math.floor(.5 * (distances.length-1))], p95Mm:distances[Math.floor(.95 * (distances.length-1))], maximum};
}
const records = [];
for (const p of transformed) {
  const row = {side:p.side, name:p.name, bonehubName:p.sourceName, fitLandmark:p.fitLandmark,
    sourceComponents:p.hg.userData.components, targetComponents:p.dg.userData.components,
    bonehubCentreLpsMm:p.hc.toArray(), denverCentreMm:p.dc.toArray(),
    initialCentreResidualMm:p.hc.clone().applyMatrix4(initialMatrix).distanceTo(p.dc),
    fittedCentreResidualMm:p.hc.clone().applyMatrix4(matrix).distanceTo(p.dc),
    sourceTriangles:p.hg.index.count/3, targetTriangles:p.dg.index.count/3,
    bonehubToDenver:nearest(p.placed, p.dg), denverToBonehub:nearest(p.dg, p.placed)};
  const centre = component => new Vector3(...component.bounds[0].map((v,k) => (v+component.bounds[1][k])/2));
  row.dominantComponentCentreResidualMm = centre(row.sourceComponents[0]).applyMatrix4(matrix).distanceTo(centre(row.targetComponents[0]));
  records.push(row);
  console.log(JSON.stringify({side:p.side, name:p.name, fitLandmark:p.fitLandmark,
    centreMm:row.fittedCentreResidualMm, forwardP95:row.bonehubToDenver.p95Mm, reverseP95:row.denverToBonehub.p95Mm}));
}
const report = {createdAt:new Date().toISOString(), status:'SOURCE FRAME CANDIDATE ONLY; no HRA registration or runtime export',
  targetStage:originalTarget ? 'Denver Original' : 'Denver Final',
  sourceRevision:bonehub.revision, sourceUnits:'millimetres', targetUnits:'millimetres',
  method:'One proper similarity initialized with ten bilateral lower-extremity AABB centres and refined by symmetric trimmed sampled surface ICP on those same ten pairs; fourteen tarsal pairs held out. Full referenced vertices in both final surface-distance directions.',
  initialMatrixColumnMajor:initialMatrix.toArray(), refinement:{samplePerBonePerDirection:512, retainedFraction:.8, maximumIterations:240, stopCentreChangeMm:1e-5,
    stopReason:iterations.at(-1).maximumCentreChangeMm < 1e-5 ? 'centre-change threshold' : 'iteration limit', iterations},
  matrixColumnMajor:matrix.toArray(), determinant:matrix.determinant(), uniformScale:scale,
  fitPairs:fitPairs.length, heldOutPairs:pairs.length-fitPairs.length, records,
  limitations:['AABB centres are not anatomical landmarks. Nearest surface distances do not establish pointwise anatomical correspondence.',
    'Disconnected source fragments remain in fitting samples and full final distance checks; dominant-component centres are supplementary diagnostics, never a silent geometry deletion.',
    'This compares BoneHub to the recorded Denver source stage, not to the HRA skin, brain, nerves or current borrowed bones.',
    'Different segmentation, smoothing, final overclosure adjustments and source granularity can leave residual differences even with shared imaging provenance.',
    'No individual toe phalanx mapping, clinical alignment approval, shape deformation or runtime replacement is inferred.']};
for (const f of ['scripts/audit-bonehub-denver-frame.mjs', 'scripts/lib/similarity-fit.mjs', 'scripts/lib/exact-position-components.mjs', 'package-lock.json']) bytes(f);
report.files = [...tracked].map(([file, sha256]) => ({file, sha256}));
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
for (const p of transformed) {p.dg.dispose(); p.hg.dispose(); p.placed.dispose();}
