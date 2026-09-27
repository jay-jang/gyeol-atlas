import fs from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = p => JSON.parse(fs.readFileSync(p));
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const audit = read('docs/anatomy-alignment/male-detail-source-audit.json');
const probe = read('docs/anatomy-alignment/pulmonary-source-probe.json');

test('male source audit covers every released detail part without asserting anatomical approval', () => {
  const atlas = read('public/models/male-detail/atlas.json');
  assert.deepEqual(audit.parts.map(p => p.id).sort(), atlas.parts.map(p => p.id).sort());
  assert.deepEqual(audit.summary, { parts: 423, runtimeVertices: 119037, exactSourceVertices: 119037, maximumNearestSourceDistanceMm: 0 });
  assert.equal(audit.parts.reduce((sum, p) => sum+p.runtimeVertices, 0), audit.summary.runtimeVertices);
  for (const part of audit.parts) {
    assert.equal(part.header['Compatibility version'], '4.0');
    assert.equal(part.header['File ID'], part.id.replace('BP4_', ''));
    assert.equal(part.runtimeVertices, part.exactSourceVertices);
    assert.equal(part.maximumNearestSourceDistanceMm, 0);
    assert.match(part.officialObjSha256, /^[a-f0-9]{64}$/);
  }
  for (const file of audit.files.filter(f => !f.file.startsWith('.cache/'))) assert.equal(hash(file.file), file.sha256);
  assert.match(audit.status, /not anatomical approval/);
});

test('official membership differences preserve missing old IDs and do not imply one-to-one replacements', () => {
  assert.deepEqual(audit.groups.map(g => [g.id, g.official40Members, g.official43Members]), [['heart',83,92],['liver',60,66],['lung',280,563]]);
  assert.deepEqual(audit.groups.find(g => g.id === 'lung').absentFrom43, ['FJ2041','FJ2044']);
  for (const group of audit.groups) assert.equal(group.official40Members-group.absentFrom43.length+group.addedIn43.length, group.official43Members);
  assert.match(audit.limitations.join(' '), /not a one-to-one replacement/);
});

test('pulmonary 4.3 probe retains actual headers, same-ID coordinate agreement and unresolved overlaps', () => {
  assert.equal(probe.parts.length, 14);
  assert.equal(new Set(probe.parts.map(p => p.id)).size, 14);
  for (const part of probe.parts) {
    assert.equal(part.header['File ID'], part.id);
    assert.equal(part.header['Compatibility version'], '4.3');
    assert.notEqual(part.listingRepresentation, part.objRepresentation);
    if (part.sameId40Distances) assert.deepEqual(Object.values(part.sameId40Distances), [0,0,0,0,0]);
  }
  assert.equal(probe.parts.filter(p => p.sameId40Distances).length, 7);
  assert.equal(probe.nearbyVersionPairs.length, 7);
  for (const pair of probe.nearbyVersionPairs) {
    assert.ok(pair.forwardMaxMm > 0 && pair.forwardMaxMm < 3.2);
    assert.ok(pair.reverseMaxMm > 0 && pair.reverseMaxMm < 3.2);
  }
  assert.deepEqual(probe.detached40Parts.map(p => Math.round(p.verticalBoxGapMm*100)/100), [212.16,228.03]);
  for (const file of probe.files.filter(f => !f.file.startsWith('.cache/'))) assert.equal(hash(file.file), file.sha256);
  assert.match(probe.status, /no runtime changes/);
  assert.match(probe.limitations.join(' '), /not surface distances/);
});
