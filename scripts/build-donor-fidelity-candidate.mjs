// Source-coordinate packing experiment, never a runtime atlas replacement.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {MeshoptSimplifier} from 'meshoptimizer';
import {referencedVertices} from './lib/surface-containment.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';
await MeshoptSimplifier.ready;
const root=process.argv[2];assert.ok(root,'Pass extracted STL directory');
const baselinePath='.cache/donor-fidelity/audit.json',baseline=JSON.parse(fs.readFileSync(baselinePath));
const source=JSON.parse(fs.readFileSync('docs/anatomy-alignment/donor-source-comparison.json'));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pairKey=ids=>[...ids].sort().join('/');
const rawPairs=new Map(baseline.pairs.filter(p=>p.raw).map(p=>[pairKey(p.ids),p.raw]));
const loader=new STLLoader(),parts=[],point=new Vector3(),absoluteTargetErrorM=.00001;
const finish=g=>{g.computeBoundingBox();g.boundsTree=new MeshBVH(g);return g;};
for(const m of source.muscles){
  const sourceRecord=source.files.find(f=>f.file===m.source),file=path.join(root,m.source);assert.equal(sha(file),sourceRecord.sha256);
  const b=fs.readFileSync(file),g=loader.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));g.scale(.001,.001,.001);g.deleteAttribute('normal');
  const raw=finish(mergeVertices(g,1e-9));g.dispose();
  const [indices,error]=MeshoptSimplifier.simplify(new Uint32Array(raw.index.array),new Float32Array(raw.attributes.position.array),3,Math.floor(raw.index.count*.22/3)*3,absoluteTargetErrorM,['ErrorAbsolute']);
  const candidate=new BufferGeometry();candidate.setAttribute('position',new BufferAttribute(new Float32Array(raw.attributes.position.array),3));candidate.setIndex(new BufferAttribute(indices,1));finish(candidate);
  const rawToCandidateMaxMm=maxDistance(raw,candidate),candidateToRawMaxMm=maxDistance(candidate,raw);
  const restored=Math.max(rawToCandidateMaxMm,candidateToRawMaxMm)>.02;
  parts.push({id:m.id,name:m.name,raw,g:restored?raw:candidate,errorMetres:error,restored,
    initialRawToCandidateMaxMm:rawToCandidateMaxMm,restoreReason:restored?'measured vertex distance exceeds 0.02mm':null});
  if(restored)candidate.dispose();
}
const history=[];
for(let iteration=0;iteration<=76;iteration++){
  const restore=new Set();let tested=0;
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
    tested++;const a=parts[i],b=parts[j],raw=rawPairs.get(pairKey([a.id,b.id]));
    const intersects=a.g.boundingBox.intersectsBox(b.g.boundingBox)&&a.g.boundsTree.intersectsGeometry(b.g,new Matrix4());
    const candidate=intersects?triangleCrossings(a.g,b.g):null;
    // Preserve existing source crossing diagnostics as well as absent crossings.
    // This is a fidelity guard, not a clinical penetration metric.
    if(Boolean(raw)!==Boolean(candidate)||(raw&&candidate&&candidate.maxTrianglePlaneStraddleExtentMm>raw.maxTrianglePlaneStraddleExtentMm+.001)){
      if(!a.restored)restore.add(a.id);if(!b.restored)restore.add(b.id);
      assert.ok(!a.restored||!b.restored,'Raw pair disagrees with source audit');
    }
  }
  history.push({iteration,testedPairs:tested,restoreToRawIds:[...restore]});assert.equal(tested,2850);
  if(!restore.size)break;
  for(const p of parts)if(restore.has(p.id)){p.g.dispose();p.g=p.raw;p.restored=true;p.restoreReason='source pair crossing preservation';}
  assert.ok(iteration<76,'Restoration did not terminate');
}
function maxDistance(a,b){
  let max=0;for(const i of referencedVertices(a,Infinity))max=Math.max(max,b.boundsTree.closestPointToPoint(point.fromBufferAttribute(a.attributes.position,i)).distance);
  return max*1000;
}
const chunks=[],rows=[];let offset=0;
for(const p of parts){
  const from=referencedVertices(p.g,Infinity),remap=new Map(from.map((v,i)=>[v,i])),positions=new Float32Array(from.length*3);
  for(let i=0;i<from.length;i++)positions.set([p.g.attributes.position.getX(from[i]),p.g.attributes.position.getY(from[i]),p.g.attributes.position.getZ(from[i])],3*i);
  const indices=Uint32Array.from(p.g.index.array,i=>remap.get(i));
  const row={id:p.id,name:p.name,restoredRaw:p.restored,restoreReason:p.restoreReason,initialRawToCandidateMaxMm:p.initialRawToCandidateMaxMm,algorithmReportedErrorMm:p.errorMetres*1000,
    vertexCount:positions.length/3,indexCount:indices.length,positions:offset,indices:offset+positions.byteLength,
    candidateToRawMaxMm:maxDistance(p.g,p.raw),rawToCandidateMaxMm:maxDistance(p.raw,p.g)};
  rows.push(row);chunks.push(Buffer.from(positions.buffer),Buffer.from(indices.buffer));offset+=positions.byteLength+indices.byteLength;
}
const out='.cache/donor-fidelity';fs.mkdirSync(out,{recursive:true});const bytes=Buffer.concat(chunks),zip=gzipSync(bytes);
fs.writeFileSync(`${out}/source-candidate.bin.gz`,zip);
// Compare with an unsimplified alternative. Compacting exact referenced
// Float32 positions and gzip change storage, not the source triangle surfaces.
const fullChunks=[],fullParts=[];let fullOffset=0;
for(const p of parts){
  const from=referencedVertices(p.raw,Infinity),remap=new Map(from.map((v,i)=>[v,i])),positions=new Float32Array(from.length*3);
  for(let i=0;i<from.length;i++)positions.set([p.raw.attributes.position.getX(from[i]),p.raw.attributes.position.getY(from[i]),p.raw.attributes.position.getZ(from[i])],3*i);
  const indices=Uint32Array.from(p.raw.index.array,i=>remap.get(i));
  fullParts.push({id:p.id,name:p.name,vertexCount:positions.length/3,indexCount:indices.length,positions:fullOffset,indices:fullOffset+positions.byteLength});
  fullChunks.push(Buffer.from(positions.buffer),Buffer.from(indices.buffer));fullOffset+=positions.byteLength+indices.byteLength;
}
const fullBytes=Buffer.concat(fullChunks),fullZip=gzipSync(fullBytes);fs.writeFileSync(`${out}/source-full.bin.gz`,fullZip);
const report={createdAt:new Date().toISOString(),status:'SOURCE-COORDINATE CANDIDATE ONLY; not aligned to HRA and not loaded by app',
  absoluteTargetErrorM,measuredVertexDistanceLimitMm:.02,history,parts:rows,bytes:bytes.length,gzipBytes:zip.length,sha256:sha(`${out}/source-candidate.bin.gz`),
  summary:{restoredRawMeshes:rows.filter(p=>p.restoredRaw).length,triangles:rows.reduce((n,p)=>n+p.indexCount/3,0),
    maximumRawToCandidateMm:Math.max(...rows.map(p=>p.rawToCandidateMaxMm)),maximumCandidateToRawMm:Math.max(...rows.map(p=>p.candidateToRawMaxMm))},
  unsimplifiedAlternative:{parts:fullParts,triangles:fullParts.reduce((n,p)=>n+p.indexCount/3,0),bytes:fullBytes.length,gzipBytes:fullZip.length,sha256:sha(`${out}/source-full.bin.gz`)},
  limitations:['Approximate simplifier error is not a guaranteed Hausdorff bound. Actual all-indexed-vertex distances are reported separately.',
    'Source itself has transverse crossing pairs. Preserving its geometry is not proof of anatomically correct tissue boundaries.',
    'Pair guard restores full source meshes; it never translates, shrinks, deletes, or hides anatomy to remove a crossing.',
    'No HRA registration is performed. Runtime, skin, bone/nerve and joint validation remain separate requirements.'],
  provenance:[baselinePath,'docs/anatomy-alignment/donor-source-comparison.json','scripts/build-donor-fidelity-candidate.mjs','scripts/lib/triangle-crossings.mjs','package-lock.json'].map(file=>({file,sha256:sha(file)}))};
fs.writeFileSync(`${out}/source-candidate.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.summary,gzipBytes:zip.length,unsimplifiedGzipBytes:fullZip.length,history}));
parts.forEach(p=>{if(!p.restored)p.g.dispose();p.raw.dispose();});
