// Independent binary STL and scalar affine readback, not a clinical validator.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const out='.cache/bonehub-head',hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const frame=JSON.parse(fs.readFileSync(`${out}/frame.json`)),audit=JSON.parse(fs.readFileSync(`${out}/audit.json`));
for(const report of [frame,audit])for(const f of report.files)assert.equal(hash(f.file),f.sha256,f.file);
const rows=JSON.parse(gunzipSync(fs.readFileSync(frame.parts))),placed=JSON.parse(gunzipSync(fs.readFileSync(audit.placedFile)));
const sourceChecks=[],candidateChecks=[];let corners=0,transformedCorners=0;
for(const p of rows.filter(p=>p.kind==='source')){
  assert.equal(hash(p.sourceFile),p.sha256);const b=fs.readFileSync(p.sourceFile),triangles=b.readUInt32LE(80);assert.equal(b.length,84+50*triangles);assert.equal(p.indices.length,triangles*3);
  assert.equal(p.components.reduce((n,c)=>n+c.triangles,0),triangles);
  for(let t=0;t<triangles;t++)for(let c=0;c<3;c++)for(let k=0;k<3;k++)assert.equal(p.positions[p.indices[t*3+c]*3+k],Math.fround(b.readFloatLE(84+50*t+12+12*c+4*k)*.001));
  corners+=triangles*3;sourceChecks.push({id:p.id,triangles,vertices:p.positions.length/3,components:p.components.length});
}
for(const candidate of frame.candidates){
  const m=candidate.matrixColumnMajor,s=candidate.uniformScale;
  assert.ok(s>0);assert.deepEqual([m[3],m[7],m[11],m[15]],[0,0,0,1]);
  for(let a=0;a<3;a++)for(let b=0;b<3;b++)assert.ok(Math.abs([0,1,2].reduce((n,k)=>n+m[a*4+k]*m[b*4+k],0)-(a===b?s*s:0))<1e-12);
  const det=m[0]*(m[5]*m[10]-m[9]*m[6])-m[4]*(m[1]*m[10]-m[9]*m[2])+m[8]*(m[1]*m[6]-m[5]*m[2]);assert.ok(Math.abs(det-s**3)<1e-12);
  if(candidate.mode!=='similarity')assert.ok(Math.abs(s-1)<1e-12);
  for(const source of rows.filter(p=>p.kind==='source'&&p.id.startsWith('SKULL_'))){
    const p=placed.find(p=>p.id===source.id&&p.variant===candidate.mode);assert.ok(p);assert.deepEqual(p.indices,source.indices);assert.equal(p.positions.length,source.positions.length);
    for(const i of source.indices){const [x,y,z]=source.positions.slice(3*i,3*i+3);for(let k=0;k<3;k++)assert.equal(p.positions[3*i+k],Math.fround(x*m[k]+y*m[4+k]+z*m[8+k]+m[12+k]));transformedCorners++;}
    candidateChecks.push({mode:candidate.mode,id:p.id,vertices:p.positions.length/3,triangleCorners:p.indices.length,maximumCoordinateResidualMetres:0});
  }
}
for(const p of placed.filter(p=>p.variant==='borrowed-baseline')){const source=rows.find(s=>s.kind==='borrowed'&&s.id===p.id);assert.deepEqual(p.positions,source.positions);assert.deepEqual(p.indices,source.indices);}
// Validate fixed targets against packed bytes, including the recorded brain binding.
const atlas=JSON.parse(fs.readFileSync('public/models/female/atlas-female.json')),chunks=new Map();let fixedVertices=0;
for(const p of rows.filter(p=>p.kind!=='source')){
  const q=atlas.parts.find(q=>q.id===p.sourceGeometryId);assert.ok(q);
  if(!chunks.has(q.chunk)){const c=atlas.chunks[q.chunk];chunks.set(q.chunk,gunzipSync(fs.readFileSync(`public/models/female/${c.gzip.split('/').pop()}`)));}const b=chunks.get(q.chunk);
  assert.equal(p.positions.length,3*q.vertexCount);assert.equal(p.indices.length,q.indexCount);
  for(let i=0;i<p.positions.length;i++)assert.equal(p.positions[i],b.readFloatLE(q.positions+4*i));for(let i=0;i<p.indices.length;i++)assert.equal(p.indices[i],b.readUInt32LE(q.indices+4*i));fixedVertices+=q.vertexCount;
}
// Reconstruct each reported witness from both its source edge and target face.
let crossingWitnesses=0,maximumWitnessResidualMetres=0;
for(const variant of audit.variants)for(const pair of [...variant.crossings,...variant.neckCrossings]){
  const w=pair.witness,from=w.direction==='a-to-b'?w.a:w.b,onto=w.direction==='a-to-b'?w.b:w.a;
  assert.ok(w.segmentFraction>1e-8&&w.segmentFraction<1-1e-8);assert.ok(w.barycentric.every(x=>x>1e-8));assert.ok(w.planeStraddleExtentMm>.001);
  assert.ok(Math.abs(w.barycentric.reduce((a,b)=>a+b,0)-1)<1e-12);
  for(let k=0;k<3;k++){
    const edge=from[w.edge][k]+(from[(w.edge+1)%3][k]-from[w.edge][k])*w.segmentFraction,face=onto.reduce((n,p,i)=>n+p[k]*w.barycentric[i],0);
    const residual=Math.max(Math.abs(w.point[k]-edge),Math.abs(w.point[k]-face));assert.ok(residual<1e-12);maximumWitnessResidualMetres=Math.max(maximumWitnessResidualMetres,residual);
  }crossingWitnesses++;
}
const result={status:'Source/candidate scalar arithmetic, fixed packed targets and reported witness coordinates verified; no clinical/containment approval',sourceChecks,candidateChecks,sourceTriangleCorners:corners,transformedTriangleCorners:transformedCorners,fixedVertices,crossingWitnesses,maximumWitnessResidualMetres,
  files:[`${out}/frame.json`,`${out}/audit.json`,frame.parts,audit.placedFile,'scripts/verify-bonehub-head-frame.mjs'].map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync(`${out}/readback.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({sourceTriangleCorners:corners,transformedTriangleCorners:transformedCorners,fixedVertices,crossingWitnesses,maximumWitnessResidualMetres}));
