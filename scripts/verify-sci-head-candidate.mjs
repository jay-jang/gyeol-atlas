// Independent NRRD index/coordinate readback; source geometry remains cache-only.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
const root='.cache/sci-head',sha=b=>createHash('sha256').update(b).digest('hex');
const rawReport=fs.readFileSync(`${root}/candidate.json`),report=JSON.parse(rawReport);
for(const input of report.files){
  const path=`${root}/${input.url.split('/').at(-1)}`;assert.equal(sha(fs.readFileSync(path)),input.sha256);
}
const nrrd=execFileSync('unzip',['-p',`${root}/Segmentation.zip`,'Segmentation/HeadSegmentation.nrrd'],{maxBuffer:2e6});
assert.equal(sha(nrrd),report.files[0].memberSha256);
const split=nrrd.indexOf('\n\n'),header=nrrd.subarray(0,split).toString();
assert.match(header,/sizes: 208 256 256/);assert.match(header,/type: unsigned char/);
const origin=header.match(/space origin: \(([^)]+)\)/)[1].split(',').map(Number);
const voxels=gunzipSync(nrrd.subarray(split+2));assert.equal(voxels.length,208*256*256);
const packed=fs.readFileSync(report.binary.path);assert.equal(sha(packed),report.binary.sha256);
const binary=gunzipSync(packed);assert.equal(binary.length,report.binary.bytes);
const rows=[],geometries=new Map();
for(const part of report.parts){
  const labels=new Set(part.sourceLabels),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  const sample=(x,y,z)=>x<0||y<0||z<0||x>=208||y>=256||z>=256?0:Number(labels.has(voxels[x+208*(y+256*z)]));
  let edgeVertices=0,interiorVertices=0,maxEdgeError=0;
  for(let i=0;i<part.vertexCount;i++){
    const p=[0,1,2].map(a=>binary.readFloatLE(part.positions+4*(3*i+a)));
    p.forEach((v,a)=>{assert.ok(Number.isFinite(v));min[a]=Math.min(min[a],v);max[a]=Math.max(max[a],v);});
    const q=[p[0]*1000-origin[0],-p[2]*1000-origin[1],p[1]*1000-origin[2]];
    const low=q.map(Math.floor),frac=q.map((v,a)=>v-low[a]);let interpolated=0;
    for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++)
      interpolated+=sample(low[0]+x,low[1]+y,low[2]+z)*(x?frac[0]:1-frac[0])*(y?frac[1]:1-frac[1])*(z?frac[2]:1-frac[2]);
    if(q.filter(v=>Math.abs(v-Math.round(v))<.0002).length>=2){
      edgeVertices++;maxEdgeError=Math.max(maxEdgeError,Math.abs(interpolated-.5));assert.ok(Math.abs(interpolated-.5)<.0002,`${part.id}/${i}`);
    }else{interiorVertices++;assert.ok(interpolated>.001&&interpolated<.999,`${part.id}/${i}`);}
  }
  assert.deepEqual([min,max],part.bounds);
  for(let i=0;i<part.indexCount;i++)assert.ok(binary.readUInt32LE(part.indices+4*i)<part.vertexCount);
  rows.push({id:part.id,vertices:part.vertexCount,triangles:part.indexCount/3,edgeVertices,interiorVertices,maxEdgeError});
  console.log(JSON.stringify(rows.at(-1)));
  // Only the three stated skull/brain-label relations, not all tissues or self-intersections.
  if(['label-2','label-3','label-6'].includes(part.id)){
    const g=new BufferGeometry();
    g.setAttribute('position',new BufferAttribute(new Float32Array(binary.buffer,binary.byteOffset+part.positions,part.vertexCount*3).slice(),3));
    g.setIndex(new BufferAttribute(new Uint32Array(binary.buffer,binary.byteOffset+part.indices,part.indexCount).slice(),1));
    g.boundsTree=new MeshBVH(g);geometries.set(part.id,g);
  }
}
const crossings=[];
for(const [a,b] of [['label-2','label-6'],['label-3','label-6'],['label-2','label-3']]){
  const witness=meshCrossingWitness(geometries.get(a),geometries.get(b));crossings.push({a,b,witness});console.log(JSON.stringify(crossings.at(-1)));
}
const result={reportSha256:sha(rawReport),rows,totalVertices:rows.reduce((s,r)=>s+r.vertices,0),crossings,
  limitations:['All source-index/edge membership is checked, not the exact marching-cubes triangulation or clinical segmentation.',
    'Three mesh pairs only, using first transverse witness at 0.001mm plane-straddle tolerance. No witness does not prove separation; coplanar/edge contact is excluded.',
    'Anatomical names, shared-interface topology, self-intersections and HRA placement are not certified.'],
  codeSha256:sha(fs.readFileSync('scripts/verify-sci-head-candidate.mjs'))};
fs.writeFileSync(`${root}/candidate-readback.json`,JSON.stringify(result,null,2)+'\n');
for(const g of geometries.values())g.dispose();
