// Diagnostic candidate only. Source bone frames are prescribed candidates,
// not ground-truth landmarks; passing interpolation does not approve anatomy.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix3,Matrix4,Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {boneInterpolatingField} from './lib/bone-interpolating-field.mjs';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';

const root=process.argv[2];assert.ok(root,'Pass extracted Final STL directory');
const files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const read=file=>{const bytes=fs.readFileSync(file);files.set(file,sha(bytes));return bytes;};
const json=file=>JSON.parse(read(file));
const previous=json('docs/anatomy-alignment/continuous-hip-per-side.json');
assert.equal(previous.perSide,true);assert.equal(previous.hipSurface,true);
for(const file of previous.files)assert.equal(sha(read(file.path)),file.sha256);
const previousCompressed=read(previous.binary.path);assert.equal(sha(previousCompressed),previous.binary.sha256);
const previousData=gunzipSync(previousCompressed);
const source=json('docs/anatomy-alignment/donor-source-comparison.json');
const packing=json('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative;
const compressed=read('.cache/donor-fidelity/source-full.bin.gz');assert.equal(sha(compressed),packing.sha256);
const data=gunzipSync(compressed),candidate=Buffer.from(data);
assert.equal(data.length,packing.bytes);assert.equal(previousData.length,data.length);
assert.deepEqual(previous.binary.parts,packing.parts);
const frames=[],bones=[];
for(const record of previous.frames){
  const pieces=record.bones.map(name=>{
    const file=source.files.find(f=>f.kind==='bone'&&f.side===record.side&&f.structure===name);assert.ok(file);
    const bytes=read(path.join(root,file.file));assert.equal(sha(bytes),file.sha256);
    const raw=new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    raw.scale(.001,.001,.001);raw.deleteAttribute('normal');const g=mergeVertices(raw,1e-8);raw.dispose();
    bones.push({side:record.side,name,matrix:new Matrix4().fromArray(record.matrix),geometry:g});return g;
  });
  const geometry=mergeGeometries(pieces);geometry.boundsTree=new MeshBVH(geometry);
  frames.push({side:record.side,group:record.group,matrix:new Matrix4().fromArray(record.matrix),geometry,nearest:p=>geometry.boundsTree.closestPointToPoint(p)});
}
assert.equal(bones.length,10);assert.equal(frames.length,6);
const fields=Object.fromEntries(['left','right'].map(side=>[side,boneInterpolatingField(frames.filter(f=>f.side===side))]));
const boneChecks=[],point=new Vector3();
for(const bone of bones){
  let vertices=0,maximumFrameDisplacementMm=0,changedFloat32Vertices=0;
  for(const vertex of referencedVertices(bone.geometry,Infinity)){
    vertices++;point.fromBufferAttribute(bone.geometry.attributes.position,vertex);
    const own=point.clone().applyMatrix4(bone.matrix),mapped=fields[bone.side](point).point;
    maximumFrameDisplacementMm=Math.max(maximumFrameDisplacementMm,own.distanceTo(mapped)*1000);
    if(own.toArray().some((v,k)=>Math.fround(v)!==Math.fround(mapped.getComponent(k))))changedFloat32Vertices++;
  }
  boneChecks.push({side:bone.side,name:bone.name,vertices,maximumFrameDisplacementMm,changedFloat32Vertices});
}
console.log(JSON.stringify({boneChecks}));
const atlas=json('public/models/female/atlas-female.json');
for(const f of json('data/catalog/female-atlas-source.json').files)assert.equal(sha(read(f.path)),f.sha256);
const part=atlas.parts.find(p=>p.id==='HRAF0003'),skinData=gunzipSync(read(`public/models/female/${path.basename(atlas.chunks[part.chunk].gzip)}`)),skin=new BufferGeometry();
skin.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>skinData.readFloatLE(part.positions+4*i)),3));
skin.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>skinData.readUInt32LE(part.indices+4*i)),1));
const probe=surfaceProbe(skin),beforePoint=new Vector3(),afterPoint=new Vector3(),rows=[];
const tally=()=>({inside:0,outside:0,'surface-band':0,ambiguous:0,maxOutsideMm:0});
const count=(r,c)=>{r[c.kind]++;if(c.kind==='outside')r.maxOutsideMm=Math.max(r.maxOutsideMm,c.distance*1000);};
let minimum;
for(const part of packing.parts){
  const old=previous.rows.find(r=>r.id===part.id);assert.ok(old);assert.equal(old.name,part.name);
  const row={id:part.id,name:part.name,sourceSide:old.sourceSide,vertices:part.vertexCount,skinBefore:tally(),skinAfter:tally(),newOutside:0,worsenedOutside:0,resolvedOutside:0,nonpositiveJacobians:0,minimumJacobianDeterminant:Infinity,maximumJacobianDeterminant:-Infinity};
  for(let vertex=0;vertex<part.vertexCount;vertex++){
    point.set(...[0,1,2].map(k=>data.readFloatLE(part.positions+4*(vertex*3+k))));
    const mapped=fields[row.sourceSide](point);
    beforePoint.set(...[0,1,2].map(k=>previousData.readFloatLE(part.positions+4*(vertex*3+k))));
    afterPoint.set(...mapped.point.toArray().map(Math.fround));
    for(let k=0;k<3;k++)candidate.writeFloatLE(afterPoint.getComponent(k),part.positions+4*(vertex*3+k));
    const before=probe.classify(beforePoint),after=probe.classify(afterPoint);count(row.skinBefore,before);count(row.skinAfter,after);
    if(after.kind==='outside'&&before.kind!=='outside')row.newOutside++;
    if(after.kind==='outside'&&before.kind==='outside'&&after.distance>before.distance+1e-6)row.worsenedOutside++;
    if(after.kind!=='outside'&&before.kind==='outside')row.resolvedOutside++;
    if(after.kind==='outside'&&(!row.maximumOutsideWitness||after.distance*1000>row.maximumOutsideWitness.distanceMm))row.maximumOutsideWitness={vertex,sourcePointMetres:point.toArray(),candidatePointMetres:afterPoint.toArray(),distanceMm:after.distance*1000,weights:mapped.weights,anchorDistancesMetres:mapped.distancesMetres};
    if(mapped.determinant<=0)row.nonpositiveJacobians++;
    row.minimumJacobianDeterminant=Math.min(row.minimumJacobianDeterminant,mapped.determinant);row.maximumJacobianDeterminant=Math.max(row.maximumJacobianDeterminant,mapped.determinant);
    if(!minimum||mapped.determinant<minimum.determinant)minimum={id:part.id,sourceSide:row.sourceSide,vertex,pointMetres:point.toArray(),jacobian:mapped.jacobian,determinant:mapped.determinant,weights:mapped.weights};
  }
  assert.deepEqual(row.skinBefore,old.skinAfter,'Baseline must reproduce prior serialized candidate');
  assert.equal(row.skinAfter.outside-row.skinBefore.outside,row.newOutside-row.resolvedOutside);
  rows.push(row);console.log(JSON.stringify({id:row.id,before:row.skinBefore.outside,after:row.skinAfter.outside,nonpositiveJacobians:row.nonpositiveJacobians}));
}
const centre=new Vector3(...minimum.pointMetres),step=1e-6,numerical=Array(9).fill(0),field=fields[minimum.sourceSide];
for(let axis=0;axis<3;axis++){
  const a=centre.clone(),b=centre.clone();a.setComponent(axis,a.getComponent(axis)-step);b.setComponent(axis,b.getComponent(axis)+step);
  const derivative=field(b).point.sub(field(a).point).multiplyScalar(1/(2*step));
  for(let row=0;row<3;row++)numerical[row*3+axis]=derivative.getComponent(row);
}
minimum.finiteDifference={stepMetres:step,jacobian:numerical,determinant:new Matrix3().set(...numerical).determinant(),maximumElementResidual:Math.max(...numerical.map((v,i)=>Math.abs(v-minimum.jacobian[i])))};
const sum=f=>rows.reduce((n,r)=>n+f(r),0);
const summary={meshes:rows.length,vertices:sum(r=>r.vertices),skinOutsideBefore:sum(r=>r.skinBefore.outside),skinOutsideAfter:sum(r=>r.skinAfter.outside),newOutside:sum(r=>r.newOutside),worsenedOutside:sum(r=>r.worsenedOutside),nonpositiveJacobians:sum(r=>r.nonpositiveJacobians),maximumSkinOutsideMm:Math.max(...rows.map(r=>r.skinAfter.maxOutsideMm)),boneVertices:boneChecks.reduce((n,r)=>n+r.vertices,0),changedFloat32BoneVertices:boneChecks.reduce((n,r)=>n+r.changedFloat32Vertices,0)};
const rejected=summary.changedFloat32BoneVertices||summary.newOutside||summary.worsenedOutside||summary.nonpositiveJacobians;
const out='.cache/donor-bone-interpolating';fs.mkdirSync(out,{recursive:true});const binary=gzipSync(candidate,{level:9});fs.writeFileSync(`${out}/candidate.bin.gz`,binary);
for(const file of ['scripts/build-bone-interpolating-candidate.mjs','scripts/lib/bone-interpolating-field.mjs','scripts/lib/surface-containment.mjs','package-lock.json'])read(file);
const report={createdAt:new Date().toISOString(),status:rejected?'REJECTED BY BONE/SKIN/JACOBIAN SCREEN; no runtime export':'NOT APPROVED; further attachment, intersection and anatomical checks required',
  method:'Per-side normalized inverse-fourth-distance weights with exact sole-anchor limit. Same prescribed six fitted frames as prior Gaussian candidate; no new fit optimization.',
  baseline:'Previously rejected per-side Gaussian 20mm hip-surface candidate, NOT the old six-group placement or deployed simplified meshes',
  summary,boneChecks,minimumJacobianWitness:minimum,rows,frames:previous.frames,
  binary:{path:`${out}/candidate.bin.gz`,bytes:candidate.length,gzipBytes:binary.length,sha256:sha(binary),parts:packing.parts},
  limitations:['Prescribed source bone frames are approximate fits, not ground-truth positions or anatomical attachment constraints.',
    'Inverse-fourth-distance weighting is an experimental interpolation rule, not a validated tissue deformation model.',
    'Conflicting exactly coincident anchor frames throw rather than silently choose one; near intersections can still create extreme derivatives.',
    'Sampled Jacobians and skin vertex classifications do not prove global injectivity, triangle validity or full tissue containment.',
    'All source triangle indices are retained but output vertex positions and shapes change. No public geometry or anatomy interaction is modified.'],
  files:[...files].map(([file,sha256])=>({file,sha256}))};
fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,summary,minimumJacobianWitness:minimum}));
probe.dispose();skin.dispose();frames.forEach(f=>f.geometry.dispose());bones.forEach(b=>b.geometry.dispose());
