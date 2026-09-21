// Compare original HRA world-space bounds with the imported female brain.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Matrix4,Quaternion,Vector3,Box3} from 'three';
const path='.cache/neural-bone/hra-united-female-v1.10.glb',file=fs.readFileSync(path);
assert.equal(file.readUInt32LE(0),0x46546c67);assert.equal(file.readUInt32LE(4),2);assert.equal(file.readUInt32LE(8),file.length);
const jsonLength=file.readUInt32LE(12);assert.equal(file.readUInt32LE(16),0x4e4f534a);
const gltf=JSON.parse(file.subarray(20,20+jsonLength).toString()),binStart=20+jsonLength;
assert.equal(file.readUInt32LE(binStart+4),0x004e4942);const bin=file.subarray(binStart+8,binStart+8+file.readUInt32LE(binStart));
const atlasPath='public/models/female/atlas-female.json',atlas=JSON.parse(fs.readFileSync(atlasPath));
const original=[],point=new Vector3();
function walk(index,parent,ancestry){
  const node=gltf.nodes[index],local=node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(
    new Vector3(...(node.translation||[0,0,0])),new Quaternion(...(node.rotation||[0,0,0,1])),new Vector3(...(node.scale||[1,1,1])));
  const world=parent.clone().multiply(local),chain=[...ancestry,{index,name:node.name,localDeterminant:local.determinant()}];
  if(node.mesh!==undefined)for(const primitive of gltf.meshes[node.mesh].primitives){
    const a=gltf.accessors[primitive.attributes.POSITION];assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');assert.ok(!a.sparse);
    const view=gltf.bufferViews[a.bufferView];assert.equal(view.buffer||0,0);
    const offset=(view.byteOffset||0)+(a.byteOffset||0),stride=view.byteStride||12,box=new Box3();
    for(let i=0;i<a.count;i++)box.expandByPoint(point.set(...[0,1,2].map(j=>bin.readFloatLE(offset+i*stride+j*4))).applyMatrix4(world));
    original.push({name:node.name,conceptId:`HRA:${node.name.replace(/^(VH_F|VH|Allen|Yao)(_|$)/,'')||'body'}`,
      sourceVertices:a.count,bounds:[box.min.toArray(),box.max.toArray()],worldMatrix:world.toArray(),worldDeterminant:world.determinant(),ancestry:chain});
  }
  for(const child of node.children||[])walk(child,world,chain);
}
for(const root of gltf.scenes[gltf.scene||0].nodes)walk(root,new Matrix4(),[]);
assert.equal(original.length,956);
const sourceSkin=original.find(p=>p.name==='VH_F_skin'),skin=atlas.parts.find(p=>p.id==='HRAF0003');assert.ok(sourceSkin&&skin);
const shift=skin.bounds[0].map((v,i)=>v-sourceSkin.bounds[0][i]);
const selected=atlas.parts.filter(p=>p.system==='brain'||['HRAF0026','HRAF0065','HRAF0067','HRAF0069','HRAF0911','HRAF0937'].includes(p.id));
assert.equal(selected.length,289);
const rows=selected.map(p=>{
  const matches=original.filter(s=>s.conceptId===p.conceptId);assert.equal(matches.length,1,p.id);const s=matches[0];
  const transformed=s.bounds.map(b=>b.map((v,i)=>v+shift[i]));
  const maxBoundResidualMm=Math.max(...transformed.flatMap((b,j)=>b.map((v,i)=>Math.abs(v-p.bounds[j][i])*1000)));
  assert.ok(maxBoundResidualMm<.01,`${p.id}: source-to-import bound mismatch ${maxBoundResidualMm}mm`);
  return {id:p.id,name:p.name,system:p.system,sourceName:s.name,sourceConcept:p.conceptId,
    sourceBounds:s.bounds,shiftedSourceBounds:transformed,importManifestBounds:p.bounds,maxBoundResidualMm,
    sourceVertices:s.sourceVertices,importVertices:p.vertexCount,worldDeterminant:s.worldDeterminant,ancestry:s.ancestry,
    centerX:(transformed[0][0]+transformed[1][0])/2};
});
const controls=rows.filter(p=>p.system!=='brain');
const leftEye=controls.find(p=>p.id==='HRAF0065'),rightEye=controls.find(p=>p.id==='HRAF0026');
const midlineX=(leftEye.centerX+rightEye.centerX)/2;
assert.ok(leftEye.centerX>rightEye.centerX);
const brain=rows.filter(p=>p.system==='brain');
const summaries={};
for(const side of ['left','right']){
  const named=brain.filter(p=>p.name.includes(`(${side})`));
  summaries[side]={meshes:named.length,positiveOfEyeMidpoint:named.filter(p=>p.centerX>midlineX).length,
    negativeOfEyeMidpoint:named.filter(p=>p.centerX<midlineX).length,nearMidlineWithin2mm:named.filter(p=>Math.abs(p.centerX-midlineX)<=.002).map(p=>p.id)};
}
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report={status:'ORIGINAL SOURCE LATERALITY INCONSISTENCY OBSERVED; no relabel/reflection applied',
  createdAt:new Date().toISOString(),sourceUrl:'https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/assets/3d-vh-f-united.glb',
  originalMeshPrimitives:original.length,comparedBrainMeshes:brain.length,comparedControlMeshes:controls.length,translationFromSkin:shift,
  midlineXFromEyes:midlineX,maximumBoundResidualMm:Math.max(...rows.map(r=>r.maxBoundResidualMm)),sideSummary:summaries,
  limitations:['Bounds verify source placement and imported manifest agreement, not every simplified vertex or clinical laterality.',
    'Eye midpoint is a numeric comparison reference, not an expert-defined midsagittal plane; near-midline pieces must not be relabelled by centre sign.',
    'Source L/R labels are retained. This audit does not authorize mirroring geometry or swapping canonical identifiers.',
    'HRA describes its brain as mirrored Allen reference structures resized for female/male bodies, not a sex-specific donor brain scan.'],rows,
  files:[path,atlasPath,'scripts/audit-hra-brain-source.mjs','package-lock.json'].map(path=>({path,sha256:hash(path)}))};
fs.writeFileSync('.cache/neural-bone/hra-brain-source.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({maxResidualMm:report.maximumBoundResidualMm,sideSummary:summaries,controls:controls.map(p=>({id:p.id,name:p.name,centerX:p.centerX})),brainNegativeDeterminants:brain.filter(p=>p.worldDeterminant<0).length},null,2));
