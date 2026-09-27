import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const auditPath='.cache/brain-pairs/audit.json',audit=JSON.parse(fs.readFileSync(auditPath));
const atlasPath='public/models/female/atlas-female.json',atlas=JSON.parse(fs.readFileSync(atlasPath));
const provenance=JSON.parse(fs.readFileSync('data/catalog/female-brain-provenance.json'));
assert.equal(audit.sourceSha256,provenance.sourceSha256);
assert.equal(audit.codeSha256,sha('scripts/audit-brain-pair-geometry.mjs'));
for(const file of audit.files)assert.equal(sha(file.path),file.sha256);
assert.equal(sha(atlasPath),provenance.atlasSha256);
assert.equal(audit.pairs,141);assert.equal(audit.completeTriangleCorrespondencePairs,141);
assert.ok(audit.maxCentroidFitSurfaceResidualMm<.025);
for(const control of audit.symmetryPlane.controls)assert.ok(control.sourceName.endsWith('_L')?control.signedSymmetryPlaneMm>0:control.signedSymmetryPlaneMm<0);
const records=[];
for(const row of audit.rows){
  assert.ok(row.leftSignedPlaneMm<0&&row.rightSignedPlaneMm>0);
  for(const [id,partnerId] of [[row.left,row.right],[row.right,row.left]]){
    const part=atlas.parts.find(p=>p.id===id),partner=atlas.parts.find(p=>p.id===partnerId);
    assert.equal(part.system,'brain');assert.equal(partner.system,'brain');
    assert.equal(provenance.parts.find(p=>p.id===id).origin,'allen-reference');
    records.push({id,name:part.name,partnerId,partnerName:partner.name});
  }
}
assert.equal(new Set(records.map(r=>r.id)).size,282);
assert.equal(new Set(records.map(r=>r.partnerId)).size,282);
assert.ok(records.every(r=>r.id!=='HRAF0070'&&r.partnerId!=='HRAF0070'));
records.sort((a,b)=>a.id.localeCompare(b.id));
fs.writeFileSync('data/catalog/female-brain-bindings.json',JSON.stringify({version:'hra-female-v1.10-laterality-1',
  atlasSha256:provenance.atlasSha256,sourceSha256:provenance.sourceSha256,auditSha256:sha(auditPath),
  scope:'Canonical selection IDs/names use the intact opposite-labelled Allen geometry. No reflection, deformation or normal/index modification. Optic chiasm excluded. Not a general position/connection correction.',records},null,2)+'\n');
console.log(`Built ${records.length} bijective Allen geometry bindings; native optic chiasm excluded.`);
