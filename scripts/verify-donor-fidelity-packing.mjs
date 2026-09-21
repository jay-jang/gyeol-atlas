// Independent readback of BOTH candidate binary streams, including triangle
// identity for the unsimplified stream and complete muscle-pair crossing sets.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {MeshBVH} from 'three-mesh-bvh';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
const root=process.argv[2];assert.ok(root,'Pass source STL directory');
const out='.cache/donor-fidelity',report=JSON.parse(fs.readFileSync(`${out}/source-candidate.json`));
const source=JSON.parse(fs.readFileSync('docs/anatomy-alignment/donor-source-comparison.json'));
const baseline=JSON.parse(fs.readFileSync(`${out}/audit.json`));
const key=ids=>[...ids].sort().join('/'),expected=baseline.pairs.filter(p=>p.raw).map(p=>key(p.ids)).sort();
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const loader=new STLLoader();
function triangles(g){
  const p=g.attributes.position,index=g.index,count=index?.count??p.count,list=[];
  for(let i=0;i<count;i+=3){
    const vertices=[0,1,2].map(j=>{const n=index?index.getX(i+j):i+j;return [p.getX(n),p.getY(n),p.getZ(n)].join(',');});
    // Rotate, never reverse: preserve winding as well as the point set.
    const rotations=[0,1,2].map(k=>[...vertices.slice(k),...vertices.slice(0,k)].join('|'));list.push(rotations.sort()[0]);
  }return list.sort();
}
const results=[];
for(const [variant,metadata] of [['candidate',report],['full',report.unsimplifiedAlternative]]){
  const file=`${out}/source-${variant}.bin.gz`;assert.equal(sha(file),metadata.sha256);
  const zip=fs.readFileSync(file);assert.equal(zip.length,metadata.gzipBytes);const b=gunzipSync(zip);assert.equal(b.length,metadata.bytes);
  const parts=[];let consumed=0;
  for(const p of metadata.parts){
    assert.equal(p.positions,consumed);assert.equal(p.indices,p.positions+p.vertexCount*12);
    consumed=p.indices+p.indexCount*4;assert.ok(consumed<=b.length);assert.equal(p.indexCount%3,0);
    const g=new BufferGeometry(),positions=Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i));
    assert.ok(positions.every(Number.isFinite));const indices=Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i));assert.ok(indices.every(i=>i<p.vertexCount));
    g.setAttribute('position',new BufferAttribute(positions,3));g.setIndex(new BufferAttribute(indices,1));
    if(variant==='full'){
      const m=source.muscles.find(m=>m.id===p.id),s=source.files.find(f=>f.file===m.source),rawPath=path.join(root,m.source);assert.equal(sha(rawPath),s.sha256);
      const bytes=fs.readFileSync(rawPath),raw=loader.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));raw.scale(.001,.001,.001);
      assert.deepEqual(triangles(g),triangles(raw),`${p.id}: triangle/winding changed`);raw.dispose();
    }
    g.computeBoundingBox();g.boundsTree=new MeshBVH(g);parts.push({id:p.id,g});
  }
  assert.equal(parts.length,76);assert.equal(new Set(parts.map(p=>p.id)).size,76);assert.equal(consumed,b.length);
  const pairs=[];let tested=0;
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
    tested++;const a=parts[i],c=parts[j];if(!a.g.boundingBox.intersectsBox(c.g.boundingBox)||!a.g.boundsTree.intersectsGeometry(c.g,new Matrix4()))continue;
    const witness=meshCrossingWitness(a.g,c.g);assert.ok(witness);pairs.push({key:key([a.id,c.id]),witness});
  }
  assert.equal(tested,2850);assert.deepEqual(pairs.map(p=>p.key).sort(),expected);
  results.push({variant,file:path.basename(file),sha256:sha(file),bytes:b.length,gzipBytes:zip.length,meshes:76,testedPairs:tested,
    crossingPairs:pairs.length,triangleIdentityChecked:variant==='full',triangles:metadata.parts.reduce((n,p)=>n+p.indexCount/3,0),pairs});
  parts.forEach(p=>p.g.dispose());console.log(JSON.stringify({variant,meshes:76,crossingPairs:pairs.length,triangleIdentityChecked:variant==='full'}));
}
fs.writeFileSync(`${out}/readback.json`,JSON.stringify({status:'SOURCE PACKING VERIFIED, not HRA registration or clinical approval',createdAt:new Date().toISOString(),results,
  files:['scripts/verify-donor-fidelity-packing.mjs','scripts/lib/triangle-witness.mjs',`${out}/source-candidate.json`,`${out}/audit.json`].map(file=>({file,sha256:sha(file)}))},null,2)+'\n');
