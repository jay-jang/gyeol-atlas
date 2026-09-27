// Offline reference-source diagnostic. Never exports a runtime model.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {officialMeshes} from './lib/official-meshes.mjs';
import {reflectedMeshCorrespondence} from './lib/reflected-mesh-correspondence.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
const read = p => fs.readFileSync(p), json = p => JSON.parse(read(p));
const specFile = 'data/catalog/female-knee-source-restoration.json', spec = json(specFile);
const source = read(spec.sourceFile); assert.equal(sha(source), spec.sourceSha256);
const pairs = spec.records.filter(r => /_L$|_left_/.test(r.sourceName)).map(left => {
  const name = left.sourceName.replace(/_L$/, '_R').replace('_left_', '_right_');
  const right = spec.records.find(r => r.sourceName === name); assert.ok(right, name);
  return {leftId: left.id, rightId: right.id, left: left.sourceName, right: right.sourceName, category: 'restored-knee-part'};
});
assert.equal(pairs.length, 19);
for (const [leftId, rightId, left, right] of [
  ['HRAF0933', 'HRAF0904', 'VH_F_left_tibial_collateral_ligament', 'VH_F_right_tibial_collateral_ligament'],
  ['HRAF0934', 'HRAF0905', 'VH_F_anterior_cruciate_ligament_of_knee_L', 'VH_F_anterior_cruciate_ligament_of_knee_R'],
  ['HRAF0935', 'HRAF0906', 'VH_F_posterior_cruciate_ligament_of_knee_L', 'VH_F_posterior_cruciate_ligament_of_knee_R'],
  ['HRAF0931', 'HRAF0908', 'VH_F_fibular_collateral_ligament_L', 'VH_F_fibular_collateral_ligament_R'],
]) pairs.push({leftId, rightId, left, right, category: 'native-knee-ligament'});
const names = pairs.flatMap(p => [p.left, p.right]); assert.equal(new Set(names).size, 46);
const atlasFile = 'public/models/female/atlas-female.json', atlas = json(atlasFile);
for (const pair of pairs) for (const side of ['left', 'right']) {
  const part = atlas.parts.find(p => p.id === pair[`${side}Id`]); assert.ok(part);
  assert.equal(part.conceptId, `HRA:${pair[side].slice('VH_F_'.length)}`);
}
const meshes = officialMeshes(source, names, [0, 0, 0]);
const independentlyDecoded = await new NodeIO().readBinary(source);
const decoded = new Map();
for (const name of names) {
  const nodes = independentlyDecoded.getRoot().listNodes().filter(n => n.getName() === name);
  assert.equal(nodes.length, 1);
  const node = nodes[0], primitives = node.getMesh().listPrimitives(); assert.equal(primitives.length, 1);
  // All audited source nodes currently have identity world transforms. Fail
  // rather than accidentally compare local coordinates after a source change.
  assert.deepEqual(Array.from(node.getWorldMatrix()), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const primitive = primitives[0]; assert.equal(primitive.getMode(), 4);
  const positions = primitive.getAttribute('POSITION').getArray(), indices = primitive.getIndices().getArray();
  const g = meshes.get(name).geometry;
  assert.deepEqual(Array.from(positions), Array.from(g.attributes.position.array));
  assert.deepEqual(Array.from(indices), Array.from(g.index.array));
  decoded.set(name, {positions, indices});
}
const records = pairs.map(pair => {
  const result = reflectedMeshCorrespondence(decoded.get(pair.left), decoded.get(pair.right));
  const {mapping, ...statistics} = result;
  const bytes = Buffer.alloc(mapping.length * 4); mapping.forEach((v, i) => bytes.writeUInt32LE(v, i * 4));
  return {...pair, ...statistics, mappingSha256: sha(bytes)};
});
const donorFile = 'docs/anatomy-alignment/donor-source-comparison.json', donor = json(donorFile);
const donorRoot = process.argv[2]; assert.ok(donorRoot, 'Pass the extracted Final 3D STL Models-stl directory');
// Direct binary STL decoding, no welding, remeshing or fitting. Area units mm².
function areaOfStl(file) {
  const bytes = read(path.join(donorRoot, file.file)); assert.equal(sha(bytes), file.sha256);
  const triangles = bytes.readUInt32LE(80); assert.equal(bytes.length, 84 + 50 * triangles);
  let area = 0;
  for (let i = 0; i < triangles; i++) {
    const points = Array.from({length: 9}, (_, k) => bytes.readFloatLE(84 + 50 * i + 12 + 4 * k));
    assert.ok(points.every(Number.isFinite));
    const u = [0, 1, 2].map(k => points[3 + k] - points[k]);
    const v = [0, 1, 2].map(k => points[6 + k] - points[k]);
    area += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
  }
  return {file: file.file, sha256: file.sha256, triangles, areaSquareMm: area};
}
const donorAreaPairs = ['Pelvis', 'Femur', 'Patella', 'Tibia', 'Fibula'].map(name => {
  const sides = ['left', 'right'].map(side => {
    const files = donor.files.filter(f => f.side === side && f.kind === 'bone' && f.structure === name);
    assert.equal(files.length, 1); return areaOfStl(files[0]);
  });
  const [left, right] = sides;
  return {name, left, right, relativeAreaDifferencePercent: 200 * Math.abs(left.areaSquareMm - right.areaSquareMm) / (left.areaSquareMm + right.areaSquareMm)};
});
const result = {
  createdAt: new Date().toISOString(), status: 'SOURCE GEOMETRY AUDIT ONLY; no runtime correction',
  sourceFile: spec.sourceFile, sourceSha256: sha(source), frame: 'Official GLB world coordinates in metres; no app skin translation',
  decoderCheck: {meshes: names.length, positionScalars: [...decoded.values()].reduce((n, g) => n + g.positions.length, 0), indexReferences: [...decoded.values()].reduce((n, g) => n + g.indices.length, 0), differences: 0},
  transform: 'Per-pair X reflection plus centroid translation; no fitted rotation or scaling',
  pairs: records, donorAreaPairs,
  summary: {pairs: records.length, certifiedPairs: records.filter(r => r.certifiedWithinTolerance).length, topologyEquivalentPairs: records.filter(r => r.topologyEquivalent).length, maximumVertexResidualMm: Math.max(...records.map(r => r.maximumDistance)) * 1000},
  files: [specFile, donorFile, atlasFile, 'scripts/audit-female-source-reflection.mjs', 'scripts/lib/reflected-mesh-correspondence.mjs', 'scripts/lib/official-meshes.mjs'].map(file => ({file, sha256: sha(read(file))})),
  limitations: [
    'Geometry correspondence does not identify which side was produced first, authoring history, donor identity, or anatomical accuracy.',
    'Different per-pair translations are not one anatomical symmetry plane; X reflection plus nonzero tangential translation is not a pure plane reflection.',
    'A complete bijection and triangle-multiset match bound the corresponding piecewise-linear surfaces by the maximum vertex residual; floating-point calculations are not interval-arithmetic certificates.',
    'Failed correspondence does not prove geometric independence: no general rigid/affine search or alternative duplicate-vertex mapping is attempted.',
    'STL areas refer only to the stored triangulations, not true tissue areas. Area differences rule out exact rigid/reflection congruence of these triangulations, not common source provenance or similarity after scaling.',
    'No app model, pose, layer, selection, muscle fit, skin test, vessel/nerve relation or clinical validation changes here.'
  ],
};
fs.mkdirSync('.cache/female-source-reflection', {recursive: true});
fs.writeFileSync('.cache/female-source-reflection/report.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({summary: result.summary, pairs: records.map(r => ({left: r.left, certified: r.certifiedWithinTolerance, topology: r.topologyEquivalent, maxMm: r.maximumDistance * 1000, matched: r.matchedUnoriented, total: r.trianglesLeft, reversed: r.matchedReversedWinding, ambiguous: r.ambiguousWithinTolerance})), donorAreaPairs}, null, 2));
for (const m of meshes.values()) m.geometry.dispose();
