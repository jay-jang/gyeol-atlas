// Offline rejection screen: never writes public geometry or registration data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {surfaceProbe,surfaceTopology,referencedVertices} from './lib/surface-containment.mjs';

const candidatePath='.cache/arm-registration/candidates.json';
const read=path=>JSON.parse(fs.readFileSync(path));
const sha256=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const candidate=read(candidatePath);
for(const file of candidate.files)assert.equal(sha256(file.path),file.sha256,`Stale candidate: ${file.path}`);
const atlas=read('public/models/female/atlas-female.json'),buffers=new Map();
function geometry(part) {
  if(!buffers.has(part.chunk))buffers.set(part.chunk,gunzipSync(fs.readFileSync(`public/models/female/${atlas.chunks[part.chunk].gzip.split('/').pop()}`)));
  const bytes=buffers.get(part.chunk),positions=new Float32Array(part.vertexCount*3),indices=new Uint32Array(part.indexCount);
  for(let i=0;i<positions.length;i++)positions[i]=bytes.readFloatLE(part.positions+4*i);
  for(let i=0;i<indices.length;i++)indices[i]=bytes.readUInt32LE(part.indices+4*i);
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(positions,3));g.setIndex(new BufferAttribute(indices,1));return g;
}
const skin=geometry(atlas.parts.find(p=>p.name==='Skin')),topology=surfaceTopology(skin);
assert.equal(topology.connectedComponents,1);assert.equal(topology.boundaryEdges,0);assert.equal(topology.nonManifoldEdges,0);
const probe=surfaceProbe(skin);
function containment(g) {
  const vertices=referencedVertices(g,Infinity),positions=g.getAttribute('position');
  const result={vertices:vertices.length,inside:0,outside:0,'surface-band':0,ambiguous:0,maxOutsideMm:0};
  for(const index of vertices){
    const r=probe.classify(new Vector3().fromBufferAttribute(positions,index));result[r.kind]++;
    if(r.kind==='outside')result.maxOutsideMm=Math.max(result.maxOutsideMm,r.distance*1000);
  }
  return result;
}
function vertexSurfaceGap(a,b) {
  // Vertex-to-triangle minimum is a geometric proxy, not an articular gap:
  // it can miss edge-edge minima, cartilage, and matching contact regions.
  const clone=b.clone(),bvh=new MeshBVH(clone),position=a.getAttribute('position');let distance=Infinity;
  for(const index of referencedVertices(a,Infinity))distance=Math.min(distance,bvh.closestPointToPoint(new Vector3().fromBufferAttribute(position,index)).distance);
  clone.dispose();return distance*1000;
}
const report={status:'EXPERIMENT ONLY — not deployed; containment cannot establish correct anatomy',topology,arms:[],
  limitations:['Vertex-to-triangle joint minima are unsigned, one-way proxies; they do not detect all intersections or validate cartilage/contact regions.',
    'Distal joint pairs share one similarity transform. Their scaled distance checks test transform implementation, not improved joint anatomy.',
    'No elbow, wrist or finger articulation is fitted; the shoulder pivot is only an upstream geometric proxy.'],
  files:[candidatePath,'scripts/audit-arm-candidate.mjs','scripts/lib/surface-containment.mjs'].map(path=>({path,sha256:sha256(path)}))};
for(const arm of candidate.arms){
  const meshes=new Map(),rows=[];
  for(const part of arm.parts){
    const source=atlas.parts.find(p=>p.id===part.id);assert.ok(source);
    const before=geometry(source),after=before.clone();
    if(part.transformed){
      const positions=after.getAttribute('position');
      for(let i=0;i<positions.count;i++){
        const p=[positions.getX(i),positions.getY(i),positions.getZ(i)];
        const q=arm.translation.map((v,j)=>v+p.reduce((sum,c,k)=>sum+c*arm.linear[k][j],0));
        positions.setXYZ(i,...q);
      }
      rows.push({id:part.id,name:part.name,before:containment(before),after:containment(after)});
    }
    meshes.set(part.name.toLowerCase(),{before,after});
  }
  const joints=[['scapula','humerus'],['humerus','radius'],['humerus','ulna'],['radius','scaphoid'],['radius','lunate']].map(([a,b])=>{
    const first=meshes.get(`${arm.side} ${a}`),second=meshes.get(`${arm.side} ${b}`);
    assert.ok(first&&second,`${arm.side}: missing joint pair ${a}/${b}`);
    const before=vertexSurfaceGap(first.before,second.before),after=vertexSurfaceGap(first.after,second.after);
    const sharedTransform=a!=='scapula';
    if(sharedTransform)assert.ok(Math.abs(after-before*arm.scale)<.001,`${a}/${b}: similarity must preserve scaled relative distances`);
    return {pair:[a,b],sharedTransform,beforeVertexSurfaceMinimumMm:before,
      afterVertexSurfaceMinimumMm:after};
  });
  const summary=Object.fromEntries(['before','after'].map(stage=>[stage,{
    meshes:rows.length,vertices:rows.reduce((n,p)=>n+p[stage].vertices,0),
    outsideVertices:rows.reduce((n,p)=>n+p[stage].outside,0),
    outsideMeshes:rows.filter(p=>p[stage].outside>0).length,
    maxOutsideMm:Math.max(...rows.map(p=>p[stage].maxOutsideMm)),
  }]));
  report.arms.push({side:arm.side,summary,joints,parts:rows});
  console.log(JSON.stringify({side:arm.side,summary,joints}));
  for(const pair of meshes.values()){pair.before.dispose();pair.after.dispose();}
}
probe.dispose();skin.dispose();
fs.writeFileSync('.cache/arm-registration/candidate-audit.json',JSON.stringify(report,null,2)+'\n');
