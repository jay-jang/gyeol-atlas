// Independently recheck selected BVH nearest distances by scanning triangles.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {KHRDracoMeshCompression} from '@gltf-transform/extensions';
import draco from 'draco3dgltf';
import {BufferAttribute,BufferGeometry,Matrix4,Triangle,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';

const report=JSON.parse(fs.readFileSync('docs/anatomy-alignment/male-vessel-surfaces.json'));
for(const [path,sha] of Object.entries(report.files))
  assert.equal(createHash('sha256').update(fs.readFileSync(path)).digest('hex'),sha,path);
const io=new NodeIO().registerExtensions([KHRDracoMeshCompression])
  .registerDependencies({'draco3d.decoder':await draco.createDecoderModule()});
const source=await io.read('public/models/vessel-full.glb'),target=await io.read('public/models/vessel.glb');
const sourceNodes=new Map(source.getRoot().listNodes().map(n=>[n.getName(),n]));
const targetNodes=new Map(target.getRoot().listNodes().map(n=>[n.getName(),n]));
function geometry(node,registered) {
  const p=node.getMesh().listPrimitives()[0],g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(new Float32Array(p.getAttribute('POSITION').getArray()),3));
  assert.ok(p.getIndices(),`the current surface readback requires indexed triangles: ${node.getName()}`);
  g.setIndex(new BufferAttribute(new Uint32Array(p.getIndices().getArray()),1));
  g.applyMatrix4(new Matrix4().fromArray(node.getWorldMatrix()));
  if(registered){g.scale(report.registration.scale,report.registration.scale,report.registration.scale);g.translate(...report.registration.translation);}
  g.boundsTree=new MeshBVH(g);return g;
}
function brute(query,g) {
  const position=g.getAttribute('position'),index=g.getIndex(),triangle=new Triangle(),near=new Vector3();
  let best=Infinity;
  for(let i=0;i<index.count;i+=3){
    triangle.a.fromBufferAttribute(position,index.getX(i));
    triangle.b.fromBufferAttribute(position,index.getX(i+1));
    triangle.c.fromBufferAttribute(position,index.getX(i+2));
    triangle.closestPointToPoint(query,near);
    best=Math.min(best,1000*query.distanceTo(near));
  }return best;
}
const checks=[];
for(const name of ['aortic arch','internal jugular vein left','superior mesenteric artery','internal iliac artery left']) {
  const row=report.rows.find(r=>r.name===name),a=geometry(sourceNodes.get(row.sourceNode),true),b=geometry(targetNodes.get(row.targetNode),false);
  for(const [label,from,to] of [['sourceToTarget',a,b],['targetToSource',b,a]]){
    const pos=from.getAttribute('position'),index=from.getIndex(),ref=[...new Set(index.array)];
    const positions=[...new Set(Array.from({length:Math.min(9,ref.length)},(_,j)=>ref[Math.floor(j*(ref.length-1)/Math.max(1,Math.min(9,ref.length)-1))]))];
    for(const vertex of positions){
      const query=new Vector3().fromBufferAttribute(pos,vertex);
      const bvh=1000*to.boundsTree.closestPointToPoint(query).distance;
      const triangle=brute(query,to);
      assert.ok(Math.abs(bvh-triangle)<.000001,`${name} ${label} vertex ${vertex}: ${bvh} != ${triangle}`);
      checks.push({name,direction:label,vertex,bvhMm:bvh,bruteMm:triangle});
    }
  }a.dispose();b.dispose();
}
const result={status:'sampled independent triangle nearest-distance arithmetic; not clinical alignment',
  sourceReportSha256:createHash('sha256').update(fs.readFileSync('docs/anatomy-alignment/male-vessel-surfaces.json')).digest('hex'),
  verifierSha256:createHash('sha256').update(fs.readFileSync('scripts/verify-male-vessel-surfaces.mjs')).digest('hex'),
  checks:checks.length,maximumResidualMm:Math.max(...checks.map(c=>Math.abs(c.bvhMm-c.bruteMm))),samples:checks};
fs.writeFileSync('docs/anatomy-alignment/male-vessel-surfaces-readback.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({checks:result.checks,maximumResidualMm:result.maximumResidualMm}));
