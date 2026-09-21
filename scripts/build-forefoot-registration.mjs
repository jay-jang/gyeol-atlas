// Export only the screened non-identity toe groups; preserve all other anatomy.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const candidatePath='.cache/foot-registration/forefoot-clearance-candidate.json',auditPath='.cache/foot-registration/forefoot-clearance-candidate-audit.json';
const candidate=JSON.parse(fs.readFileSync(candidatePath)),audit=JSON.parse(fs.readFileSync(auditPath));
for(const report of [candidate,audit])for(const f of report.files)assert.equal(hash(f.path),f.sha256,f.path);
assert.equal(audit.evaluatedPairs,9165);assert.equal(audit.parts.length,56);
assert.deepEqual(audit.newIntersections,[]);assert.equal(audit.resolvedIntersections.length,7);
assert.equal(audit.newOutside,0);assert.equal(audit.worsenedOutside,0);assert.equal(audit.beforeOutside,2183);assert.equal(audit.afterOutside,1233);
for(const p of audit.pairs.filter(p=>p.after)){
  assert.equal(p.before,true);assert.equal(p.afterCrossings.intersectingTrianglePairs,p.beforeCrossings.intersectingTrianglePairs);
  assert.ok(p.afterCrossings.maxTrianglePlaneStraddleExtentMm<=p.beforeCrossings.maxTrianglePlaneStraddleExtentMm+.001);
}
const atlasPath='public/models/female/atlas-female.json',atlas=JSON.parse(fs.readFileSync(atlasPath));
const groups=candidate.groups.filter(g=>g.chosen.pitch!==0||g.chosen.yaw!==0);assert.equal(groups.length,7);
const records=groups.flatMap(g=>{
  assert.equal(g.clearance.status,'FOUND');assert.ok(g.digit<5);
  const joint=audit.joints.find(j=>j.ids[0]===g.jointIds[0]&&j.ids[1]===g.jointIds[1]);
  assert.ok(joint);assert.equal(joint.after.forward.triangleSurfacesIntersect,false);
  // Numerical guard against gross separation; not an anatomical cartilage target.
  assert.ok(joint.after.forward.vertexSurfaceMinimumMm<1&&joint.after.reverse.vertexSurfaceMinimumMm<1);
  return g.records.map(r=>{
    const part=atlas.parts.find(p=>p.id===r.id);assert.equal(part.system,'borrowed');assert.match(part.name,/phalanx/i);
    const m=r.linear;for(let i=0;i<3;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(m[i].reduce((s,x,k)=>s+x*m[j][k],0)-(i===j?1:0))<1e-10);
    const det=m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
    assert.ok(Math.abs(det-1)<1e-10);
    return {...r,sourceId:part.conceptId.replace('BORROWED:','')};
  });
});assert.equal(records.length,20);assert.equal(new Set(records.map(r=>r.id)).size,20);
const moved=audit.parts.filter(p=>records.some(r=>r.id===p.id));
assert.equal(moved.reduce((s,p)=>s+p.beforeOutside,0),953);assert.equal(moved.reduce((s,p)=>s+p.afterOutside,0),3);
const output={version:'female-foot-partial-1',partial:true,sourceManifestSha256:hash(atlasPath),
  method:'Rigid toe-chain rotation plus bounded common translation; no scaling or local deformation',records,
  screening:{anatomicallyValidated:false,movedParts:20,beforeOutside:953,afterOutside:3,wholeFootBeforeOutside:2183,wholeFootAfterOutside:1233,
    checkedFootVertices:audit.parts.reduce((s,p)=>s+p.vertices,0),newOutside:0,worsenedOutside:0,bonePairsChecked:9165,newIntersections:0,
    resolvedIntersections:audit.resolvedIntersections},
  groups:groups.map(g=>({side:g.side,digit:g.digit,ids:g.records.map(r=>r.id),pivot:g.pivot,pitchAxis:g.pitchAxis,
    pitchDegrees:g.chosen.pitch,yawDegrees:g.chosen.yaw,clearance:g.clearance})),
  limitations:['Fifth rays, heels, ankle intersections, other borrowed bones and donor muscles remain uncorrected.',
    'Existing intratoe surface intersections remain; tissue registration and clinical alignment are not validated.',
    '1233 whole-foot referenced vertices remain outside the 2 mm skin boundary band; this is not complete foot registration.'],
  evidence:[candidatePath,auditPath,atlasPath,'scripts/build-forefoot-registration.mjs'].map(path=>({path,sha256:hash(path)}))};
fs.writeFileSync(process.argv.includes('--export')?'data/catalog/female-foot-registration.json':'.cache/foot-registration/female-foot-registration.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({version:output.version,screening:output.screening}));
