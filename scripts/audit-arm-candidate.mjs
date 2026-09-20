// Offline rejection screen: never writes public geometry or registration data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3,Ray,DoubleSide} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {surfaceProbe,surfaceTopology,referencedVertices} from './lib/surface-containment.mjs';
import {jointSurfaceRelation} from './lib/joint-geometry.mjs';

const handOnly=process.argv.includes('--hand');
const comparison=process.argv.find(arg=>arg.startsWith('--comparison='))?.split('=')[1];
assert.ok(!comparison||['area-upper','joint-upper','joint-area-upper','free-upper','hand-clearance'].includes(comparison),'Unknown comparison');
assert.ok(!comparison||!process.argv.some(arg=>['--hand','--articulated','--upper-existing','--coupled-hand'].includes(arg)),'Comparison modes cannot be combined with legacy modes');
const articulated=Boolean(comparison)||process.argv.includes('--articulated');
assert.ok(!(handOnly&&articulated),'Choose one experiment');
assert.ok(!process.argv.includes('--upper-existing')||articulated,'Upper-length mode requires articulated experiment');
assert.ok(!process.argv.includes('--coupled-hand')||(articulated&&process.argv.includes('--upper-existing')),'Coupled hand requires articulated existing-upper mode');
const prefix=comparison?`${comparison}-`:articulated?(process.argv.includes('--coupled-hand')?'articulated-coupled-hand-':process.argv.includes('--upper-existing')?'articulated-existing-upper-':'articulated-'):handOnly?'hand-':'';
const candidatePath=`.cache/arm-registration/${prefix}candidates.json`;
const read=path=>JSON.parse(fs.readFileSync(path));
const sha256=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const candidate=read(candidatePath);
for(const file of candidate.files)assert.equal(sha256(file.path),file.sha256,`Stale candidate: ${file.path}`);
const atlas=read('public/models/female/atlas-female.json'),buffers=new Map();
function geometry(part,manifest=atlas,folder='public/models/female') {
  const path=`${folder}/${manifest.chunks[part.chunk].gzip.split('/').pop()}`;
  if(!buffers.has(path))buffers.set(path,gunzipSync(fs.readFileSync(path)));
  const bytes=buffers.get(path),positions=new Float32Array(part.vertexCount*3),indices=new Uint32Array(part.indexCount);
  for(let i=0;i<positions.length;i++)positions[i]=bytes.readFloatLE(part.positions+4*i);
  for(let i=0;i<indices.length;i++)indices[i]=bytes.readUInt32LE(part.indices+4*i);
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(positions,3));g.setIndex(new BufferAttribute(indices,1));return g;
}
const skin=geometry(atlas.parts.find(p=>p.name==='Skin')),topology=surfaceTopology(skin);
assert.equal(topology.connectedComponents,1);assert.equal(topology.boundaryEdges,0);assert.equal(topology.nonManifoldEdges,0);
const probe=surfaceProbe(skin);
function containment(g,classifier=probe) {
  const vertices=referencedVertices(g,Infinity),positions=g.getAttribute('position');
  const result={vertices:vertices.length,inside:0,outside:0,'surface-band':0,ambiguous:0,maxOutsideMm:0};
  for(const index of vertices){
    const r=classifier.classify(new Vector3().fromBufferAttribute(positions,index));result[r.kind]++;
    if(r.kind==='outside')result.maxOutsideMm=Math.max(result.maxOutsideMm,r.distance*1000);
  }
  return result;
}
const report={status:'EXPERIMENT ONLY — not deployed; containment cannot establish correct anatomy',topology,arms:[],
  limitations:['Vertex-to-triangle joint minima are unsigned, one-way proxies; they do not detect all intersections or validate cartilage/contact regions. Separate triangle-intersection flags do not measure penetration volume or enclosed solids.',
    articulated?'Two-link proxy endpoints are constrained, but actual articular contacts, collisions and finger articulation are not fitted.':handOnly?'Only the hand bones move; unchanged proximal pairs are implementation controls, and wrist continuity is not enforced.':'Distal joint pairs share one similarity transform. Their scaled distance checks test transform implementation, not improved joint anatomy.',
    'Skin constrictions and adjacency patch centres are geometric proxies, not anatomically identified joint centres.',
    'A single closed manifold skin surface is not sufficient to prove it bounds the filled body: a tissue shell can enclose a hollow interior.'],
  files:[candidatePath,'scripts/audit-arm-candidate.mjs','scripts/lib/surface-containment.mjs','scripts/lib/joint-geometry.mjs'].map(path=>({path,sha256:sha256(path)}))};
if(handOnly){
  const donorAtlas=read('.cache/male-details/atlas.json');
  const donorSkin=geometry(donorAtlas.parts.find(p=>p.name==='Skin'),donorAtlas,'.cache/arm-registration');
  const donorTopology=surfaceTopology(donorSkin),donorProbe=surfaceProbe(donorSkin),rows=[];
  for(const part of candidate.arms.flatMap(a=>a.parts).filter(p=>p.transformed)){
    const donor=donorAtlas.parts.find(p=>p.id===part.sourceId);assert.ok(donor);
    const g=geometry(donor,donorAtlas,'.cache/arm-registration');
    rows.push({id:donor.id,name:donor.name,...containment(g,donorProbe)});g.dispose();
  }
  const topologyPass=donorTopology.connectedComponents===1&&donorTopology.boundaryEdges===0&&donorTopology.nonManifoldEdges===0;
  const rayGeometry=donorSkin.clone(),rayTree=new MeshBVH(rayGeometry);
  const rayDiagnostics=candidate.arms.map(arm=>({side:arm.side,origin:arm.sourceWrist,
    rays:[[1,.137,.071],[.117,1,.193],[.073,.127,1]].map(d=>{
      const direction=new Vector3(...d).normalize();
      const hits=rayTree.raycast(new Ray(new Vector3(...arm.sourceWrist),direction),DoubleSide).sort((a,b)=>a.distance-b.distance);
      return {direction:direction.toArray(),hits:hits.map(h=>({distanceMm:h.distance*1000,normalDotDirection:h.face.normal.dot(direction)}))};
    })}));
  rayGeometry.dispose();
  report.donor={topology:donorTopology,topologyPass,interpretable:false,
    interpretation:'Parity is NOT a body-exterior verdict. Topology alone cannot establish a filled-body envelope; inspect paired inner/outer crossings and the source-only scene.',
    rayDiagnostics,
    outsideVertices:rows.reduce((n,r)=>n+r.outside,0),maxOutsideMm:Math.max(...rows.map(r=>r.maxOutsideMm)),parts:rows};
  console.log(JSON.stringify({donor:{...report.donor,parts:undefined}}));
  donorProbe.dispose();donorSkin.dispose();
}
for(const arm of candidate.arms){
  const meshes=new Map(),rows=[];
  for(const part of arm.parts){
    const source=atlas.parts.find(p=>p.id===part.id);assert.ok(source);
    const before=geometry(source),after=before.clone();
    if(part.transformed){
      const positions=after.getAttribute('position');
      for(let i=0;i<positions.count;i++){
        const p=[positions.getX(i),positions.getY(i),positions.getZ(i)];
        const linear=part.linear||arm.linear,translation=part.translation||arm.translation;
        const q=translation.map((v,j)=>v+p.reduce((sum,c,k)=>sum+c*linear[k][j],0));
        positions.setXYZ(i,...q);
      }
      rows.push({id:part.id,name:part.name,before:containment(before),after:containment(after)});
    }
    meshes.set(part.name.toLowerCase(),{before,after,part});
  }
  const joints=[['scapula','humerus'],['humerus','radius'],['humerus','ulna'],['radius','scaphoid'],['radius','lunate']].map(([a,b])=>{
    const first=meshes.get(`${arm.side} ${a}`),second=meshes.get(`${arm.side} ${b}`);
    assert.ok(first&&second,`${arm.side}: missing joint pair ${a}/${b}`);
    const beforeRelation=jointSurfaceRelation(first.before,second.before),afterRelation=jointSurfaceRelation(first.after,second.after);
    const before=beforeRelation.vertexSurfaceMinimumMm,after=afterRelation.vertexSurfaceMinimumMm;
    const sharedTransform=articulated?first.part.group===second.part.group:handOnly?(!first.part.transformed&&!second.part.transformed):a!=='scapula';
    if(sharedTransform){
      const m=first.part.transformed?(first.part.linear||arm.linear):[[1,0,0],[0,1,0],[0,0,1]];
      const scale=Math.sqrt(m[0].reduce((n,v)=>n+v*v,0));
      assert.ok(Math.abs(after-before*scale)<.001,`${a}/${b}: similarity must preserve scaled relative distances`);
    }
    return {pair:[a,b],sharedTransform,beforeVertexSurfaceMinimumMm:before,
      afterVertexSurfaceMinimumMm:after,beforeTriangleSurfacesIntersect:beforeRelation.triangleSurfacesIntersect,
      afterTriangleSurfacesIntersect:afterRelation.triangleSurfacesIntersect};
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
const outsideVertices=report.arms.reduce((n,a)=>n+a.summary.after.outsideVertices,0);
const newJointSurfaceIntersections=report.arms.flatMap(a=>a.joints.filter(j=>j.afterTriangleSurfacesIntersect&&!j.beforeTriangleSurfacesIntersect).map(j=>({side:a.side,pair:j.pair})));
report.rejectionScreen={outsideVertices,newJointSurfaceIntersections,
  passedGeometricScreen:outsideVertices===0&&newJointSurfaceIntersections.length===0,
  anatomicallyValidated:false,deployed:false,
  scope:'Only the reported skin classification and named joint surface pairs; not all-bone collisions, cartilage, or anatomical correctness.'};
fs.writeFileSync(`.cache/arm-registration/${prefix}candidate-audit.json`,JSON.stringify(report,null,2)+'\n');
