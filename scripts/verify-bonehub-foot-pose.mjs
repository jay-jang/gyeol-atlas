// Binary STL triangle corners -> unit conversion -> shank similarity -> rigid
// pose, independently recomputed with scalar arithmetic and Float32 boundaries.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const mode=process.argv[2]||'sampled';assert.ok(['sampled','full'].includes(mode));
const out='.cache/bonehub-foot',hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const initial=JSON.parse(fs.readFileSync(`${out}/initial.json`)),report=JSON.parse(fs.readFileSync(`${out}/pose-${mode}.json`));
for(const r of [initial,report])for(const f of r.files)assert.equal(hash(f.file),f.sha256,f.file);
const before=JSON.parse(fs.readFileSync(initial.parts)),after=JSON.parse(fs.readFileSync(`${out}/pose-${mode}-parts.json`));
const receipt=JSON.parse(fs.readFileSync('docs/anatomy-alignment/bonehub-female-receipt.json'));
const move=(p,m)=>[0,1,2].map(k=>Math.fround(p[0]*m[k]+p[1]*m[4+k]+p[2]*m[8+k]+m[12+k]));
const checks=[];let corners=0;
for(const side of initial.sides){
  const poseSide=report.sides.find(s=>s.side===side.side),parts=before.filter(p=>p.kind==='donor'&&p.side===side.side);assert.equal(parts.length,17);
  for(const snapshot of poseSide.snapshots){
    const m=snapshot.rigidMatrix;
    for(let a=0;a<3;a++)for(let b=0;b<3;b++)assert.ok(Math.abs([0,1,2].reduce((n,k)=>n+m[a*4+k]*m[b*4+k],0)-(a===b?1:0))<1e-12);
    const det=m[0]*(m[5]*m[10]-m[9]*m[6])-m[4]*(m[1]*m[10]-m[9]*m[2])+m[8]*(m[1]*m[6]-m[5]*m[2]);assert.ok(Math.abs(det-1)<1e-12);
    for(const part of parts){
      const f=receipt.files.find(f=>f.path===part.sourceFile);assert.equal(hash(f.local),part.sourceSha256);
      const b=fs.readFileSync(f.local),triangles=b.readUInt32LE(80);assert.equal(b.length,84+50*triangles);
      const result=after.find(p=>p.side===side.side&&p.variant===snapshot.variant&&p.structure===part.structure);assert.ok(result);
      assert.deepEqual(result.indices,part.indices);assert.equal(result.positions.length,part.positions.length);assert.equal(result.indices.length,3*triangles);
      for(let t=0;t<triangles;t++)for(let c=0;c<3;c++){
        const source=[0,1,2].map(k=>Math.fround(b.readFloatLE(84+50*t+12+12*c+4*k)*.001));
        const expectedInitial=move(source,side.sourceToAtlasMatrix),index=part.indices[t*3+c];
        assert.deepEqual(part.positions.slice(index*3,index*3+3),expectedInitial);
        assert.deepEqual(result.positions.slice(index*3,index*3+3),move(expectedInitial,m));corners++;
      }
      checks.push({side:side.side,variant:snapshot.variant,structure:part.structure,triangles,vertices:part.positions.length/3,maximumCoordinateResidualMetres:0});
    }
  }
}
for(const p of before.filter(p=>p.kind!=='donor')){
  const unchanged=after.find(q=>q.kind===p.kind&&q.side===p.side&&q.structure===p.structure);assert.ok(unchanged);
  assert.deepEqual(unchanged.positions,p.positions);assert.deepEqual(unchanged.indices,p.indices);
}
const files=[`${out}/initial.json`,`${out}/pose-${mode}.json`,`${out}/pose-${mode}-parts.json`,'scripts/verify-bonehub-foot-pose.mjs'];
fs.writeFileSync(`${out}/readback-${mode}.json`,JSON.stringify({mode,status:'All source corner arithmetic and fixed targets verified; not clinical or containment approval',checks,triangleCornerOccurrences:corners,
  files:files.map(file=>({file,sha256:hash(file)}))},null,2)+'\n');
console.log(JSON.stringify({mode,checks:checks.length,triangleCornerOccurrences:corners}));
