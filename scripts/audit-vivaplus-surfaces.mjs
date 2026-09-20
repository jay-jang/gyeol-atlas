// Offline source geometry diagnostic. No changes to deployed atlas or registration.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BufferGeometry,BufferAttribute} from 'three';
import {surfaceTopology} from './lib/surface-containment.mjs';
import {jointSurfaceRelation} from './lib/joint-geometry.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';
const folder='.cache/vivaplus';
const sha256=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const input=JSON.parse(fs.readFileSync(`${folder}/surfaces.json`));
const extraction=JSON.parse(fs.readFileSync(`${folder}/surface-extraction.json`));
assert.equal(sha256(`${folder}/surfaces.json`),extraction.geometryFileSha256);
const geometries=new Map(),topology=[];
const meshById=new Map(input.meshes.map(m=>[m.id,m]));
for(const mesh of input.meshes){
  const g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(new Float32Array(mesh.positions),3));
  g.setIndex(new BufferAttribute(new Uint32Array(mesh.indices),1));
  const maxFloat32ErrorMm=Math.max(...mesh.positions.map((v,i)=>Math.abs(v-g.attributes.position.array[i])*1000));
  assert.ok(maxFloat32ErrorMm<.0001,'Float32 conversion exceeds 0.0001 mm');
  geometries.set(mesh.id,g);
  topology.push({id:mesh.id,...surfaceTopology(g),maxFloat32ErrorMm});
}
const pairs=[['clavicle','scapula'],['scapula','humerus'],['humerus','radius'],['humerus','ulna'],
  ['radius','ulna'],['radius','carpal-aggregate'],['ulna','carpal-aggregate'],['carpal-aggregate','phalangeal-aggregate']];
const joints=[];
for(const side of ['left','right'])for(const [a,b] of pairs){
  const ids=[`${side}-${a}`,`${side}-${b}`];
  const firstIds=new Set(meshById.get(ids[0]).sourceNodeIds);
  const sharedSourceNodeCount=meshById.get(ids[1]).sourceNodeIds.filter(id=>firstIds.has(id)).length;
  const geometryPair=ids.map(id=>geometries.get(id));
  joints.push({side,ids,sharedSourceNodeCount,...jointSurfaceRelation(...geometryPair),...triangleCrossings(...geometryPair)});
}
const report={source:input.source,files:['scripts/extract-vivaplus-surfaces.py','scripts/audit-vivaplus-surfaces.mjs',
  'scripts/lib/surface-containment.mjs','scripts/lib/joint-geometry.mjs','scripts/lib/triangle-crossings.mjs',`${folder}/surfaces.json`].map(path=>({path,sha256:sha256(path)})),
  topology,joints,deployed:false,hraRegistered:false,anatomicallyValidated:false,
  limitations:['Topology welds exact Float32 coordinate duplicates only for its diagnostics; extracted geometry is not altered.',
    'Surface intersection also includes touching; it is not a penetration-volume or cartilage test.',
    'Unsigned one-way vertex-to-surface minima do not establish anatomical joint gaps.',
    'Plane straddle extent describes intersecting triangles, not solid penetration depth/volume.',
    'Boundary extraction and triangulation are not physical shell thickness or finite-element interpolation.',
    'Open skin is not used for parity containment. No source or HRA containment claim.']};
fs.writeFileSync(`${folder}/surface-audit.json`,JSON.stringify(report,null,2)+'\n');
for(const g of geometries.values())g.dispose();
console.log(JSON.stringify({topology,joints},null,2));
