// Independent binary/ASCII scalar reader checks counts, source bounds and the
// recorded maximum-distance query vertices. Does not re-prove nearest surfaces.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash = f => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const records = [], files = [];
let transformedOccurrences = 0;
function inspect(file) {
  const b = fs.readFileSync(file), points = [], seen = new Set();
  let occurrences = 0;
  const push = p => {
    p = p.map(Math.fround); assert.ok(p.every(Number.isFinite)); occurrences++;
    const key=p.join('/'); if(!seen.has(key)){seen.add(key);points.push(p);}
  };
  const count = b.length >= 84 ? b.readUInt32LE(80) : 0;
  if (84+50*count === b.length) {
    for(let i=0;i<count;i++)for(let c=0;c<3;c++)push([0,1,2].map(k=>b.readFloatLE(84+50*i+12+12*c+4*k)));
  } else {
    const text=b.toString('utf8'); assert.match(text.trimStart(),/^solid\b/);
    for(const m of text.matchAll(/^\s*vertex\s+(\S+)\s+(\S+)\s+(\S+)\s*$/gm)) push(m.slice(1).map(Number));
    assert.equal(occurrences, [...text.matchAll(/^\s*endfacet\s*$/gm)].length*3);
  }
  assert.ok(occurrences>0 && occurrences%3===0);
  return {points, triangles:occurrences/3};
}
for (const folder of ['bonehub-denver-frame','bonehub-denver-original-frame']) {
  const file=`.cache/${folder}/report.json`, report=JSON.parse(fs.readFileSync(file)), m=report.matrixColumnMajor, s=report.uniformScale;
  files.push({file,sha256:hash(file)});
  for(let a=0;a<3;a++)for(let b=0;b<3;b++) {
    const dot=[0,1,2].reduce((n,k)=>n+m[4*a+k]*m[4*b+k],0);
    assert.ok(Math.abs(dot-(a===b?s*s:0))<1e-10);
  }
  const determinant=m[0]*(m[5]*m[10]-m[9]*m[6])-m[4]*(m[1]*m[10]-m[9]*m[2])+m[8]*(m[1]*m[6]-m[5]*m[2]);
  assert.ok(determinant>0 && Math.abs(determinant-s**3)<1e-10);
  const transform=p=>[0,1,2].map(k=>Math.fround(m[k]*p[0]+m[4+k]*p[1]+m[8+k]*p[2]+m[12+k]));
  for(const r of report.records) {
    const title=r.side==='left'?'Left':'Right', suffix=report.targetStage==='Denver Final'?'_smooth':'';
    const source=report.files.find(f=>f.file.endsWith(`/${r.bonehubName}.stl`));
    const target=report.files.find(f=>f.file.endsWith(`/VHF_${title}_Bone_${r.name}${suffix}.stl`));
    for(const f of [source,target])assert.equal(hash(f.file),f.sha256);
    const a=inspect(source.file), b=inspect(target.file);
    assert.equal(a.triangles,r.sourceTriangles);assert.equal(b.triangles,r.targetTriangles);
    assert.equal(a.points.length,r.bonehubToDenver.vertices);assert.equal(b.points.length,r.denverToBonehub.vertices);
    for(const p of a.points){assert.ok(transform(p).every(Number.isFinite));transformedOccurrences++;}
    for(const [points, witness, transformed] of [[a.points,r.bonehubToDenver.maximum,true],[b.points,r.denverToBonehub.maximum,false]]) {
      const p=transformed?transform(points[witness.vertex]):points[witness.vertex];assert.deepEqual(p,witness.point);
      assert.ok(Math.abs(Math.hypot(...p.map((v,k)=>v-witness.nearest[k]))-witness.distanceMm)<1e-8);
    }
    records.push({stage:report.targetStage,side:r.side,name:r.name,sourceVertices:a.points.length,targetVertices:b.points.length,maximumQueryVerticesMatched:2});
  }
}
const file='scripts/verify-bonehub-denver-frame.mjs';files.push({file,sha256:hash(file)});
fs.writeFileSync('.cache/bonehub-denver-frame/readback.json',JSON.stringify({status:'Source parsing and query-coordinate readback only; not independent nearest-surface validation',
  records,transformedOccurrences,maximumQueryVerticesMatched:records.length*2,files},null,2)+'\n');
console.log(JSON.stringify({pairs:records.length,transformedOccurrences,maximumQueryVerticesMatched:records.length*2}));
