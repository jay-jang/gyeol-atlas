// Scope is the single new source-muscle pair, not all HRA relationships.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Matrix4,Vector3,BufferGeometry,BufferAttribute} from 'three';
import {hipPivotContext} from './lib/hip-pivot-context.mjs';
import {boneInterpolatingField} from './lib/bone-interpolating-field.mjs';
import {subdivideSourceTriangles} from './lib/subdivide-source.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
import {closestSurfacePair} from './lib/closest-surface-pair.mjs';
const ctx=hipPivotContext(process.argv[2]),{read,sha,finish,root,frames}=ctx,out='.cache/hip-interpolating-muscles',bytes=read(`${out}/report.json`),r=JSON.parse(bytes),candidate=r.candidates[0],pairs=candidate.relations.filter(p=>p.after&&p.sourceInternal===false);assert.equal(pairs.length,1);const pair=pairs[0],field=boneInterpolatingField(frames),identity=new Matrix4(),v=new Vector3();
let inputs=pair.ids.map(id=>{const g=ctx.muscles.find(m=>m.id===id).raw.clone().applyMatrix4(root);return {id,positions:Float64Array.from(g.attributes.position.array),indices:Uint32Array.from(g.index.array)};});
const result={createdAt:new Date().toISOString(),reportSha256:sha(bytes),pair:{ids:pair.ids,names:pair.names},levels:[],limits:[
  'Two source muscles only, subdivided in their flat source planes after the same composed-root Float32 stage and before the nonlinear interpolation. Every child vertex is mapped afresh, then stored as Float32.',
  'Full-pair broad intersections and strict witnesses are queried at levels0,1,2 (1,4,16 children per original triangle). This is a finite refinement test, not an injectivity or continuous-surface proof.',
  'Centroid chord differences are finite sampled approximation errors, not bounds. No HRA target, other muscle, skin, organ or neurovascular structure is modified.'
]};
for(let level=0;level<=2;level++){
  const sources=[],mapped=[],parts=[];
  for(const input of inputs){
    const sg=new BufferGeometry();sg.setAttribute('position',new BufferAttribute(input.positions,3));sg.setIndex(new BufferAttribute(input.indices,1));sources.push(finish(sg));
    const positions=new Float32Array(input.positions.length);for(let i=0;i<positions.length;i+=3)positions.set(field(v.fromArray(input.positions,i)).point.toArray(),i);
    const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(positions,3));g.setIndex(new BufferAttribute(input.indices,1));mapped.push(finish(g));
    if(level===0){const expected=candidate.muscles.find(m=>m.id===input.id);assert.equal(sha(Buffer.from(positions.buffer)),expected.positionsSha256);assert.equal(sha(Buffer.from(input.indices.buffer)),expected.indicesSha256);}
    let maximumCentroidChordErrorMm=0;const sourcePoint=new Vector3(),linearPoint=new Vector3();
    for(let i=0;i<input.indices.length;i+=3){sourcePoint.set(0,0,0);linearPoint.set(0,0,0);for(let k=0;k<3;k++){const index=input.indices[i+k];sourcePoint.add(v.fromArray(input.positions,index*3));linearPoint.add(v.fromArray(positions,index*3));}sourcePoint.multiplyScalar(1/3);linearPoint.multiplyScalar(1/3);maximumCentroidChordErrorMm=Math.max(maximumCentroidChordErrorMm,1000*field(sourcePoint).point.distanceTo(linearPoint));}
    parts.push({id:input.id,vertices:positions.length/3,triangles:input.indices.length/3,positionsSha256:sha(Buffer.from(positions.buffer)),indicesSha256:sha(Buffer.from(input.indices.buffer)),maximumCentroidChordErrorMm});
  }
  const row={level,parts};for(const [state,meshes] of [['source',sources],['mapped',mapped]]){const [a,b]=meshes,crossing=a.boundingBox.intersectsBox(b.boundingBox)&&a.boundsTree.intersectsGeometry(b,identity);row[state]={crossing,witness:crossing?meshCrossingWitness(a,b):null,...closestSurfacePair(a,b)};}
  result.levels.push(row);console.log(JSON.stringify({level,parts,sourceCrossing:row.source.crossing,mappedCrossing:row.mapped.crossing,sourceDistanceMm:row.source.minimumDistanceMm,mappedDistanceMm:row.mapped.minimumDistanceMm,witness:row.mapped.witness}));
  for(const g of [...sources,...mapped])g.dispose();if(level<2)inputs=inputs.map(p=>({id:p.id,...subdivideSourceTriangles(p)}));
}
for(const file of ['scripts/probe-hip-interpolation-triangulation.mjs','scripts/lib/bone-interpolating-field.mjs','scripts/lib/subdivide-source.mjs','scripts/lib/triangle-witness.mjs','scripts/lib/closest-surface-pair.mjs'])read(file);result.files=[...ctx.files].map(([file,sha256])=>({file,sha256}));fs.writeFileSync(`${out}/triangulation.json`,JSON.stringify(result,null,2)+'\n');
