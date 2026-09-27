// Scope: the single new mapped-source iliacus/pelvis pair, not fixed HRA fit.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3,Matrix4} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {mapCompactDisplacements} from './lib/compact-displacement.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
import {subdivideSourceTriangles as subdivide} from './lib/subdivide-source.mjs';
const root=process.argv[2];assert.ok(root);const out='.cache/lower-body-bone-flow';
const sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p));
const report=json(`${out}/report.json`),audit=json(`${out}/readback.json`);assert.equal(audit.reportSha256,sha(read(`${out}/report.json`)));
const cases=audit.boneMuscleRelations.filter(r=>!r.source&&r.mappedSource);assert.equal(cases.length,1);const entry=cases[0];assert.equal(entry.muscleId,'VHF0028');assert.equal(entry.bone,'Pelvis');
const side=report.sides.find(s=>s.side===entry.side),initial=new Matrix4().fromArray(side.initialMatrix);
const source=json('docs/anatomy-alignment/donor-source-comparison.json'),packing=json('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative;
const zipped=read('.cache/donor-fidelity/source-full.bin.gz');assert.equal(sha(zipped),packing.sha256);const raw=gunzipSync(zipped),p=packing.parts.find(p=>p.id===entry.muscleId);
let muscle={positions:Float64Array.from({length:p.vertexCount*3},(_,i)=>raw.readFloatLE(p.positions+4*i)),indices:Uint32Array.from({length:p.indexCount},(_,i)=>raw.readUInt32LE(p.indices+4*i))};
const f=source.files.find(f=>f.side===entry.side&&f.kind==='bone'&&f.structure===entry.bone),bytes=read(path.join(root,f.file));assert.equal(sha(bytes),f.sha256);
const parsed=new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));parsed.scale(.001,.001,.001);parsed.deleteAttribute('normal');const welded=mergeVertices(parsed,1e-9);parsed.dispose();let bone={positions:Float64Array.from(welded.attributes.position.array),indices:Uint32Array.from(welded.index.array)};welded.dispose();
function geometry(input){
  const positions=new Float32Array(input.positions.length),v=new Vector3();let maximumCentroidChordErrorMm=0;
  for(let i=0;i<input.positions.length;i+=3){v.fromArray(input.positions,i);positions.set(mapCompactDisplacements(v,initial,side.steps).point.toArray(),i);}
  // Every source triangle midpoint is mapped from its original plane. Compare
  // it with the straight displayed triangle centroid (not a surface bound).
  for(let i=0;i<input.indices.length;i+=3){const ids=input.indices.subarray(i,i+3),source=new Vector3(),linear=new Vector3();for(const id of ids){source.add(v.fromArray(input.positions,id*3));linear.add(v.fromArray(positions,id*3));}source.multiplyScalar(1/3);linear.multiplyScalar(1/3);maximumCentroidChordErrorMm=Math.max(maximumCentroidChordErrorMm,1000*linear.distanceTo(mapCompactDisplacements(source,initial,side.steps).point));}
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(positions,3));g.setIndex(new BufferAttribute(input.indices,1));g.computeBoundingBox();g.boundsTree=new MeshBVH(g,{indirect:true});return {g,vertices:positions.length/3,triangles:input.indices.length/3,maximumCentroidChordErrorMm};
}
const result={createdAt:new Date().toISOString(),reportSha256:sha(read(`${out}/report.json`)),auditSha256:sha(read(`${out}/readback.json`)),case:{side:entry.side,bone:entry.bone,muscleId:entry.muscleId},levels:[],limitations:['Uniform midpoint refinement preserves original flat source triangles before the same nonlinear map. Native HRA bones are not refined or corrected here.','Full pair intersection is rescreened at each tested level. Centroid chord error is a finite sample, not a continuous approximation bound.','Removing this discretization crossing does not resolve44 native HRA bone relationships or skin/ligament failures. No runtime model is changed.']};
for(let level=0;level<=2;level++){
  const a=geometry(muscle),b=geometry(bone),crosses=a.g.boundsTree.intersectsGeometry(b.g,new Matrix4()),witness=crosses?meshCrossingWitness(a.g,b.g):null;
  const row={level,muscle:{vertices:a.vertices,triangles:a.triangles,maximumCentroidChordErrorMm:a.maximumCentroidChordErrorMm},bone:{vertices:b.vertices,triangles:b.triangles,maximumCentroidChordErrorMm:b.maximumCentroidChordErrorMm},crosses,witness};result.levels.push(row);console.log(JSON.stringify(row));a.g.dispose();b.g.dispose();
  if(level<2){muscle=subdivide(muscle);bone=subdivide(bone);}
}
result.scriptSha256=sha(read('scripts/probe-bone-flow-triangulation.mjs'));result.subdivisionSha256=sha(read('scripts/lib/subdivide-source.mjs'));fs.writeFileSync(`${out}/triangulation.json`,JSON.stringify(result,null,2)+'\n');
