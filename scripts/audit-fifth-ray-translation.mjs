// Diagnostic only: bounded rigid translations of each fifth metatarsal/toe chain.
// Does not write a registration or alter atlas geometry.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3,Matrix4} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';
import {applyBaselinePositions} from './lib/registration-baseline.mjs';
import {jointSurfaceRelation} from './lib/joint-geometry.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';

const atlas=JSON.parse(fs.readFileSync('public/models/female/atlas-female.json'));
const arm=JSON.parse(fs.readFileSync('data/catalog/female-arm-registration.json'));
const foot=JSON.parse(fs.readFileSync('data/catalog/female-foot-registration.json'));
const chunks=new Map();
const sha256=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
function geometry(part){
  const chunk=atlas.chunks[part.chunk],path=`public/models/female/${chunk.gzip.split('/').pop()}`;
  if(!chunks.has(path)){
    const zip=fs.readFileSync(path);assert.equal(zip.length,chunk.gzipBytes);
    const bytes=gunzipSync(zip);assert.equal(bytes.length,chunk.bytes);chunks.set(path,bytes);
  }
  const bytes=chunks.get(path),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>bytes.readFloatLE(part.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>bytes.readUInt32LE(part.indices+4*i)),1));
  applyBaselinePositions(g,part,arm);applyBaselinePositions(g,part,foot);
  g.computeBoundingBox();return g;
}
const skin=geometry(atlas.parts.find(p=>p.id==='HRAF0003'));
const skinTree=new MeshBVH(skin),probe=surfaceProbe(skin,.002);
const maxShift=.015;
const report={status:'DIAGNOSTIC ONLY: no anatomical registration approved',
  limits:{maximumTranslationMm:15,stepsMm:[.25,.5,1,2,5,10,15],skinBandMm:2},sides:[]};
for(const side of ['left','right']){
  const names=[`${side} fifth metatarsal bone`,...['proximal','middle','distal'].map(stage=>`${stage} phalanx of ${side} little toe`)];
  const moving=names.map(name=>{
    const part=atlas.parts.find(p=>p.name.toLowerCase()===name);assert.ok(part,name);
    return {part,g:geometry(part)};
  });
  const movingIds=new Set(moving.map(m=>m.part.id));
  const points=[],inward=new Vector3(),partBaseline=[];
  for(const {part,g} of moving){
    let outside=0,maxOutsideMm=0;
    for(const index of referencedVertices(g,Infinity)){
      const point=new Vector3().fromBufferAttribute(g.attributes.position,index);
      const baseline=probe.classify(point);assert.notEqual(baseline.kind,'ambiguous');
      if(baseline.kind==='outside'){
        outside++;maxOutsideMm=Math.max(maxOutsideMm,baseline.distance*1000);
        const nearest=skinTree.closestPointToPoint(point);
        inward.add(nearest.point.sub(point).multiplyScalar(Math.max(0,baseline.distance-.002)));
      }
      if(baseline.distance<=maxShift||baseline.kind==='outside')points.push({point,baseline});
    }
    partBaseline.push({id:part.id,name:part.name,outside,maxOutsideMm});
  }
  const directions=[];
  if(inward.lengthSq()>0)directions.push({name:'mean-inward',vector:inward.normalize().clone()});
  for(const [name,v] of [['x',[1,0,0]],['y',[0,1,0]],['z',[0,0,1]]]){
    directions.push({name:`+${name}`,vector:new Vector3(...v)});
    directions.push({name:`-${name}`,vector:new Vector3(...v).negate()});
  }
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
    if(Math.abs(x)+Math.abs(y)+Math.abs(z)<2)continue;
    directions.push({name:`diagonal:${x},${y},${z}`,vector:new Vector3(x,y,z).normalize()});
  }
  const trials=[];
  for(const direction of directions)for(const mm of report.limits.stepsMm){
    const shift=direction.vector.clone().multiplyScalar(mm*.001);
    const result={direction:direction.name,mm,outside:0,newOutside:0,worsenedOutside:0,
      maxOutsideMm:0,sumSquaredExcessMm:0,ambiguous:0};
    for(const {point,baseline} of points){
      const q=point.clone().add(shift);
      q.set(Math.fround(q.x),Math.fround(q.y),Math.fround(q.z));
      const c=probe.classify(q);
      if(c.kind==='ambiguous')result.ambiguous++;
      if(c.kind==='outside'){
        result.outside++;result.maxOutsideMm=Math.max(result.maxOutsideMm,c.distance*1000);
        result.sumSquaredExcessMm+=((c.distance-.002)*1000)**2;
        if(baseline.kind!=='outside')result.newOutside++;
      }
      if((c.kind==='outside'?c.distance:0)-(baseline.kind==='outside'?baseline.distance:0)>1e-6)
        result.worsenedOutside++;
    }
    trials.push(result);
  }
  const baselineOutside=partBaseline.reduce((n,p)=>n+p.outside,0);
  const ranked=trials.sort((a,b)=>a.outside-b.outside||a.newOutside-b.newOutside);
  const promising=ranked.filter(r=>r.outside<baselineOutside).slice(0,8);
  const trial2=ranked.find(r=>r.direction==='mean-inward'&&r.mm===2);
  if(!promising.includes(trial2))promising.push(trial2);
  // Exact mesh intersections are screened only for the best skin candidates.
  const fixed=atlas.parts.filter(p=>['skeletal','connective','borrowed'].includes(p.system)&&!movingIds.has(p.id))
    .map(part=>({part,g:geometry(part)}));
  for(const {g} of fixed)g.boundsTree=new MeshBVH(g);
  function intersections(shift){
    const matrix=new Matrix4().makeTranslation(...shift.toArray());
    const hits=[];
    for(const m of moving){
      const box=m.g.boundingBox.clone().translate(shift);
      for(const f of fixed)if(box.intersectsBox(f.g.boundingBox)&&f.g.boundsTree.intersectsGeometry(m.g,matrix))
        hits.push([m.part.id,f.part.id]);
    }
    return hits;
  }
  const baselineIntersections=intersections(new Vector3());
  for(const row of promising){
    const direction=directions.find(d=>d.name===row.direction);
    row.intersections=intersections(direction.vector.clone().multiplyScalar(row.mm*.001));
  }
  const cuboid=fixed.find(f=>f.part.name.toLowerCase()===`${side} cuboid bone`);
  assert.ok(cuboid);
  const metatarsal=moving[0].g;
  const jointBefore=jointSurfaceRelation(metatarsal,cuboid.g);
  const translated=metatarsal.clone(),positions=translated.attributes.position;
  const delta=directions[0].vector.clone().multiplyScalar(.002);
  for(let i=0;i<positions.count;i++)positions.setXYZ(i,positions.getX(i)+delta.x,positions.getY(i)+delta.y,positions.getZ(i)+delta.z);
  const jointAfter2Mm=jointSurfaceRelation(translated,cuboid.g);
  const existingCrossings=baselineIntersections.map(([movingId,fixedId])=>{
    const source=moving.find(m=>m.part.id===movingId),target=fixed.find(f=>f.part.id===fixedId);
    assert.ok(source&&target);
    const shifted=source.g.clone(),pos=shifted.attributes.position;
    for(let i=0;i<pos.count;i++)pos.setXYZ(i,pos.getX(i)+delta.x,pos.getY(i)+delta.y,pos.getZ(i)+delta.z);
    const row={movingId,fixedId,before:triangleCrossings(source.g,target.g),after2Mm:triangleCrossings(shifted,target.g)};
    shifted.dispose();return row;
  });
  const localSafe=[];
  const baselinePairs=new Set(baselineIntersections.map(p=>p.join('/')));
  for(const row of ranked){
    if(row.mm>2||row.outside>=baselineOutside||row.newOutside||row.worsenedOutside||row.ambiguous)continue;
    const direction=directions.find(d=>d.name===row.direction);
    const shift=direction.vector.clone().multiplyScalar(row.mm*.001);
    const hits=row.intersections??intersections(shift);
    if(hits.some(pair=>!baselinePairs.has(pair.join('/'))))continue;
    const changed=existingCrossings.map(({movingId,fixedId,before})=>{
      const source=moving.find(m=>m.part.id===movingId),target=fixed.find(f=>f.part.id===fixedId);
      const shifted=source.g.clone(),pos=shifted.attributes.position;
      for(let i=0;i<pos.count;i++)pos.setXYZ(i,pos.getX(i)+shift.x,pos.getY(i)+shift.y,pos.getZ(i)+shift.z);
      const after=triangleCrossings(shifted,target.g);shifted.dispose();
      return {movingId,fixedId,before,after};
    });
    if(changed.every(({before,after})=>after.strictPlaneStraddlingPairs<=before.strictPlaneStraddlingPairs&&
      after.maxTrianglePlaneStraddleExtentMm<=before.maxTrianglePlaneStraddleExtentMm+.001))
      localSafe.push({direction:row.direction,mm:row.mm,outside:row.outside,
        newOutside:row.newOutside,worsenedOutside:row.worsenedOutside,intersections:hits,changed});
  }
  translated.dispose();
  const sideReport={side,baseline:partBaseline,nearSkinVertices:points.length,
    meanInwardDirection:directions[0].vector.toArray(),baselineIntersections,existingCrossings,
    cuboidJoint:{before:jointBefore,afterMeanInward2Mm:jointAfter2Mm},
    localSafe:localSafe.sort((a,b)=>a.outside-b.outside||a.mm-b.mm),trials:ranked};
  report.sides.push(sideReport);
  console.log(JSON.stringify({side,baselineOutside,nearSkinVertices:points.length,
    baselineIntersections:baselineIntersections.length,cuboidJoint:sideReport.cuboidJoint,
    localSafe:localSafe.slice(0,3).map(r=>({direction:r.direction,mm:r.mm,outside:r.outside})),
    trial2Mm:{outside:trial2.outside,newOutside:trial2.newOutside,
      worsenedOutside:trial2.worsenedOutside,intersections:trial2.intersections?.length},
    best:ranked.slice(0,5).map(({direction,mm,outside,newOutside,worsenedOutside,intersections})=>
      ({direction,mm,outside,newOutside,worsenedOutside,intersections:intersections?.length}))}));
  fixed.forEach(({g})=>g.dispose());moving.forEach(({g})=>g.dispose());
}
probe.dispose();skin.dispose();
report.files=[
  'public/models/female/atlas-female.json',
  'data/catalog/female-arm-registration.json',
  'data/catalog/female-foot-registration.json',
  'scripts/audit-fifth-ray-translation.mjs',
  'scripts/lib/surface-containment.mjs',
  'scripts/lib/registration-baseline.mjs',
  'scripts/lib/joint-geometry.mjs',
  'scripts/lib/triangle-crossings.mjs',
  ...chunks.keys(),
].map(path=>({path,sha256:sha256(path)}));
const output=process.env.FIFTH_RAY_AUDIT_OUTPUT;
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
