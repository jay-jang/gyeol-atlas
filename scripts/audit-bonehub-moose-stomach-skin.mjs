// Offline same-donor CT stomach-label voxel centres versus HRA female skin.
// Voxel centres are not a mesh surface; skin containment is not registration.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferAttribute,BufferGeometry,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {surfaceProbe,surfaceTopology} from './lib/surface-containment.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=path=>JSON.parse(fs.readFileSync(path));
const receipt=read('docs/anatomy-alignment/bonehub-moose-stomach-centres.json');
const atlas=read('public/models/female/atlas-female.json');
const byId=new Map(atlas.parts.map(part=>[part.id,part]));
const buffers=new Map(),compressedHashes=new Map();
function packed(id){
  const part=byId.get(id);assert.ok(part,id);
  if(!buffers.has(part.chunk)){
    const chunk=atlas.chunks[part.chunk];
    const compressed=fs.readFileSync(`public/models/female/${chunk.gzip.split('/').pop()}`);
    assert.equal(compressed.length,chunk.gzipBytes);
    const raw=gunzipSync(compressed);assert.equal(raw.length,chunk.bytes);
    buffers.set(part.chunk,raw);compressedHashes.set(part.chunk,hash(compressed));
  }
  const raw=buffers.get(part.chunk),geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>
    raw.readFloatLE(part.positions+4*i)),3));
  geometry.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>
    raw.readUInt32LE(part.indices+4*i)),1));
  return geometry;
}
const geometry=packed('HRAF0003');
const topology=surfaceTopology(geometry);
assert.deepEqual([topology.connectedComponents,topology.boundaryEdges,topology.nonManifoldEdges],[1,0,0]);
const pointFile=receipt.pointFile;
assert.ok(pointFile.startsWith('.cache/bonehub-moose/'));
const bytes=fs.readFileSync(pointFile);
assert.equal(hash(bytes),receipt.pointFileSha256);
assert.equal(bytes.length,receipt.voxels*12);
const probe=surfaceProbe(geometry,.002);
const counts={inside:0,'surface-band':0,outside:0,ambiguous:0};
const examples=[];
const point=new Vector3();
let maxOutsideMm=0;
for(let i=0;i<receipt.voxels;i++){
  const offset=i*12;
  point.set(bytes.readFloatLE(offset),bytes.readFloatLE(offset+4),bytes.readFloatLE(offset+8));
  const classified=probe.classify(point);
  counts[classified.kind]++;
  if(classified.kind==='outside'){
    maxOutsideMm=Math.max(maxOutsideMm,classified.distance*1000);
    if(examples.length<20)examples.push({index:i,pointMetres:point.toArray(),surfaceDistanceMm:classified.distance*1000});
  }
}
assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),receipt.voxels);
const proximity={};
for(const [name,id] of [['liverCapsule','HRAF0474'],['gastricImpression','HRAF0467']]){
  const target=packed(id),tree=new MeshBVH(target),distances=new Float64Array(receipt.voxels);
  for(let i=0;i<receipt.voxels;i++){
    const offset=i*12;
    point.set(bytes.readFloatLE(offset),bytes.readFloatLE(offset+4),bytes.readFloatLE(offset+8));
    distances[i]=tree.closestPointToPoint(point).distance*1000;
  }
  distances.sort();
  proximity[name]={id,topology:surfaceTopology(target),
    minDistanceMm:distances[0],
    p01DistanceMm:distances[Math.floor((distances.length-1)*.01)],
    p05DistanceMm:distances[Math.floor((distances.length-1)*.05)],
    medianDistanceMm:distances[Math.floor((distances.length-1)*.5)],
    centresWithin2mm:distances.filter(distance=>distance<=2).length};
  target.dispose();
}
probe.dispose();geometry.dispose();
const report={
  status:'OFFLINE CT STOMACH VOXEL-CENTRE SKIN SCREEN; NOT ORGAN REGISTRATION',
  sourceReceipt:'docs/anatomy-alignment/bonehub-moose-stomach-centres.json',
  sourceReceiptSha256:hash(fs.readFileSync('docs/anatomy-alignment/bonehub-moose-stomach-centres.json')),
  femaleAtlasSha256:hash(fs.readFileSync('public/models/female/atlas-female.json')),
  sourceChunkSha256:Object.fromEntries(compressedHashes),
  skinTopology:topology,
  toleranceMm:2,
  testedVoxelCentres:receipt.voxels,counts,maxOutsideMm,examples,proximity,
  limitations:[
    'The 2 mm automatic mask is not a validated stomach surface; voxel centres omit cell faces and between-centre crossings.',
    'The thoracic-spine rigid candidate does not prove stomach/skin alignment or neighbouring organ connections.',
    'The HRA skin is a closed surface, not proof of a filled tissue volume or clinical stomach position.',
    'Distances from interior voxel centres to liver/gastric-impression surfaces are proximity screens, not stomach-surface gaps or tissue intersection tests.',
  ],
  scriptSha256:hash(fs.readFileSync('scripts/audit-bonehub-moose-stomach-skin.mjs')),
};
fs.writeFileSync('docs/anatomy-alignment/bonehub-moose-stomach-skin.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({tested:receipt.voxels,counts,maxOutsideMm}));
