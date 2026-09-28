// Offline candidate stomach boundary against current female HRA surfaces.
// Triangle crossings and surface distances are screens, not anatomy approval.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferAttribute,BufferGeometry,Matrix4,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {surfaceProbe,surfaceTopology} from './lib/surface-containment.mjs';
import {closestSurfacePair} from './lib/closest-surface-pair.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=path=>JSON.parse(fs.readFileSync(path));
const receipt=read('docs/anatomy-alignment/bonehub-moose-stomach-surface.json');
const atlas=read('public/models/female/atlas-female.json');
assert.equal(receipt.segmentationSha256,'220bbcb2c6d93634733da1c6d3d432d9c725604569c571f28629e024a8e9d28c');
assert.equal(receipt.thoraxScreenSha256,hash(fs.readFileSync('docs/anatomy-alignment/bonehub-thorax-screen.json')));
assert.equal(receipt.scriptSha256,hash(fs.readFileSync('scripts/export-bonehub-moose-stomach-surface.py')));
assert.equal(receipt.sourceVoxelCount,108011);
assert.ok(receipt.meshFile.startsWith('.cache/bonehub-moose/'));
const source=fs.readFileSync(receipt.meshFile);
assert.equal(hash(source),receipt.meshFileSha256);
assert.equal(source.length,(receipt.vertexCount+receipt.triangleCount)*12);
function geometryFromBytes(){
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(Float32Array.from({length:receipt.vertexCount*3},(_,i)=>source.readFloatLE(i*4)),3));
  const faceOffset=receipt.vertexCount*12;
  geometry.setIndex(new BufferAttribute(Uint32Array.from({length:receipt.triangleCount*3},(_,i)=>source.readUInt32LE(faceOffset+i*4)),1));
  geometry.computeBoundingBox();
  geometry.boundsTree=new MeshBVH(geometry,{indirect:true});
  return geometry;
}
const candidate=geometryFromBytes();
const candidateTopology=surfaceTopology(candidate);
assert.deepEqual([candidateTopology.connectedComponents,candidateTopology.boundaryEdges,
  candidateTopology.nonManifoldEdges,candidateTopology.degenerateTriangles],[1,0,0,0]);
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
  geometry.computeBoundingBox();
  geometry.boundsTree=new MeshBVH(geometry,{indirect:true});
  return geometry;
}
const skin=packed('HRAF0003'),skinTopology=surfaceTopology(skin);
assert.deepEqual([skinTopology.connectedComponents,skinTopology.boundaryEdges,skinTopology.nonManifoldEdges],[1,0,0]);
const probe=surfaceProbe(skin,.002),point=new Vector3();
const counts={inside:0,'surface-band':0,outside:0,ambiguous:0},examples=[];
let closestSkinMm=Infinity,maxOutsideMm=0;
for(let i=0;i<receipt.vertexCount;i++){
  point.fromBufferAttribute(candidate.attributes.position,i);
  const result=probe.classify(point);counts[result.kind]++;
  closestSkinMm=Math.min(closestSkinMm,result.distance*1000);
  if(result.kind==='outside'){
    maxOutsideMm=Math.max(maxOutsideMm,result.distance*1000);
    if(examples.length<20)examples.push({vertex:i,pointMetres:point.toArray(),skinDistanceMm:result.distance*1000});
  }
}
probe.dispose();
const identity=new Matrix4();
const skinTriangleCrossing=skin.boundingBox.intersectsBox(candidate.boundingBox)&&
  skin.boundsTree.intersectsGeometry(candidate,identity);
console.log(JSON.stringify({vertexCount:receipt.vertexCount,counts,skinTriangleCrossing}));
const targetIds=[
  'HRAF0474','HRAF0467', // liver capsule and gastric impression
  'HRAF0809','HRAF0810','HRAF0811','HRAF0812','HRAF0813', // spleen
  'HRAF0493','HRAF0494','HRAF0496','HRAF0497', // pancreas
  'HRAF0528','HRAF0554', // kidneys
];
const nearby=[];
for(const id of targetIds){
  const target=packed(id),boxOverlap=candidate.boundingBox.intersectsBox(target.boundingBox);
  const triangleIntersection=boxOverlap&&candidate.boundsTree.intersectsGeometry(target,identity);
  const relation=closestSurfacePair(candidate,target);
  const crossings=triangleIntersection?triangleCrossings(candidate,target):null;
  const witness=triangleIntersection?meshCrossingWitness(candidate,target):null;
  nearby.push({id,name:byId.get(id).name,boxOverlap,triangleIntersection,
    exactMinimumSurfaceDistanceMm:relation.minimumDistanceMm,
    strictPlaneStraddlingPairs:crossings?.strictPlaneStraddlingPairs??0,
    intersectingTrianglePairs:crossings?.intersectingTrianglePairs??0,
    maxTrianglePlaneStraddleExtentMm:crossings?.maxTrianglePlaneStraddleExtentMm??0,
    transverseWitness:witness?{pointMetres:witness.point,planeStraddleExtentMm:witness.planeStraddleExtentMm}:null});
  console.log(JSON.stringify({id,boxOverlap,triangleIntersection,distanceMm:relation.minimumDistanceMm}));
  target.dispose();
}
const report={
  status:'OFFLINE CT STOMACH LABEL SURFACE SCREEN; NOT REGISTERED HRA ANATOMY',
  sourceReceipt:'docs/anatomy-alignment/bonehub-moose-stomach-surface.json',
  sourceReceiptSha256:hash(fs.readFileSync('docs/anatomy-alignment/bonehub-moose-stomach-surface.json')),
  femaleAtlasSha256:hash(fs.readFileSync('public/models/female/atlas-female.json')),
  sourceChunkSha256:Object.fromEntries(compressedHashes),
  candidateTopology,skinTopology,toleranceMm:2,
  vertexCount:receipt.vertexCount,triangleCount:receipt.triangleCount,
  counts,closestSkinMm,maxOutsideMm,examples,skinTriangleCrossing,nearby,
  limitations:[
    'Marching Cubes on a 2 mm automatic CT label is not validated stomach-wall anatomy or a lumen/mucosa separation.',
    'Skin vertex containment plus surface nonintersection screens only this rigid candidate, not clinical organ position or HRA pose.',
    'Most HRA organ meshes here are open surfaces; triangle crossings mean geometric overlap, not proven tissue penetration.',
    'No oesophagus, duodenum, vessel or nerve connection is established by these checks.',
  ],
  scriptSha256:hash(fs.readFileSync('scripts/audit-bonehub-moose-stomach-surface.mjs')),
};
candidate.dispose();skin.dispose();
fs.writeFileSync('docs/anatomy-alignment/bonehub-moose-stomach-surface-screen.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output:'docs/anatomy-alignment/bonehub-moose-stomach-surface-screen.json'}));
