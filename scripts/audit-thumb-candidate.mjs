// Compare the six-bone experiment with the deployed PARTIAL arm registration,
// not the older raw pose. No public geometry or registration files are written.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3,Matrix4} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {applyBaselinePositions} from './lib/registration-baseline.mjs';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';
import {jointSurfaceRelation} from './lib/joint-geometry.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const prefix=process.argv.includes('--clearance')?'thumb-clearance':'thumb';
const candidatePath=`.cache/arm-registration/${prefix}-candidate.json`,candidate=JSON.parse(fs.readFileSync(candidatePath));
for(const f of candidate.files)assert.equal(sha(f.path),f.sha256,f.path);
const atlasPath='public/models/female/atlas-female.json',atlas=JSON.parse(fs.readFileSync(atlasPath)),buffers=new Map();
const baselinePath='docs/anatomy-alignment/female-arm-registration-v1.json',baseline=JSON.parse(fs.readFileSync(baselinePath));
const changes=new Map(candidate.hands.flatMap(h=>h.records).map(r=>[r.id,r]));assert.equal(changes.size,6);
function geometry(p,after=false){
  const path=`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').pop()}`;
  if(!buffers.has(path))buffers.set(path,gunzipSync(fs.readFileSync(path)));
  const b=buffers.get(path),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i)),1));
  const change=after&&changes.get(p.id);
  if(change){const pos=g.getAttribute('position');for(let i=0;i<pos.count;i++){
    const q=[pos.getX(i),pos.getY(i),pos.getZ(i)];
    pos.setXYZ(i,...change.translation.map((v,j)=>v+q.reduce((s,x,k)=>s+x*change.linear[k][j],0)));
  }}else applyBaselinePositions(g,p,baseline);
  g.computeBoundingBox();g.boundsTree=new MeshBVH(g);return g;
}
const skin=geometry(atlas.parts.find(p=>p.name==='Skin')),probe=surfaceProbe(skin);
const meshes=atlas.parts.filter(p=>['skeletal','connective','borrowed'].includes(p.system)).map(p=>({
  id:p.id,name:p.name,changed:changes.has(p.id),before:geometry(p),after:geometry(p,true)}));
assert.equal(meshes.length,321);
const report={status:'CANDIDATE ONLY; not deployed or anatomically validated',parts:[],pairs:[],joints:[],evaluatedPairs:0,
  newIntersections:[],resolvedIntersections:[],newOutside:0,worsenedOutside:0,
  limitations:['Triangle crossing extent is not solid penetration depth or cartilage contact accuracy.',
    'Skin containment checks referenced vertices against a 2 mm boundary band, not every triangle interior.']};
for(const row of meshes.filter(r=>r.changed)){
  const before=row.before.attributes.position,after=row.after.attributes.position;
  const result={id:row.id,name:row.name,vertices:0,beforeOutside:0,afterOutside:0,newOutside:0,worsenedOutside:0,beforeMaxMm:0,afterMaxMm:0};
  for(const index of referencedVertices(row.before,Infinity)){
    const a=probe.classify(new Vector3().fromBufferAttribute(before,index)),b=probe.classify(new Vector3().fromBufferAttribute(after,index));
    assert.notEqual(a.kind,'ambiguous');assert.notEqual(b.kind,'ambiguous');result.vertices++;
    result.beforeOutside+=a.kind==='outside';result.afterOutside+=b.kind==='outside';
    result.newOutside+=a.kind!=='outside'&&b.kind==='outside';
    result.worsenedOutside+=(b.kind==='outside'?b.distance:0)-(a.kind==='outside'?a.distance:0)>1e-6;
    if(a.kind==='outside')result.beforeMaxMm=Math.max(result.beforeMaxMm,a.distance*1000);
    if(b.kind==='outside')result.afterMaxMm=Math.max(result.afterMaxMm,b.distance*1000);
  }
  report.parts.push(result);report.newOutside+=result.newOutside;report.worsenedOutside+=result.worsenedOutside;
}
for(let i=0;i<meshes.length;i++)for(let j=i+1;j<meshes.length;j++){
  const a=meshes[i],b=meshes[j];if(!a.changed&&!b.changed)continue;report.evaluatedPairs++;
  const hit=stage=>a[stage].boundingBox.intersectsBox(b[stage].boundingBox)&&Boolean(a[stage].boundsTree.intersectsGeometry(b[stage],new Matrix4()));
  const before=hit('before'),after=hit('after');
  if(before||after){
    const pair={ids:[a.id,b.id],names:[a.name,b.name],before,after,
      beforeCrossings:triangleCrossings(a.before,b.before),afterCrossings:triangleCrossings(a.after,b.after)};
    report.pairs.push(pair);if(after&&!before)report.newIntersections.push(pair.ids);if(before&&!after)report.resolvedIntersections.push(pair.ids);
  }
}
for(const side of ['left','right']){
  const byName=name=>meshes.find(m=>m.name.toLowerCase()===name);
  const sequence=[`${side} trapezium`,`${side} first metacarpal bone`,`proximal phalanx of ${side} thumb`,`distal phalanx of ${side} thumb`].map(byName);
  assert.ok(sequence.every(Boolean));
  for(let i=1;i<sequence.length;i++){
    const a=sequence[i-1],b=sequence[i];report.joints.push({ids:[a.id,b.id],names:[a.name,b.name],before:jointSurfaceRelation(a.before,b.before),after:jointSurfaceRelation(a.after,b.after)});
  }
}
report.beforeOutside=report.parts.reduce((s,p)=>s+p.beforeOutside,0);report.afterOutside=report.parts.reduce((s,p)=>s+p.afterOutside,0);
report.files=[candidatePath,atlasPath,baselinePath,'scripts/lib/registration-baseline.mjs',
  'scripts/audit-thumb-candidate.mjs','scripts/lib/surface-containment.mjs','scripts/lib/joint-geometry.mjs','scripts/lib/triangle-crossings.mjs',...buffers.keys()].map(path=>({path,sha256:sha(path)}));
fs.writeFileSync(`.cache/arm-registration/${prefix}-candidate-audit.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,files:undefined},null,2));
probe.dispose();skin.dispose();meshes.forEach(r=>{r.before.dispose();r.after.dispose();});
