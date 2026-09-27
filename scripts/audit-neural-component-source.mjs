// Diagnose assembly provenance and cord/bone overlap. Never edits atlas assets.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3} from 'three';
import {officialMeshes} from './lib/official-meshes.mjs';
import {surfaceTopology,surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';

const out='.cache/neural-component-source',files=new Map();
const digest=b=>createHash('sha256').update(b).digest('hex');
const read=file=>{const b=fs.readFileSync(file);files.set(file,digest(b));return b;};
const json=file=>JSON.parse(read(file)),hashArray=a=>digest(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
const reference=json('docs/anatomy-alignment/female-neural-source.json');
const atlas=json('public/models/female/atlas-female.json');
const unitedFile='.cache/neural-bone/hra-united-female-v1.10.glb',united=read(unitedFile);
assert.equal(digest(united),reference.files.find(f=>f.file===unitedFile).sha256);
const upstreamCommit='fca41ae2e23f825f2921843c276e80509fa778f1';
const definitions=[
  {organ:'brain',file:'brain-female-v1.4.glb',version:'v1.4',count:283,gitBlob:'f854b1a4566e3025a1519bc38b78878da882b726',path:'brain-female/v1.4/raw/3d-allen-f-brain.glb'},
  {organ:'spinal-cord',file:'spinal-cord-female-v1.1.glb',version:'v1.1',count:29,gitBlob:'8f5f22edc05279a5e85679a037f40f775166c1fa',path:'spinal-cord-female/v1.1/raw/3d-vh-f-spinal-cord.glb'},
];
const components=[];
for(const def of definitions){
  const file=`${out}/${def.file}`,bytes=read(file);
  const gitBlob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');assert.equal(gitBlob,def.gitBlob);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  const names=gltf.nodes.filter(n=>n.mesh!==undefined).map(n=>n.name);assert.equal(names.length,def.count);
  const own=officialMeshes(bytes,names,[0,0,0]),assembled=officialMeshes(united,names,[0,0,0]);
  const rows=names.map(name=>{
    const a=own.get(name),b=assembled.get(name),positions=a.geometry.attributes.position.array,indices=Uint32Array.from(a.geometry.index.array);
    assert.deepEqual(positions,b.geometry.attributes.position.array);assert.deepEqual(indices,Uint32Array.from(b.geometry.index.array));
    const row={name,componentNode:a.nodeIndex,unitedNode:b.nodeIndex,componentWorld:a.worldMatrix,unitedWorld:b.worldMatrix,
      vertices:positions.length/3,indices:indices.length,positionSha256:hashArray(positions),indexSha256:hashArray(indices),maxCoordinateDifferenceMm:0};
    a.geometry.dispose();b.geometry.dispose();return row;
  });
  components.push({...def,file,bytes:bytes.length,url:`https://raw.githubusercontent.com/hubmapconsortium/hra-kg/${upstreamCommit}/digital-objects/ref-organ/${def.path}`,rows});
}
// Explicit source hierarchy: all 29 cord descendants; all 25 named vertebrae
// plus sacrum. Discs, cartilage, roots and other tissues are outside this test.
const cords=reference.spinalHierarchy.descendants.map(d=>reference.records.find(r=>r.id===d.id));
const bones=reference.records.filter(r=>/^VH_F_(?:(?:cervical|thoracic|lumbar)_vertebra_\d+|sacrum)$/.test(r.sourceName||''));
assert.equal(cords.length,29);assert.equal(bones.length,26);
const parts=[...cords,...bones],source=officialMeshes(united,parts.map(p=>p.sourceName),reference.translationFromSkin);
const chunks=new Map();
function runtime(id){
  const p=atlas.parts.find(p=>p.id===id);assert.ok(p.system==='nervous'||p.system==='skeletal');
  if(!chunks.has(p.chunk))chunks.set(p.chunk,gunzipSync(read(`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').pop()}`)));
  const b=chunks.get(p.chunk),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+i*4)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+i*4)),1));return g;
}
const geometry=new Map(parts.map(p=>[p.id,{source:source.get(p.sourceName).geometry,runtime:runtime(p.id)}]));
// These exact IDs must be excluded from current restoration/registration sets.
for(const f of ['female-source-restoration','female-knee-source-restoration','female-arm-registration','female-foot-registration','female-brain-bindings']){
  const text=read(`data/catalog/${f}.json`).toString();
  for(const p of parts)assert.ok(!text.includes(`"${p.id}"`),`Runtime special case needs audit: ${p.id}/${f}`);
}
const modes=[];const point=new Vector3();
for(const mode of ['source','runtime']){
  const boneRows=bones.map(b=>{
    const g=geometry.get(b.id)[mode],topology=surfaceTopology(g);g.computeBoundingBox();
    // No clinical inference: even a closed mesh may self-intersect or be wrong.
    const supported=topology.connectedComponents===1&&topology.boundaryEdges===0&&topology.nonManifoldEdges===0&&topology.degenerateTriangles===0;
    return {id:b.id,name:b.name,topology,supported,geometry:g,probe:supported?surfaceProbe(g,1e-6):null};
  });
  const rows=[];
  for(const c of cords){
    const g=geometry.get(c.id)[mode],used=referencedVertices(g,Infinity),positions=g.attributes.position;g.computeBoundingBox();
    for(const b of boneRows){
      const counts={inside:0,outside:0,'surface-band':0,ambiguous:0,unsupported:0},ambiguousPoints=[];let deepest=null;
      for(const vertex of used){
        point.fromBufferAttribute(positions,vertex);
        if(!b.geometry.boundingBox.containsPoint(point)){counts.outside++;continue;}
        if(!b.probe){counts.unsupported++;continue;}
        const r=b.probe.classify(point);counts[r.kind]++;
        if(r.kind==='ambiguous')ambiguousPoints.push({vertex,point:point.toArray(),distanceMm:r.distance*1000});
        if(r.kind==='inside'&&(!deepest||r.distance*1000>deepest.distanceMm))deepest={vertex,point:point.toArray(),distanceMm:r.distance*1000};
      }
      rows.push({cordId:c.id,cordName:c.name,boneId:b.id,boneName:b.name,vertices:used.length,...counts,deepest,ambiguousPoints});
    }
  }
  const summary={pairs:rows.length,insidePairs:rows.filter(r=>r.inside).length,insideVertexPairOccurrences:rows.reduce((n,r)=>n+r.inside,0),
    ambiguous:rows.reduce((n,r)=>n+r.ambiguous,0),unsupported:rows.reduce((n,r)=>n+r.unsupported,0),maximumInsideBoundaryDistanceMm:Math.max(0,...rows.map(r=>r.deepest?.distanceMm||0))};
  modes.push({mode,bones:boneRows.map(({geometry,probe,...r})=>r),summary,rows});
  console.log(JSON.stringify({mode,...summary}));boneRows.forEach(r=>r.probe?.dispose());
}
// Geometry for reproducible diagnostic sections only; not deployable models.
const geometryFile=`${out}/geometry.json.gz`;
fs.writeFileSync(geometryFile,gzipSync(JSON.stringify(parts.map(p=>({id:p.id,name:p.name,kind:cords.includes(p)?'cord':'bone',
  ...Object.fromEntries(['source','runtime'].map(mode=>[mode,{positions:[...geometry.get(p.id)[mode].attributes.position.array],indices:[...geometry.get(p.id)[mode].index.array]}]))})))));
read(geometryFile);
for(const f of ['scripts/audit-neural-component-source.mjs','scripts/lib/official-meshes.mjs','scripts/lib/surface-containment.mjs'])read(f);
const report={createdAt:new Date().toISOString(),status:'Diagnostic only; no model, label, coordinate or interaction changes',upstreamCommit,components,
  frameTranslation:reference.translationFromSkin,toleranceMm:.001,geometryFile,modes,
  limitations:['Coordinate equality is for Float32 world positions and full index arrays, not raw local accessor bytes or clinical accuracy.',
    'Source brain names are compared without runtime laterality swapping; equality does not undo the separate binding correction.',
    'Each pair tests every triangle-referenced cord vertex against the bone bounding box and, within it, three-ray parity/nearest triangle distance.',
    'Inside results are geometric classifications of closed component surfaces, not diagnosed bone penetration. Self-intersection and tissue validity remain unverified.',
    'Distances are from inside vertices to the nearest bone surface, not maximum solid penetration, overlap volume or clinical tolerance.',
    'Source and runtime vertex counts differ; count differences are not area/volume changes. Triangle interiors, roots, discs and other tissues are not sampled.',
    'All 29 recorded cord segments and 26 named skeletal meshes are included; the female donor has six numbered lumbar vertebrae.'],
  files:[...files].map(([file,sha256])=>({file,sha256}))};
fs.writeFileSync('docs/anatomy-alignment/neural-component-source.json',JSON.stringify(report,null,2)+'\n');
for(const g of geometry.values())for(const mode of ['source','runtime'])g[mode].dispose();
