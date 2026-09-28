// Diagnostic only: screen the largest original BodyParts3D skin component
// against smaller source components and selected deployed male organ vertices.
// It does not establish an external body envelope or anatomical correctness.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {BufferAttribute,BufferGeometry,Matrix4,Vector3} from 'three';
import {surfaceProbe} from './lib/surface-containment.mjs';

const sourceFile='.cache/models/FMA7163.stl';
const bytes=fs.readFileSync(sourceFile);
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest=JSON.parse(fs.readFileSync('public/models/manifest.json'));
const skin=manifest.assets.find(part=>part.id==='FMA7163');
assert.ok(skin);
assert.equal(createHash('sha256').update(bytes).digest('hex'),skin.sha256);
const triangleCount=bytes.readUInt32LE(80);
assert.equal(triangleCount,skin.originalTriangles);
assert.equal(bytes.length,84+triangleCount*50);

const parents=new Uint32Array(triangleCount*3),indices=new Uint32Array(triangleCount*3);
const lookup=new Map(),rawPositions=[];
let vertexCount=0;
const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
for(let t=0;t<triangleCount;t++){
  const cornerIds=[];
  for(let c=0;c<3;c++){
    const at=84+t*50+12+c*12;
    const position=[bytes.readFloatLE(at),bytes.readFloatLE(at+4),bytes.readFloatLE(at+8)];
    assert.ok(position.every(Number.isFinite));
    const key=position.join('/');
    let id=lookup.get(key);
    if(id===undefined){id=vertexCount++;lookup.set(key,id);parents[id]=id;rawPositions.push(...position);}
    indices[t*3+c]=id;cornerIds.push(id);
  }
  parents[root(cornerIds[1])]=root(cornerIds[0]);
  parents[root(cornerIds[2])]=root(cornerIds[0]);
}
assert.equal(vertexCount,791729);
const components=new Map();
for(let t=0;t<triangleCount;t++){
  const id=root(indices[t*3]);
  let component=components.get(id);
  if(!component){component={root:id,triangles:0,firstTriangle:t};components.set(id,component);}
  component.triangles++;
}
const ranked=[...components.values()].sort((a,b)=>b.triangles-a.triangles);
assert.equal(ranked.length,528);
assert.equal(ranked[0].triangles,1532176);
const largestRoot=ranked[0].root;
const appPosition=id=>new Vector3(rawPositions[id*3]/1000,
  (rawPositions[id*3+2]+13.5175)/1000,
  (-rawPositions[id*3+1]-96.5107)/1000);
const geometry=new BufferGeometry(),remap=new Map(),positions=[],largestIndices=[];
for(let t=0;t<triangleCount;t++){
  if(root(indices[t*3])!==largestRoot)continue;
  for(let c=0;c<3;c++){
    const id=indices[t*3+c];
    let next=remap.get(id);
    if(next===undefined){next=remap.size;remap.set(id,next);positions.push(...appPosition(id).toArray());}
    largestIndices.push(next);
  }
}
geometry.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));
geometry.setIndex(new BufferAttribute(new Uint32Array(largestIndices),1));
geometry.computeBoundingBox();
const bounds={min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()};
console.log(`Largest source skin: ${ranked[0].triangles} triangles, ${remap.size} vertices; building BVH`);
const probe=surfaceProbe(geometry);
const tally=rows=>rows.reduce((out,row)=>{out[row.kind]=(out[row.kind]||0)+1;return out;},{});
const componentProbes=ranked.slice(1).map((component,rank)=>{
  const t=component.firstTriangle;
  const point=appPosition(indices[t*3]).add(appPosition(indices[t*3+1])).add(appPosition(indices[t*3+2])).multiplyScalar(1/3);
  const result=probe.classify(point);
  return {rank:rank+2,triangles:component.triangles,kind:result.kind,distanceMm:result.distance*1000,point:point.toArray()};
});

const organIds=['FMA7148','FMA7197','FMA7204','FMA7205','FMA7274','FMA7333','FMA7370','FMA15900','FMA13889'];
const io=new NodeIO(),doc=await io.read('public/models/organ.glb'),organProbes=[];
for(const id of organIds){
  const node=doc.getRoot().listNodes().find(node=>node.getName()===id);
  assert.ok(node?.getMesh(),`missing selected organ ${id}`);
  const matrix=new Matrix4().fromArray(node.getWorldMatrix());
  const primitive=node.getMesh().listPrimitives()[0],positions=primitive.getAttribute('POSITION').getArray();
  const vertexCount=positions.length/3;
  const used=primitive.getIndices()?[...new Set(primitive.getIndices().getArray())].sort((a,b)=>a-b):Array.from({length:vertexCount},(_,i)=>i);
  const counts={inside:0,outside:0,'surface-band':0,ambiguous:0};
  let maxOutsideMm=0,worstOutside=null;
  for(const vertex of used){
    const point=new Vector3(positions[vertex*3],positions[vertex*3+1],positions[vertex*3+2]).applyMatrix4(matrix);
    const result=probe.classify(point);
    counts[result.kind]++;
    if(result.kind==='outside'&&result.distance*1000>maxOutsideMm){
      maxOutsideMm=result.distance*1000;
      worstOutside={vertex,distanceMm:maxOutsideMm,point:point.toArray()};
    }
  }
  organProbes.push({id,name:manifest.assets.find(part=>part.id===id)?.name??id,
    vertices:vertexCount,referencedVertices:used.length,counts,maxOutsideMm,worstOutside});
}
probe.dispose();geometry.dispose();
const report={status:'LARGEST ORIGINAL SKIN COMPONENT SCREEN ONLY; NO BODY ENVELOPE APPROVED',
  sourceSha256:skin.sha256,sourceTriangles:triangleCount,componentCount:ranked.length,
  largestComponentTriangles:ranked[0].triangles,largestComponentVertices:remap.size,bounds,
  toleranceMm:2,componentProbeCounts:tally(componentProbes),componentProbes,
  organIds,organProbes,
  limitations:[
    'One triangle centroid per smaller skin component is a screen, not exhaustive classification of that component.',
    'Every triangle-referenced vertex of nine selected deployed organs is checked, but not triangle interiors or all male anatomy.',
    'Three oblique ray parities can agree even when a source surface self-intersects or represents a hollow wall.',
    'The largest source component is not proven to be the outer body surface; topology at vertices, orientation, volume and clinical landmarks remain unchecked.',
    'Deployed organ positions are compared to the original male skin coordinate transform, but containment cannot establish correct anatomy.',
  ],files:['public/models/manifest.json','public/models/organ.glb','scripts/audit-male-source-skin-envelope.mjs',
    'scripts/lib/surface-containment.mjs','package-lock.json'].map(path=>({path,sha256:hash(path)}))};
fs.writeFileSync('docs/anatomy-alignment/male-skin-source-envelope.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({componentProbeCounts:report.componentProbeCounts,
  organProbes:organProbes.map(({id,name,counts,maxOutsideMm})=>({id,name,counts,maxOutsideMm}))},null,2));
