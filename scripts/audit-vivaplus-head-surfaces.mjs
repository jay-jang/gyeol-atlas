// Source-frame diagnostics only; missing brain groups are not a complete brain.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BufferGeometry,BufferAttribute} from 'three';
import {surfaceTopology} from './lib/surface-containment.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';
const folder='.cache/vivaplus-head';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const input=JSON.parse(fs.readFileSync(`${folder}/consistent-surfaces.json`));
const extraction=JSON.parse(fs.readFileSync(`${folder}/consistent-extraction.json`));
assert.equal(sha(`${folder}/consistent-surfaces.json`),extraction.geometrySha256);
const geometries=new Map(),topology=[];
for(const mesh of input.meshes){
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new BufferAttribute(new Float32Array(mesh.positions),3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(mesh.indices),1));
  let maxFloat32ErrorMm=0;
  for(let i=0;i<mesh.positions.length;i++)maxFloat32ErrorMm=Math.max(maxFloat32ErrorMm,Math.abs(mesh.positions[i]-geometry.attributes.position.array[i])*1000);
  assert.ok(maxFloat32ErrorMm<.0001);
  const edgeDirections=new Map(),triangles=new Set();let duplicateTriangles=0;
  for(let i=0;i<mesh.indices.length;i+=3){
    const ids=mesh.indices.slice(i,i+3).map(n=>mesh.sourceNodeIds[n]);
    const signature=[...ids].sort((a,b)=>a-b).join('/');
    if(triangles.has(signature))duplicateTriangles++;
    triangles.add(signature);
    for(let j=0;j<3;j++){
      const a=ids[j],b=ids[(j+1)%3],key=a<b?`${a}/${b}`:`${b}/${a}`;
      const value=edgeDirections.get(key)??{count:0,balance:0};
      value.count++;value.balance+=a<b?1:-1;edgeDirections.set(key,value);
    }
  }
  topology.push({id:mesh.id,method:mesh.method,...surfaceTopology(geometry),maxFloat32ErrorMm,duplicateTriangles,
    sourceIdTwoFaceWindingConflicts:[...edgeDirections.values()].filter(v=>v.count===2&&v.balance!==0).length});
  geometries.set(mesh.id,geometry);
}
const pairs=[];
for(const ids of [['skull-trabecular-union','head-skin-union']]){
  assert.ok(ids.every(id=>geometries.has(id)));
  pairs.push({ids,...triangleCrossings(...ids.map(id=>geometries.get(id)))});
}
const result={geometrySha256:extraction.geometrySha256,topology,pairs,rejectedGroups:extraction.failures,
  deployed:false,hraRegistered:false,anatomicallyValidated:false,
  limitations:['Topology welds exact Float32 coordinates for counting only; source geometry is not altered.',
    'The skull union contains trabecular volume boundaries only, not cortical thickness, mandible or teeth.',
    'Open head skin is not used as a closed solid for containment. No brain/skull containment assertion.',
    'Zero triangle crossings is not proof of separation, correct correspondence or anatomical placement.',
    'Source-ID edge winding and duplicate counts do not establish absence of self-intersection or geometric validity.',
    'Six rejected brain/CSF PARTs and the brain union are absent; retained groups must not be called a complete head.'],
  code:['scripts/audit-vivaplus-head-surfaces.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-crossings.mjs'].map(path=>({path,sha256:sha(path)}))};
fs.writeFileSync(`${folder}/surface-audit.json`,JSON.stringify(result,null,2)+'\n');
for(const geometry of geometries.values())geometry.dispose();
console.log(JSON.stringify({groups:topology.length,unions:topology.filter(r=>r.id.endsWith('union')),pairs},null,2));
