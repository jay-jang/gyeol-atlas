// Full bone-pair screen for a toe-chain candidate; no deployment/export path.
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
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const prefix=process.argv.includes('--clearance')?'forefoot-clearance':'forefoot';
const candidatePath=`.cache/foot-registration/${prefix}-candidate.json`,candidate=JSON.parse(fs.readFileSync(candidatePath));
for(const f of candidate.files)assert.equal(hash(f.path),f.sha256,f.path);
const atlasPath='public/models/female/atlas-female.json',atlas=JSON.parse(fs.readFileSync(atlasPath));
const registrationPath='data/catalog/female-arm-registration.json',registration=JSON.parse(fs.readFileSync(registrationPath));
const records=new Map(candidate.groups.flatMap(g=>g.records).map(r=>[r.id,r]));assert.equal(records.size,30);
assert.ok(registration.records.every(r=>!records.has(r.id)));
const buffers=new Map();
function geometry(part,after=false){
  const chunk=atlas.chunks[part.chunk],path=`public/models/female/${chunk.gzip.split('/').pop()}`;
  if(!buffers.has(path)){const zipped=fs.readFileSync(path);assert.equal(zipped.length,chunk.gzipBytes);
    const bytes=gunzipSync(zipped);assert.equal(bytes.length,chunk.bytes);buffers.set(path,bytes);}
  const bytes=buffers.get(path),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>bytes.readFloatLE(part.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>bytes.readUInt32LE(part.indices+4*i)),1));
  applyBaselinePositions(g,part,registration);
  const record=after&&records.get(part.id);
  if(record){
    const pos=g.attributes.position;assert.equal(pos.count,record.vertexCount);assert.equal(g.index.count,record.indexCount);
    for(let i=0;i<pos.count;i++){
      const q=[pos.getX(i),pos.getY(i),pos.getZ(i)];
      pos.setXYZ(i,...record.translation.map((v,j)=>v+q.reduce((s,x,k)=>s+x*record.linear[k][j],0)));
    }
  }
  g.computeBoundingBox();g.boundsTree=new MeshBVH(g);return g;
}
const skin=geometry(atlas.parts.find(p=>p.id==='HRAF0003')),probe=surfaceProbe(skin,.002);
const meshes=atlas.parts.filter(p=>['skeletal','connective','borrowed'].includes(p.system)).map(p=>({
  id:p.id,name:p.name,target:records.has(p.id),before:geometry(p),after:geometry(p,true)}));assert.equal(meshes.length,321);
const byId=new Map(meshes.map(m=>[m.id,m]));
const report={status:'OFFLINE CANDIDATE AUDIT; no clinical or deployment approval',parts:[],pairs:[],joints:[],
  evaluatedPairs:0,newIntersections:[],resolvedIntersections:[],beforeOutside:0,afterOutside:0,newOutside:0,worsenedOutside:0,
  limitations:['All 56 foot bone indexed vertices are audited, not all their triangle interiors.',
    'All pairs with at least one of the 30 candidate records are screened against 321 current bone-layer parts.',
    'An intersection screen cannot detect a closed solid entirely enclosed in another without surface crossing.',
    'Unsigned vertex-to-triangle minima and plane-straddle extents are not cartilage gaps or penetration depths.',
    'Non-bone tissues, actual articular landmarks and clinical alignment remain unvalidated.']};
for(let n=124;n<180;n++){
  const m=byId.get(`BM${String(n).padStart(4,'0')}`);assert.ok(m);
  const stats={id:m.id,name:m.name,target:m.target,vertices:0,beforeOutside:0,afterOutside:0,newOutside:0,worsenedOutside:0,
    beforeMaxMm:0,afterMaxMm:0,maxDisplacementMm:0};
  for(const i of referencedVertices(m.before,Infinity)){
    const a=new Vector3().fromBufferAttribute(m.before.attributes.position,i),b=new Vector3().fromBufferAttribute(m.after.attributes.position,i);
    const before=probe.classify(a),after=probe.classify(b);assert.notEqual(before.kind,'ambiguous');assert.notEqual(after.kind,'ambiguous');
    stats.vertices++;stats.beforeOutside+=before.kind==='outside';stats.afterOutside+=after.kind==='outside';
    stats.newOutside+=after.kind==='outside'&&before.kind!=='outside';
    stats.worsenedOutside+=(after.kind==='outside'?after.distance:0)-(before.kind==='outside'?before.distance:0)>1e-6;
    if(before.kind==='outside')stats.beforeMaxMm=Math.max(stats.beforeMaxMm,before.distance*1000);
    if(after.kind==='outside')stats.afterMaxMm=Math.max(stats.afterMaxMm,after.distance*1000);
    stats.maxDisplacementMm=Math.max(stats.maxDisplacementMm,a.distanceTo(b)*1000);
  }
  report.parts.push(stats);for(const key of ['beforeOutside','afterOutside','newOutside','worsenedOutside'])report[key]+=stats[key];
}
assert.equal(report.beforeOutside,2183);
for(const m of meshes.filter(m=>!m.target))assert.deepEqual(m.before.attributes.position.array,m.after.attributes.position.array,m.id);
for(let i=0;i<meshes.length;i++)for(let j=i+1;j<meshes.length;j++){
  const a=meshes[i],b=meshes[j];if(!a.target&&!b.target)continue;report.evaluatedPairs++;
  const hit=stage=>a[stage].boundingBox.intersectsBox(b[stage].boundingBox)&&Boolean(a[stage].boundsTree.intersectsGeometry(b[stage],new Matrix4()));
  const before=hit('before'),after=hit('after');
  if(before||after){
    const pair={ids:[a.id,b.id],names:[a.name,b.name],before,after,
      beforeCrossings:triangleCrossings(a.before,b.before),afterCrossings:triangleCrossings(a.after,b.after)};
    report.pairs.push(pair);if(after&&!before)report.newIntersections.push(pair.ids);if(before&&!after)report.resolvedIntersections.push(pair.ids);
  }
}
assert.equal(report.evaluatedPairs,9165);
const anklePairs=[['BM0141','HRAF0954'],['BM0141','HRAF0955'],['BM0179','HRAF0927'],['BM0179','HRAF0928']];
for(const ids of [...candidate.groups.map(g=>g.jointIds),...anklePairs]){
  const [a,b]=ids.map(id=>byId.get(id));assert.ok(a&&b);
  const measure=stage=>({forward:jointSurfaceRelation(a[stage],b[stage]),reverse:jointSurfaceRelation(b[stage],a[stage]),crossings:triangleCrossings(a[stage],b[stage])});
  const row={ids,names:[a.name,b.name],before:measure('before'),after:measure('after')};
  if(anklePairs.some(p=>p[0]===ids[0]&&p[1]===ids[1]))assert.deepEqual(row.before,row.after);
  report.joints.push(row);
}
report.files=[candidatePath,atlasPath,registrationPath,'scripts/audit-forefoot-candidate.mjs','scripts/lib/registration-baseline.mjs',
  'scripts/lib/surface-containment.mjs','scripts/lib/joint-geometry.mjs','scripts/lib/triangle-crossings.mjs',...buffers.keys()].map(path=>({path,sha256:hash(path)}));
fs.writeFileSync(`.cache/foot-registration/${prefix}-candidate-audit.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,joints:undefined,parts:undefined,pairs:undefined,files:undefined},null,2));
probe.dispose();skin.dispose();meshes.forEach(m=>{m.before.dispose();m.after.dispose();});
