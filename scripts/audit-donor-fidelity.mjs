// Compare donor STL and packed meshes in the SAME original donor coordinates.
// The inverse of each reproduced group transform removes registration effects.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {referencedVertices} from './lib/surface-containment.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';

const root=process.argv[2];assert.ok(root,'Pass extracted STL directory');
const files=new Map(),read=p=>{const b=fs.readFileSync(p);files.set(p,createHash('sha256').update(b).digest('hex'));return b;};
const archive=JSON.parse(read('docs/anatomy-alignment/donor-source-comparison.json'));
const source=JSON.parse(read('data/catalog/female-atlas-source.json'));
for(const f of source.files)assert.equal(createHash('sha256').update(read(f.path)).digest('hex'),f.sha256,f.path);
const atlas=JSON.parse(read('public/models/female/atlas-female.json'));
const chunks=atlas.chunks.map(c=>gunzipSync(fs.readFileSync(`public/models/female/${c.gzip.split('/').pop()}`)));
const loader=new STLLoader(),parts=[],point=new Vector3();
const matrix=f=>new Matrix4().set(...f.rows[0].map(v=>v*f.scale),f.offset[0],...f.rows[1].map(v=>v*f.scale),f.offset[1],...f.rows[2].map(v=>v*f.scale),f.offset[2],0,0,0,1);
const finish=g=>{g.computeBoundingBox();g.boundsTree=new MeshBVH(g);return g;};
const metrics=(from,to)=>{
  const values=[];for(const i of referencedVertices(from,Infinity))values.push(to.boundsTree.closestPointToPoint(point.fromBufferAttribute(from.attributes.position,i)).distance*1000);
  values.sort((a,b)=>a-b);return {vertices:values.length,medianMm:values[Math.floor(values.length*.5)],p95Mm:values[Math.floor(values.length*.95)],maximumMm:values.at(-1),over025mm:values.filter(v=>v>.025).length};
};
const report={createdAt:new Date().toISOString(),status:'SOURCE FIDELITY AUDIT; no runtime changes',meshes:[],pairs:[],
  limitations:['All named donor muscles are restored to their original shared source frame; this does not align them to the HRA body.',
    'Distances cover indexed vertices in both directions, not continuous Hausdorff distance or original tissue segmentation accuracy.',
    'Differences include the upstream welding/simplification/Float32 packing pipeline; not every error can be assigned to simplification alone.',
    'Triangle crossings do not measure solid penetration depth or clinical injury. No crossing does not exclude complete containment.',
    'Both normally hidden rectus femoris meshes are included. Muscle coverage is not all human muscles.']};
for(const muscle of archive.muscles){
  const file=path.join(root,muscle.source),bytes=read(file),sourceRecord=archive.files.find(f=>f.file===muscle.source);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),sourceRecord.sha256,muscle.id);
  const loaded=loader.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));loaded.scale(.001,.001,.001);loaded.deleteAttribute('normal');
  const raw=finish(mergeVertices(loaded,1e-9));loaded.dispose();
  const part=atlas.parts.find(p=>p.id===muscle.id);assert.equal(part.name,muscle.name);const b=chunks[part.chunk],packed=new BufferGeometry();
  packed.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>b.readFloatLE(part.positions+4*i)),3));
  packed.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>b.readUInt32LE(part.indices+4*i)),1));
  packed.applyMatrix4(matrix(archive.fits[muscle.fitGroup]).invert());finish(packed);
  const row={id:muscle.id,name:muscle.name,fitGroup:muscle.fitGroup,rawTriangles:raw.index.count/3,packedTriangles:packed.index.count/3,
    packedToRaw:metrics(packed,raw),rawToPacked:metrics(raw,packed)};
  parts.push({id:muscle.id,name:muscle.name,raw,packed});report.meshes.push(row);
  console.log(JSON.stringify({id:row.id,packedToRawMaxMm:row.packedToRaw.maximumMm,rawToPackedMaxMm:row.rawToPacked.maximumMm}));
}
assert.equal(parts.length,76);
function crossings(a,b){
  if(!a.boundingBox.intersectsBox(b.boundingBox)||!a.boundsTree.intersectsGeometry(b,new Matrix4()))return null;
  const result=triangleCrossings(a,b),witness=meshCrossingWitness(a,b);
  if(result.strictPlaneStraddlingPairs)assert.ok(witness,'BVH crossing lacks an independent segment/triangle witness');
  return {...result,witness};
}
let pairs=0;
for(let a=0;a<parts.length;a++)for(let b=a+1;b<parts.length;b++){
  pairs++;const raw=crossings(parts[a].raw,parts[b].raw),packed=crossings(parts[a].packed,parts[b].packed);
  if(raw||packed)report.pairs.push({ids:[parts[a].id,parts[b].id],names:[parts[a].name,parts[b].name],raw,packed});
}
assert.equal(pairs,2850);
report.summary={muscles:76,evaluatedPairs:pairs,rawIntersectingPairs:report.pairs.filter(p=>p.raw).length,
  packedIntersectingPairs:report.pairs.filter(p=>p.packed).length,newPackedCrossingPairs:report.pairs.filter(p=>!p.raw&&p.packed).length,
  maximumPackedToRawMm:Math.max(...report.meshes.map(p=>p.packedToRaw.maximumMm)),maximumRawToPackedMm:Math.max(...report.meshes.map(p=>p.rawToPacked.maximumMm)),
  rawTriangles:report.meshes.reduce((n,p)=>n+p.rawTriangles,0),packedTriangles:report.meshes.reduce((n,p)=>n+p.packedTriangles,0)};
for(const p of ['scripts/audit-donor-fidelity.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-crossings.mjs','scripts/lib/triangle-witness.mjs','package-lock.json'])read(p);
report.files=[...files].map(([p,sha256])=>({path:p.startsWith(root)?path.relative(root,p):p,sha256}));
fs.mkdirSync('.cache/donor-fidelity',{recursive:true});fs.writeFileSync('.cache/donor-fidelity/audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));parts.forEach(p=>{p.raw.dispose();p.packed.dispose();});
