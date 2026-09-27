import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const bytes = name => fs.readFileSync(new URL(`../docs/anatomy-alignment/${name}.json`, import.meta.url));
const read = name => JSON.parse(bytes(name));
const digest = data => createHash('sha256').update(data).digest('hex');

test('BoneHub receipt preserves pinned female bone-only source membership', () => {
  const receipt = read('bonehub-female-receipt'), inventory = read('bonehub-female-inventory');
  assert.equal(receipt.revision, 'ac8de2b38f5ae1a0996053ca0639dd6ae43358f1');
  assert.equal(inventory.revision, receipt.revision);
  assert.equal(receipt.license, 'CC-BY-4.0');
  assert.equal(receipt.subject.gender, 'female');
  assert.equal(receipt.files.length, 157);
  assert.equal(receipt.files.reduce((n, f) => n + f.bytes, 0), 319449859);
  const hashed = receipt.files.filter(f => f.publishedLfsSha256);
  assert.equal(hashed.length, 154);
  for (const file of hashed) assert.equal(file.sha256, file.publishedLfsSha256);
  assert.equal(inventory.parts.length, 143);
  assert.equal(new Set(inventory.parts.map(p => p.name)).size, 143);
  assert.equal(inventory.parts.reduce((n, p) => n + p.triangles, 0), 6072988);
  for (const part of inventory.parts) {
    assert.equal(part.name, part.label.name);
    assert.equal(part.sha256, receipt.files.find(f => f.path === part.file).sha256);
  }
  assert.deepEqual(inventory.parts.filter(p => p.label.status === 'completed').map(p => p.name), ['METATARSAL_1_LEFT']);
  assert.match(receipt.status, /no atlas registration or runtime replacement/);
});

test('only the two foot payloads have full voxel evidence, with compound digit labels retained', () => {
  const report = read('bonehub-female-foot-labels'), inventory = read('bonehub-female-inventory');
  assert.equal(report.reports.length, 2);
  assert.deepEqual(report.reports.map(r => r.labels.reduce((n, l) => n + l.voxels, 0)), [380570, 383717]);
  for (const foot of report.reports) {
    assert.equal(foot.bytes, 1557443140);
    assert.equal(foot.labels.length, 17);
    assert.equal(foot.labels.filter(l => l.name.startsWith('METATARSAL_')).length, 5);
    assert.equal(foot.labels.filter(l => l.name.startsWith('PHALANGE_FOOT_')).length, 5);
    for (const label of foot.labels) {
      assert.ok(label.voxels > 0);
      assert.equal(label.stlSha256, inventory.parts.find(p => p.name === label.name).sha256);
    }
  }
  for (const [suffix, name] of [['/inventory.json', 'bonehub-female-inventory'], ['/receipt.json', 'bonehub-female-receipt']]) {
    assert.equal(report.files.find(f => f.file.endsWith(suffix)).sha256, digest(bytes(name)));
  }
});

test('foot pose evidence does not promote sampled containment or collision absence to acceptance', () => {
  const sampled = read('donor-foot-pose-sampled'), full = read('donor-foot-pose-full'), hard = read('donor-foot-pose-hard');
  assert.equal(sampled.sides[1].best.outside, 0);
  assert.equal(sampled.sides[1].summary.outside, 325);
  assert.deepEqual(full.sides.map(s => s.summary.strictCrossingPairs), [1, 1]);
  assert.equal(hard.hardSurfaceClearance, true);
  assert.deepEqual(hard.sides.map(s => s.summary.strictCrossingPairs), [0, 0]);
  assert.deepEqual(hard.sides.map(s => s.summary.outside), [2535, 73]);
  for (const report of [sampled, full, hard]) {
    assert.match(report.status, /no runtime export or anatomical approval/);
    assert.ok(report.sides.every(s => s.summary.maxOutsideMm > 2));
  }
});

test('independent foot readback is tied to all three exact refinement reports', () => {
  const readback = read('donor-foot-pose-readback');
  assert.equal(readback.vertices, 496548);
  assert.equal(readback.triangleOccurrences, 992808);
  assert.equal(readback.checks.length, 96);
  assert.ok(readback.checks.every(c => c.maximumResidualMetres === 0));
  for (const [suffix, name] of [['/refined.json', 'donor-foot-pose-sampled'], ['/refined-full.json', 'donor-foot-pose-full'], ['/refined-hard.json', 'donor-foot-pose-hard']]) {
    assert.equal(readback.files.find(f => f.file.endsWith(suffix)).sha256, digest(bytes(name)));
  }
});
