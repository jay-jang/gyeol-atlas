// Build v2 from an immutable v1 baseline, never by reapplying to current v2.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const baselinePath='docs/anatomy-alignment/female-arm-registration-v1.json';
const candidatePath='.cache/arm-registration/thumb-clearance-candidate.json';
const auditPath='.cache/arm-registration/thumb-clearance-candidate-audit.json';
const [baseline,candidate,audit]=[baselinePath,candidatePath,auditPath].map(p=>JSON.parse(fs.readFileSync(p)));
for(const r of [candidate,audit])for(const f of r.files)assert.equal(sha(f.path),f.sha256,f.path);
assert.equal(baseline.version,'female-arm-partial-1');assert.equal(baseline.records.length,60);
assert.equal(audit.parts.length,6);assert.equal(audit.evaluatedPairs,1905);assert.deepEqual(audit.newIntersections,[]);
assert.equal(audit.resolvedIntersections.length,2);assert.equal(audit.newOutside,0);assert.equal(audit.worsenedOutside,0);
assert.ok(audit.afterOutside<audit.beforeOutside);
for(const pair of audit.pairs.filter(p=>p.after)){
  assert.equal(pair.before,true);
  assert.equal(pair.afterCrossings.intersectingTrianglePairs,pair.beforeCrossings.intersectingTrianglePairs);
  assert.ok(pair.afterCrossings.maxTrianglePlaneStraddleExtentMm<=pair.beforeCrossings.maxTrianglePlaneStraddleExtentMm+.001);
}
const ids=new Set(candidate.hands.flatMap(h=>h.records.map(r=>r.id)));assert.equal(ids.size,6);
for(const h of candidate.hands){
  assert.equal(h.records.length,3);
  const m=h.linearFromRegistered,t=h.translationFromRegistered;
  for(let a=0;a<3;a++)for(let b=0;b<3;b++)assert.ok(Math.abs(m[a].reduce((s,x,k)=>s+x*m[b][k],0)-(a===b?1:0))<1e-10);
  for(const r of h.records){
    const base=baseline.records.find(b=>b.id===r.id);assert.ok(base);
    assert.equal(r.sourceId,base.sourceId);assert.equal(r.vertexCount,base.vertexCount);assert.equal(r.indexCount,base.indexCount);
    for(let i=0;i<3;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(r.linear[i][j]-base.linear[i].reduce((s,x,k)=>s+x*m[k][j],0))<1e-10);
    for(let j=0;j<3;j++)assert.ok(Math.abs(r.translation[j]-(base.translation.reduce((s,x,k)=>s+x*m[k][j],0)+t[j]))<1e-10);
  }
}
for(const j of audit.joints.filter(j=>j.names[0].toLowerCase().includes('trapezium'))){
  assert.equal(j.after.triangleSurfacesIntersect,false);assert.ok(j.after.vertexSurfaceMinimumMm<1);
}
const replacements=new Map(candidate.hands.flatMap(h=>h.records).map(r=>[r.id,r]));
const remaining=baseline.screening.afterOutside-audit.beforeOutside+audit.afterOutside;
const output={...baseline,version:'female-arm-partial-2',
  records:baseline.records.map(r=>replacements.get(r.id)||r),
  screening:{...baseline.screening,afterOutside:remaining},
  limitations:[`${remaining} arm/hand referenced points remain outside the 2 mm skin band; other borrowed skeleton and donor muscles remain uncorrected.`,
    'Thumb CMC surface crossings removed, but existing internal MCP/IP surface crossings remain; no cartilage or anatomical validation is asserted.',
    ...baseline.limitations.slice(1)],
  refinement:{baselineVersion:baseline.version,method:'Rigid three-bone thumb rotation plus bounded common clearance translation; no scale or local deformation',
    movedParts:6,checkedVertices:audit.parts.reduce((s,p)=>s+p.vertices,0),beforeOutside:audit.beforeOutside,afterOutside:audit.afterOutside,
    newOutside:0,worsenedOutside:0,bonePairsChecked:audit.evaluatedPairs,newIntersections:0,resolvedIntersections:audit.resolvedIntersections,
    hands:candidate.hands.map(h=>({side:h.side,ids:h.records.map(r=>r.id),linearFromRegistered:h.linearFromRegistered,
      translationFromRegistered:h.translationFromRegistered,rotationNormDegrees:h.rotationNormDegrees,clearance:h.clearance}))},
  evidence:[baselinePath,candidatePath,auditPath,'scripts/build-thumb-refinement.mjs'].map(path=>({path,sha256:sha(path)}))};
fs.writeFileSync(process.argv.includes('--export')?'data/catalog/female-arm-registration.json':'.cache/arm-registration/female-arm-registration-v2.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({version:output.version,armOutsideBefore:baseline.screening.afterOutside,armOutsideAfter:remaining,refinement:output.refinement}));
