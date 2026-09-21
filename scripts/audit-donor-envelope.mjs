// Compare final donor muscles against raw surfaces in their unchanged source
// frame. This is a geometry diagnostic, never a registration or runtime export.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3,DoubleSide,Ray} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {surfaceTopology,surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';

const root=process.argv[2];assert.ok(root,'Pass extraction root containing Original 3D STL Models-stl');
const files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>{const b=fs.readFileSync(p);files.set(p,sha(b));return b;};
const receipt=JSON.parse(read('docs/anatomy-alignment/donor-original-receipt.json'));
const packing=JSON.parse(read('docs/anatomy-alignment/donor-fidelity-packing.json')).unsimplifiedAlternative;
const gzip=read('.cache/donor-fidelity/source-full.bin.gz');assert.equal(sha(gzip),packing.sha256);
const packed=gunzipSync(gzip);assert.equal(packed.length,packing.bytes);
assert.equal(packing.parts.length,76);
const point=new Vector3(),results=[];
const tally=()=>({inside:0,outside:0,'surface-band':0,ambiguous:0,maximumOutsideMm:0});
const out='.cache/donor-original-envelope';fs.mkdirSync(out,{recursive:true});
for(const [name,limit] of [['All',Infinity],['Fat_Outer',512],['Inner',512]]){
  const record=receipt.combined.find(r=>r.entry.endsWith(`/VHF_Both_${name}.stl`));assert.ok(record);
  const file=path.join(root,record.entry),bytes=read(file);assert.equal(sha(bytes),record.sha256);
  let surface=new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  assert.equal(surface.attributes.position.count,record.triangleVertexOccurrences);
  surface.deleteAttribute('normal');surface.scale(.001,.001,.001);
  const topology=surfaceTopology(surface);console.log(JSON.stringify({name,topology}));
  const probe=surfaceProbe(surface,.002),rows=[];
  for(const part of packing.parts){
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>packed.readFloatLE(part.positions+4*i)),3));
    geometry.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>packed.readUInt32LE(part.indices+4*i)),1));
    const indices=referencedVertices(geometry,limit),counts=tally(),ambiguousWitnesses=[],bandWitnesses=[];let maximumWitness=null,firstInsideWitness=null;
    for(const vertex of indices){
      point.fromBufferAttribute(geometry.attributes.position,vertex);const c=probe.classify(point);counts[c.kind]++;
      if(c.kind==='ambiguous')ambiguousWitnesses.push({vertex,pointMetres:point.toArray(),distanceMm:c.distance*1000});
      if(c.kind==='surface-band'&&bandWitnesses.length<3)bandWitnesses.push({vertex,pointMetres:point.toArray(),distanceMm:c.distance*1000});
      if(c.kind==='inside'&&!firstInsideWitness)firstInsideWitness={vertex,pointMetres:point.toArray(),distanceMm:c.distance*1000};
      if(c.kind==='outside'&&c.distance*1000>counts.maximumOutsideMm){
        counts.maximumOutsideMm=c.distance*1000;maximumWitness={vertex,pointMetres:point.toArray(),distanceMm:c.distance*1000};
      }
    }
    assert.equal(indices.length,Object.entries(counts).filter(([key])=>key!=='maximumOutsideMm').reduce((n,[,v])=>n+v,0));
    rows.push({id:part.id,name:part.name,sourceVertices:part.vertexCount,samples:indices.length,...counts,maximumWitness,firstInsideWitness,ambiguousWitnesses,firstThreeBandWitnesses:bandWitnesses});
    geometry.dispose();
    if(rows.length%10===0)console.log(`${name}: ${rows.length}/76 muscles`);
  }
  const summary={meshes:rows.length,samples:rows.reduce((n,r)=>n+r.samples,0),...tally()};
  for(const key of ['inside','outside','surface-band','ambiguous'])summary[key]=rows.reduce((n,r)=>n+r[key],0);
  summary.maximumOutsideMm=Math.max(...rows.map(r=>r.maximumOutsideMm));
  const ambiguousRayDiagnostics=[];
  if(summary.ambiguous){
    const tree=new MeshBVH(surface),directions=[[1,.137,.071],[.117,1,.193],[.073,.127,1]];
    for(let i=0;i<32;i++){
      const z=1-2*(i+.5)/32,a=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-z*z);directions.push([r*Math.cos(a),r*Math.sin(a),z]);
    }
    for(const row of rows)for(const witness of row.ambiguousWitnesses){
      const p=new Vector3(...witness.pointMetres),rays=directions.map(values=>{
        const direction=new Vector3(...values).normalize(),hits=tree.raycast(new Ray(p,direction),DoubleSide).sort((a,b)=>a.distance-b.distance);
        const crossings=[];let last=-Infinity;
        for(const hit of hits)if(hit.distance-last>1e-7){crossings.push(hit);last=hit.distance;}
        return {direction:direction.toArray(),rawHits:hits.length,crossings:crossings.length,parity:crossings.length%2,
          hits:hits.map(h=>({distanceMetres:h.distance,pointMetres:h.point.toArray(),faceIndex:h.faceIndex}))};
      });
      ambiguousRayDiagnostics.push({id:row.id,...witness,rays});
    }
  }
  const result={name,file,sha256:record.sha256,topology,toleranceMm:2,sampling:limit===Infinity?'every referenced muscle vertex':'512 deterministic referenced vertices per muscle',summary,rows,ambiguousRayDiagnostics};
  results.push(result);fs.writeFileSync(`${out}/${name}.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({name,summary}));
  probe.dispose();surface.dispose();surface=null;
}
for(const p of ['scripts/audit-donor-envelope.mjs','scripts/lib/surface-containment.mjs','package-lock.json'])read(p);
const report={createdAt:new Date().toISOString(),status:'SOURCE-FRAME DIAGNOSTIC; NO ATLAS TRANSFORM OR RUNTIME CHANGE',results,
  limitations:['All/Inner interpretation remains a geometry hypothesis; file names and manifold topology alone are insufficient.',
    'Fat_Outer is a tissue volume combining skin and fat, not automatically a filled-body containment surface.',
    'Raw surfaces and Final muscles are different processing stages; residual differences are not necessarily registration errors.',
    'The 2mm band is a numerical screen. Parity is not a signed-distance proof for self-intersecting surfaces.',
    'All-muscle-vertex results do not cover triangle interiors, exact tissue attachments, or clinical validity.',
    'Outer/Inner are sampled only and must not be generalized to all vertices. No self-intersection test is performed.'],
  files:[...files].map(([file,sha256])=>({file,sha256}))};
fs.writeFileSync(`${out}/audit.json`,JSON.stringify(report,null,2)+'\n');
