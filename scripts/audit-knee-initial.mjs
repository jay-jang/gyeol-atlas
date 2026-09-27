// Independent scalar reconstruction of saved transforms and crossing witnesses.
// Not a second ICP fit or independent anatomical assessment.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';
import {applyFemaleSourceRestoration} from '../src/female-source-restoration.ts';
import {resolveFemaleBrainGeometryPart} from '../src/female-brain-bindings.ts';
const out='.cache/knee-initial',sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p));
const reportBytes=read(`${out}/report.json`),report=JSON.parse(reportBytes);
for(const f of report.files)assert.equal(sha(read(f.file)),f.sha256,f.file);
const packing=json('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative,zipped=read('.cache/donor-fidelity/source-full.bin.gz');assert.equal(sha(zipped),packing.sha256);const source=gunzipSync(zipped);
const atlas=json('public/models/female/atlas-female.json'),byId=new Map(atlas.parts.map(p=>[p.id,p])),chunks=atlas.chunks.map(c=>gunzipSync(read(`public/models/female/${c.gzip.split('/').pop()}`)));
const restoration=json('data/catalog/female-source-restoration.json'),restorationBytes=gunzipSync(read(`public/${restoration.url}`)),restored=restorationBytes.buffer.slice(restorationBytes.byteOffset,restorationBytes.byteOffset+restorationBytes.byteLength);
function decode(bytes,p){return {positions:Float32Array.from({length:3*p.vertexCount},(_,i)=>bytes.readFloatLE(p.positions+4*i)),indices:Uint32Array.from({length:p.indexCount},(_,i)=>bytes.readUInt32LE(p.indices+4*i))};}
const fixed=new Map();
function runtime(id){
  if(fixed.has(id))return fixed.get(id);
  const p=byId.get(id),q=resolveFemaleBrainGeometryPart(p,'female',byId),d=decode(chunks[q.chunk],q),g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(d.positions,3));g.setIndex(new BufferAttribute(d.indices,1));
  applyFemaleSourceRestoration(g,'female',id,p.system,restored);applyFemaleArmRegistration(g,'female',id,p.system);applyFemaleFootRegistration(g,'female',id,p.system);
  const result={positions:g.attributes.position.array,indices:g.index.array};fixed.set(id,result);g.dispose();return result;
}
function hasTriangle(g,vertices){
  const equal=(index,p)=>[0,1,2].every(k=>Math.abs(g.positions[3*index+k]-p[k])<1e-12);
  for(let i=0;i<g.indices.length;i+=3){
    if(!vertices.some(p=>equal(g.indices[i],p)))continue;
    const used=new Set();let matches=true;
    for(let j=0;j<3;j++){const k=vertices.findIndex((p,k)=>!used.has(k)&&equal(g.indices[i+j],p));if(k<0){matches=false;break;}used.add(k);}
    if(matches)return i/3;
  }return -1;
}
const audit={createdAt:new Date().toISOString(),reportSha256:sha(reportBytes),status:'SCALAR COORDINATE AND WITNESS READBACK; not an independent fit or clinical approval',evaluations:[]};
for(const evaluation of report.evaluations){
  const moved=new Map(),row={mode:evaluation.mode,vertices:0,indexReferences:0,maximumRoundTripMetres:0,maximumSimilarityMetricResidual:0,witnesses:[]};
  for(const m of evaluation.muscles){
    const p=packing.parts.find(p=>p.id===m.id),d=decode(source,p),e=m.matrix,positions=new Float32Array(d.positions.length),inverse=new Matrix4().fromArray(e).invert();
    const scaleSquared=(e[0]**2+e[1]**2+e[2]**2+e[4]**2+e[5]**2+e[6]**2+e[8]**2+e[9]**2+e[10]**2)/3;
    for(let a=0;a<3;a++)for(let b=0;b<3;b++){const dot=e[4*a]*e[4*b]+e[4*a+1]*e[4*b+1]+e[4*a+2]*e[4*b+2];row.maximumSimilarityMetricResidual=Math.max(row.maximumSimilarityMetricResidual,Math.abs(dot-(a===b?scaleSquared:0)));}
    for(let i=0;i<p.vertexCount;i++){
      const x=d.positions[3*i],y=d.positions[3*i+1],z=d.positions[3*i+2];
      positions[3*i]=e[0]*x+e[4]*y+e[8]*z+e[12];positions[3*i+1]=e[1]*x+e[5]*y+e[9]*z+e[13];positions[3*i+2]=e[2]*x+e[6]*y+e[10]*z+e[14];
      const back=new Vector3(...positions.subarray(3*i,3*i+3)).applyMatrix4(inverse);row.maximumRoundTripMetres=Math.max(row.maximumRoundTripMetres,Math.hypot(back.x-x,back.y-y,back.z-z));
    }
    assert.equal(sha(Buffer.from(positions.buffer)),m.positionsSha256);assert.equal(sha(Buffer.from(d.indices.buffer)),m.indicesSha256);
    row.vertices+=p.vertexCount;row.indexReferences+=p.indexCount;moved.set(m.id,{positions,indices:d.indices});
  }
  assert.ok(row.maximumRoundTripMetres<1e-7);assert.ok(row.maximumSimilarityMetricResidual<1e-12);
  for(const r of evaluation.relations.filter(r=>r.witness)){
    const w=r.witness,a=moved.get(r.ids[0])||runtime(r.ids[0]),b=moved.get(r.ids[1])||runtime(r.ids[1]);
    const triangleA=hasTriangle(a,w.a),triangleB=hasTriangle(b,w.b);assert.ok(triangleA>=0&&triangleB>=0);
    const from=w.direction==='a-to-b'?w.a:w.b,onto=w.direction==='a-to-b'?w.b:w.a,t=w.segmentFraction;
    assert.ok(t>0&&t<1);assert.ok(w.barycentric.every(v=>v>0&&v<1));assert.ok(Math.abs(w.barycentric.reduce((a,b)=>a+b,0)-1)<1e-12);
    const edgePoint=from[w.edge].map((v,k)=>v*(1-t)+from[(w.edge+1)%3][k]*t),trianglePoint=[0,1,2].map(k=>onto.reduce((n,p,j)=>n+p[k]*w.barycentric[j],0));
    const residual=Math.max(...edgePoint.map((v,k)=>Math.abs(v-trianglePoint[k])),...edgePoint.map((v,k)=>Math.abs(v-w.point[k])));assert.ok(residual<1e-12);
    row.witnesses.push({ids:r.ids,triangleA,triangleB,maximumCoordinateResidualMetres:residual});
  }
  audit.evaluations.push(row);console.log(JSON.stringify({...row,witnesses:row.witnesses.length}));
}
// Header inventory identifies an unseparated resolution factor for the next
// experiment. Accessor counts alone are NOT a surface-distance measurement.
const membership=json('docs/anatomy-alignment/hra-bone-targets.json'),officialFile=membership.sourceFile,official=read(officialFile);
assert.equal(sha(official),membership.sourceSha256);assert.equal(official.readUInt32LE(0),0x46546c67);assert.equal(official.readUInt32LE(4),2);assert.equal(official.readUInt32LE(8),official.length);
const gltf=JSON.parse(official.subarray(20,20+official.readUInt32LE(12)));
audit.targetResolutionInventory={metadataOnly:true,sourceFile:officialFile,sourceSha256:sha(official),bones:membership.targets.map(t=>({side:t.side,bone:t.bone,members:t.members.map(m=>{
  const n=gltf.nodes[m.nodeIndex];assert.equal(n.name,m.sourceName);const primitives=gltf.meshes[n.mesh].primitives;assert.equal(primitives.length,1);const p=primitives[0],packed=byId.get(m.id);assert.equal(packed.conceptId,m.conceptId);
  return {id:m.id,nodeIndex:m.nodeIndex,sourceName:m.sourceName,sourceVertexCount:gltf.accessors[p.attributes.POSITION].count,sourceIndexReferences:gltf.accessors[p.indices].count,packedVertexCount:packed.vertexCount,packedIndexReferences:packed.indexCount};
})}))};
audit.files=['scripts/audit-knee-initial.mjs',officialFile,...report.files.map(f=>f.file)].map(file=>({file,sha256:sha(read(file))}));
fs.writeFileSync(`${out}/audit.json`,JSON.stringify(audit,null,2)+'\n');
