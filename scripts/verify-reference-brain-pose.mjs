// Independent scalar transform, preserved topology, anchor and witness readback.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
assert.ok(process.argv.slice(2).length===0||process.argv.slice(2).length===1&&process.argv[2]==='--all-vertices');
const out=process.argv[2]?'.cache/brain-pose-full':'.cache/brain-pose',hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f));
const fit=read(`${out}/fit.json`),audit=read(`${out}/audit.json`),anchors=read('.cache/brain-pose/anchors.json');
for(const r of [fit,audit,anchors])for(const f of r.files)assert.equal(hash(f.file),f.sha256,f.file);
const original=JSON.parse(gunzipSync(fs.readFileSync(anchors.parts))),byId=new Map(original.map(p=>[p.id,p])),snapshots=JSON.parse(gunzipSync(fs.readFileSync(fit.parts)));
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
let vertices=0,triangleCorners=0,maximumCoordinateDifferenceMetres=0,bitwiseDifferentCoordinates=0,witnesses=0,maxWitnessResidualMetres=0;
const checks=[];
for(const snapshot of snapshots){
  const m=snapshot.matrixColumnMajor;
  assert.deepEqual([m[3],m[7],m[11],m[15]],[0,0,0,1]);
  for(let a=0;a<3;a++)for(let b=0;b<3;b++)assert.ok(Math.abs([0,1,2].reduce((n,k)=>n+m[a*4+k]*m[b*4+k],0)-(a===b?1:0))<1e-12);
  const determinant=m[0]*(m[5]*m[10]-m[9]*m[6])-m[4]*(m[1]*m[10]-m[9]*m[2])+m[8]*(m[1]*m[6]-m[5]*m[2]);assert.ok(Math.abs(determinant-1)<1e-12);
  assert.deepEqual(snapshot.parts.map(p=>p.id).sort(),[...anchors.movingIds].sort());
  assert.ok(!snapshot.parts.some(p=>p.id==='HRAF0070'||p.id==='HRAF0353'));
  for(const p of snapshot.parts){const before=byId.get(p.id);assert.equal(p.sourceGeometryId,before.sourceGeometryId);assert.deepEqual(p.indices,before.indices);assert.equal(p.positions.length,before.positions.length);
    for(let i=0;i<p.positions.length;i+=3)for(let k=0;k<3;k++){
      const expected=Math.fround(before.positions[i]*m[k]+before.positions[i+1]*m[4+k]+before.positions[i+2]*m[8+k]+m[12+k]),delta=Math.abs(p.positions[i+k]-expected);
      assert.ok(delta<=2e-7);maximumCoordinateDifferenceMetres=Math.max(maximumCoordinateDifferenceMetres,delta);if(delta)bitwiseDifferentCoordinates++;
    }vertices+=p.positions.length/3;triangleCorners+=p.indices.length;
    if(snapshot.mode==='baseline')assert.deepEqual(p.positions,before.positions);
  }
  const state=audit.variants.find(v=>v.mode===snapshot.mode);let maxDisplacement=0,maxPairedIncrease=-Infinity;
  for(const pair of anchors.interfaces){
    const p=snapshot.parts.find(p=>p.id===pair.movingId),record=state.interfaces.find(p=>p.movingId===pair.movingId&&p.fixedId===pair.fixedId);assert.equal(pair.anchors.length,record.records.length);
    for(const a of pair.anchors){const point=p.positions.slice(a.vertex*3,a.vertex*3+3),r=record.records.find(r=>r.vertex===a.vertex);assert.deepEqual(point,r.point);
      const displacement=distance(point,a.point)*1000,increase=distance(point,a.targetPoint)*1000-a.distanceMm;
      assert.ok(Math.abs(displacement-r.anchorDisplacementMm)<1e-9);assert.ok(Math.abs(increase-r.pairedDistanceIncreaseMm)<1e-9);
      assert.ok(Math.abs(distance(point,r.nearestTargetPoint)*1000-r.nearestDistanceMm)<1e-9);
      maxDisplacement=Math.max(maxDisplacement,displacement);maxPairedIncrease=Math.max(maxPairedIncrease,increase);
    }
  }
  if(snapshot.mode==='anchored'){assert.ok(maxDisplacement<=2.0001);assert.ok(maxPairedIncrease<=1.0001);}
  for(const pair of state.crossings){
    const w=pair.witness,from=w.direction==='a-to-b'?w.a:w.b,onto=w.direction==='a-to-b'?w.b:w.a;
    assert.ok(w.segmentFraction>0&&w.segmentFraction<1&&w.barycentric.every(v=>v>0));assert.ok(w.planeStraddleExtentMm>.001);
    for(let k=0;k<3;k++){const edge=from[w.edge][k]+w.segmentFraction*(from[(w.edge+1)%3][k]-from[w.edge][k]),face=onto.reduce((n,p,i)=>n+p[k]*w.barycentric[i],0);
      const residual=Math.max(Math.abs(edge-w.point[k]),Math.abs(face-w.point[k]));assert.ok(residual<1e-12);maxWitnessResidualMetres=Math.max(maxWitnessResidualMetres,residual);}
    witnesses++;
  }
  checks.push({mode:snapshot.mode,parts:snapshot.parts.length,maximumAnchorDisplacementMm:maxDisplacement,maximumPairedDistanceIncreaseMm:maxPairedIncrease});
}
fs.writeFileSync(`${out}/readback.json`,JSON.stringify({status:'Scalar saved geometry/topology, anchor and recorded witness arithmetic verified; not clinical approval',checks,vertices,triangleCorners,maximumCoordinateDifferenceMetres,bitwiseDifferentCoordinates,witnesses,maxWitnessResidualMetres,
  limitation:'Nearest target points and crossing witnesses are arithmetically checked, not independently rediscovered against all triangle surfaces in this verifier. Float32 coordinate comparison allows2e-7m and reports any nonidentical scalars.',
  files:[`${out}/fit.json`,`${out}/audit.json`,fit.parts,'scripts/verify-reference-brain-pose.mjs'].map(file=>({file,sha256:hash(file)}))},null,2)+'\n');
console.log(JSON.stringify({out,vertices,triangleCorners,maximumCoordinateDifferenceMetres,bitwiseDifferentCoordinates,witnesses,checks}));
