// Source screen for a possible BodyParts3D 4.0 stomach/related-vessel view.
// Reads pinned source buffers only; does not approve anatomical continuity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {NodeIO} from '@gltf-transform/core';
import {referencedVertices} from './lib/surface-containment.mjs';

const sourcePath='.cache/male-details/atlas.json';
const relationPath='.cache/bp4-official/v40-FMA2Obj.zip';
const packedPath='public/models/male-detail/atlas.json';
const packedBinaryPath='public/models/male-detail/organs.bin.gz';
const catalogPath='data/male-detail-structures.json';
const groupsPath='data/male-detail-groups.json';
const source=JSON.parse(fs.readFileSync(sourcePath));
const packed=JSON.parse(fs.readFileSync(packedPath));
const packedBytes=gunzipSync(fs.readFileSync(packedBinaryPath));
assert.equal(packedBytes.length,packed.chunks[0].bytes);
const catalog=JSON.parse(fs.readFileSync(catalogPath));
const groups=JSON.parse(fs.readFileSync(groupsPath));
const mapping=execFileSync('unzip',['-p',relationPath,'FMA2Obj.txt'],{encoding:'utf8'});
assert.match(mapping,/^# Data Version\t4\.0$/m);
const expected=[
  {conceptId:'FMA7148',id:'FJ2564',name:'Stomach',system:'digestive'},
  {conceptId:'FMA14768',id:'FJ3499',name:'Left gastric artery',system:'arterial'},
  {conceptId:'FMA14776',id:'FJ3594',name:'Right gastric artery',system:'arterial'},
  {conceptId:'FMA15399',id:'FJ3500',name:'Left gastric vein',system:'venous'},
  {conceptId:'FMA15400',id:'FJ3595',name:'Right gastric vein',system:'venous'},
  {conceptId:'FMA14796',id:'FJ3501',name:'Left gastro-epiploic artery',system:'arterial'},
  {conceptId:'FMA14781',id:'FJ3596',name:'Right gastro-epiploic artery',system:'arterial'},
  {conceptId:'FMA15390',id:'FJ3502',name:'Left gastroepiploic vein',system:'venous'},
  {conceptId:'FMA15397',id:'FJ3597',name:'Right gastroepiploic vein',system:'venous'},
];
const overviewPath='public/models/organ.glb';
const buffers=new Map(),files=[sourcePath,relationPath,packedPath,packedBinaryPath,catalogPath,groupsPath,overviewPath,
  'scripts/audit-male-stomach-source.mjs'];
function geometry(part){
  const chunk=source.chunks[part.chunk],path=`.cache/male-details/${chunk.gzip.split('/').at(-1)}`;
  if(!buffers.has(path)){
    const zip=fs.readFileSync(path),bytes=gunzipSync(zip);
    assert.equal(zip.length,chunk.gzipBytes);assert.equal(bytes.length,chunk.bytes);
    buffers.set(path,bytes);files.push(path);
  }
  const bytes=buffers.get(path),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>bytes.readFloatLE(part.positions+i*4)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>bytes.readUInt32LE(part.indices+i*4)),1));
  g.computeBoundingBox();return g;
}
const parts=expected.map(row=>{
  const concept=source.concepts.find(c=>c.id===row.conceptId);
  assert.deepEqual(concept?.elements,[row.id]);
  assert.match(mapping,new RegExp(`^${row.conceptId}\\tis_a\\t${row.id}$`,'m'));
  const part=source.parts.find(p=>p.id===row.id);
  assert.ok(part);assert.equal(part.name,row.name);assert.equal(part.conceptId,row.conceptId);
  assert.equal(part.system,row.system);
  return {...row,part,g:geometry(part)};
});
const stomach=parts[0],stomachTree=new MeshBVH(stomach.g);
const group=groups.find(g=>g.id==='stomach');
assert.ok(group);assert.equal(group.sex,'male');
assert.deepEqual(group.sourceConcepts,expected.map(row=>row.conceptId));
assert.deepEqual(group.ids,expected.map(row=>`BP4_${row.id}`));
const rows=parts.map(({conceptId,id,name,system,part,g})=>{
  const packedId=`BP4_${id}`,target=packed.parts.find(p=>p.id===packedId);
  const item=catalog.find(p=>p.id===packedId);
  assert.ok(target&&item);assert.equal(item.group,'stomach');assert.equal(item.name,name);
  assert.equal(item.fmaId,conceptId);assert.equal(item.layer,system==='digestive'?'organ':'vessel');
  assert.deepEqual(target.bounds,part.bounds);
  assert.equal(target.vertexCount,part.vertexCount);assert.equal(target.indexCount,part.indexCount);
  const sourceBytes=buffers.get(`.cache/male-details/${source.chunks[part.chunk].gzip.split('/').at(-1)}`);
  const fieldSha256={};
  for(const [field,length] of [['positions',part.vertexCount*12],['normals',part.vertexCount*6],['indices',part.indexCount*4]]){
    const from=sourceBytes.subarray(part[field],part[field]+length);
    const to=packedBytes.subarray(target[field],target[field]+length);
    assert.equal(to.length,length);assert.ok(from.equals(to),`${packedId} ${field} differs from source`);
    fieldSha256[field]=createHash('sha256').update(to).digest('hex');
  }
  let minMm=null,medianMm=null,maxMm=null;
  if(id!==stomach.id){
    const distances=referencedVertices(g,Infinity).map(index=>
      stomachTree.closestPointToPoint(new Vector3().fromBufferAttribute(g.attributes.position,index)).distance*1000)
      .sort((a,b)=>a-b);
    minMm=distances[0];medianMm=distances[Math.floor(distances.length/2)];maxMm=distances.at(-1);
  }
  return {conceptId,id:packedId,name,system,vertices:part.vertexCount,triangles:part.indexCount/3,
    bounds:part.bounds,fieldSha256,stomachVertexSurfaceDistanceMm:{minimum:minMm,median:medianMm,maximum:maxMm}};
});
const overviewDoc=await new NodeIO().read(overviewPath);
const overviewNode=overviewDoc.getRoot().listNodes().find(n=>n.getName()==='FMA7148'&&n.getMesh());
assert.ok(overviewNode,'Missing deployed 3.0 stomach');
const primitive=overviewNode.getMesh().listPrimitives();assert.equal(primitive.length,1);
const position=primitive[0].getAttribute('POSITION');assert.ok(position);
const overview=new BufferGeometry();
overview.setAttribute('position',new BufferAttribute(new Float32Array(position.getArray()),3));
if(primitive[0].getIndices())overview.setIndex(new BufferAttribute(new Uint32Array(primitive[0].getIndices().getArray()),1));
overview.applyMatrix4(new Matrix4().fromArray(overviewNode.getWorldMatrix()));
overview.computeBoundingBox();
const overviewTree=new MeshBVH(overview);
const nearest=(from,toTree)=>{
  const distances=referencedVertices(from,Infinity).map(index=>
    toTree.closestPointToPoint(new Vector3().fromBufferAttribute(from.attributes.position,index)).distance*1000)
    .sort((a,b)=>a-b);
  return {vertices:distances.length,minimumMm:distances[0],medianMm:distances[Math.floor(distances.length/2)],
    p95Mm:distances[Math.floor((distances.length-1)*.95)],maximumMm:distances.at(-1)};
};
const overviewRelation={source:'deployed BodyParts3D 3.0 stomach FMA7148 versus separate 4.0 detail FJ2564',
  sourceToOverview:nearest(stomach.g,overviewTree),overviewToSource:nearest(overview,stomachTree),
  boundsCenterDistanceMm:stomach.g.boundingBox.getCenter(new Vector3()).distanceTo(overview.boundingBox.getCenter(new Vector3()))*1000};
overview.dispose();
const report={status:'PACKED DETAIL AUDIT: exact official 4.0 membership and source buffers, no continuity/clinical approval',
  limitations:['The nine rows are independent is_a concepts, not an official nine-element part_of stomach bundle.',
    'One-way vertex-to-stomach-surface distance does not establish vessel contact or vascular supply.',
    'The source 4.0 frame has not been locally registered to the existing 3.0 overview body or female HRA body; unsigned surfaces alone cannot approve a registration.'],
  overviewRelation,rows,files:files.map(path=>({path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex')}))};
for(const {g} of parts)g.dispose();
const output=process.env.STOMACH_SOURCE_AUDIT_OUTPUT;
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({overviewRelation,rows:rows.map(row=>({id:row.id,name:row.name,distanceMm:row.stomachVertexSurfaceDistanceMm}))}));
