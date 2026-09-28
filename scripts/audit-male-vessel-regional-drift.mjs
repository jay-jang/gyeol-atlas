import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {Matrix4,Vector3} from 'three';
import {fitRigid} from './lib/rigid-fit.mjs';
import {fitSimilarity} from './lib/similarity-fit.mjs';

const input='docs/anatomy-alignment/male-vessel-surfaces.json';
const source=JSON.parse(fs.readFileSync(input));
const sha256=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
for(const [path,hash] of Object.entries(source.files))assert.equal(sha256(path),hash,path);
assert.equal(source.rows.length,39);
const regionOf=y=>y>=1.35?'head-neck':y>=1.18?'thorax':y>=.92?'abdomen':'pelvis-leg';
const regions=['head-neck','thorax','abdomen','pelvis-leg'];
const rows=source.rows.map(row=>({name:row.name,region:regionOf(row.targetBounds.center[1]),
  sourceCenter:row.sourceBounds.center,targetCenter:row.targetBounds.center,
  centerResidualMm:row.centerResidualMm,sourceToTargetP95Mm:row.sourceToTarget.p95Mm,targetToSourceP95Mm:row.targetToSource.p95Mm}));
const summary=regions.map(region=>{
  const group=rows.filter(row=>row.region===region);
  const stats=key=>{
    const numbers=group.map(row=>row[key]).sort((a,b)=>a-b);
    return {minimumMm:numbers[0],medianMm:numbers[Math.floor((numbers.length-1)/2)],maximumMm:numbers.at(-1)};
  };
  return {region,count:group.length,centerResidual:stats('centerResidualMm'),
    sourceToTargetP95:stats('sourceToTargetP95Mm'),targetToSourceP95:stats('targetToSourceP95Mm')};
});
const thorax=rows.filter(row=>row.region==='thorax');
assert.equal(thorax.length,8);
const from=thorax.map(row=>new Vector3(...row.sourceCenter)),onto=thorax.map(row=>new Vector3(...row.targetCenter));
const average=points=>points.reduce((sum,p)=>sum.add(p),new Vector3()).divideScalar(points.length);
const delta=average(onto).sub(average(from));
const fits=[['translation',new Matrix4().makeTranslation(...delta.toArray())],
  ['rigid',fitRigid(from,onto)],['similarity',fitSimilarity(from,onto)]].map(([mode,matrix])=>{
  const measures=rows.map(row=>{
    const previous=row.centerResidualMm;
    const candidate=new Vector3(...row.sourceCenter).applyMatrix4(matrix).distanceTo(new Vector3(...row.targetCenter))*1000;
    return {name:row.name,region:row.region,previousMm:previous,candidateMm:candidate,changeMm:candidate-previous};
  });
  const regionSummary=regions.map(region=>{
    const group=measures.filter(row=>row.region===region);
    const mean=key=>group.reduce((sum,row)=>sum+row[key],0)/group.length;
    return {region,count:group.length,previousMeanMm:mean('previousMm'),candidateMeanMm:mean('candidateMm'),
      worsenedCount:group.filter(row=>row.changeMm>1e-8).length,
      maximumWorseningMm:Math.max(0,...group.map(row=>row.changeMm))};
  });
  return {mode,scale:Math.cbrt(matrix.determinant()),matrix:matrix.toArray(),regionSummary,measures};
});
const result={scope:'Read-only regional screen of 39 existing same-name vessel surface pairs. Chest-trained global transforms are not accepted registrations or anatomical corrections.',
  sourceReport:{path:input,sha256:sha256(input),sourceFiles:source.files},
  regionRule:'Source target AABB center y: head-neck >=1.35 m; thorax >=1.18; abdomen >=0.92; otherwise pelvis-leg. UI audit bins, not clinical body boundaries.',
  rows,summary,thoraxTrainingNames:thorax.map(row=>row.name),fits,
  files:['scripts/audit-male-vessel-regional-drift.mjs','scripts/lib/rigid-fit.mjs','scripts/lib/similarity-fit.mjs'].map(path=>({path,sha256:sha256(path)}))};
fs.writeFileSync('docs/anatomy-alignment/male-vessel-regional-drift.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({summary,fits:fits.map(fit=>({mode:fit.mode,scale:fit.scale,regions:fit.regionSummary}))}));
