// Symmetric near-surface adjacency proxy at trapezium / first metacarpal.
// It is a fixed experimental pivot, not an anatomically validated CMC axis.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {applyBaselinePositions} from './lib/registration-baseline.mjs';
import {referencedVertices} from './lib/surface-containment.mjs';
const atlasPath='public/models/female/atlas-female.json',atlas=JSON.parse(fs.readFileSync(atlasPath)),buffers=new Map();
const baselinePath='docs/anatomy-alignment/female-arm-registration-v1.json',baseline=JSON.parse(fs.readFileSync(baselinePath));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function geometry(part){
  const path=`public/models/female/${atlas.chunks[part.chunk].gzip.split('/').pop()}`;
  if(!buffers.has(path))buffers.set(path,gunzipSync(fs.readFileSync(path)));
  const bytes=buffers.get(path),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>bytes.readFloatLE(part.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>bytes.readUInt32LE(part.indices+4*i)),1));
  applyBaselinePositions(g,part,baseline);g.boundsTree=new MeshBVH(g);return g;
}
const report={status:'EXPERIMENTAL adjacency proxy; real CMC motion has coupled rotation/translation, not a ball pivot',
  method:'Both directional referenced-vertex to triangle closest points, minimum + 1 mm patch; mean of directional midpoint means.',hands:[]};
for(const side of ['left','right']){
  const parts=['trapezium','first metacarpal bone'].map(name=>atlas.parts.find(p=>p.name.toLowerCase()===`${side} ${name}`));
  assert.ok(parts.every(Boolean));const meshes=parts.map(geometry),patches=[];
  for(const [a,b] of [[0,1],[1,0]]){
    const pos=meshes[a].getAttribute('position');
    const rows=referencedVertices(meshes[a],Infinity).map(i=>{
      const point=new Vector3().fromBufferAttribute(pos,i),hit=meshes[b].boundsTree.closestPointToPoint(point);
      return {index:i,distance:hit.distance,midpoint:point.add(hit.point).multiplyScalar(.5)};
    });
    const minimum=Math.min(...rows.map(r=>r.distance)),patch=rows.filter(r=>r.distance<=minimum+.001);
    assert.ok(patch.length>=3);
    const centre=patch.reduce((v,r)=>v.add(r.midpoint),new Vector3()).multiplyScalar(1/patch.length);
    patches.push({from:parts[a].id,to:parts[b].id,minimumMm:minimum*1000,thresholdMm:(minimum+.001)*1000,
      vertices:patch.map(r=>r.index),centre:centre.toArray()});
  }
  report.hands.push({side,parts:parts.map(p=>p.id),pivot:patches[0].centre.map((v,i)=>(v+patches[1].centre[i])/2),patches});
  meshes.forEach(g=>g.dispose());
}
report.files=[atlasPath,baselinePath,'scripts/lib/registration-baseline.mjs','scripts/experiment-thumb-pivot.mjs','scripts/lib/surface-containment.mjs',...buffers.keys()].map(path=>({path,sha256:sha(path)}));
fs.writeFileSync('.cache/arm-registration/thumb-pivots.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.hands));
