// Numerical interface witnesses, not expert-defined anatomical landmarks.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {referencedVertices} from './lib/surface-containment.mjs';
const out='.cache/brain-pose';fs.mkdirSync(out,{recursive:true});
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f));
const frame=read('.cache/bonehub-head/frame.json');for(const f of frame.files)assert.equal(hash(f.file),f.sha256,f.file);
const rows=JSON.parse(gunzipSync(fs.readFileSync(frame.parts))),byId=new Map(rows.map(p=>[p.id,p]));
const provenance=read('data/catalog/female-brain-provenance.json'),movingIds=provenance.parts.filter(p=>p.origin==='allen-reference').map(p=>p.id);assert.equal(movingIds.length,282);
assert.ok(movingIds.every(id=>byId.has(id)));assert.ok(!movingIds.includes('HRAF0070'));
const geometry=p=>new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(p.positions),3)).setIndex(p.indices);
const pairs=[['HRAF0123','HRAF0070'],['HRAF0256','HRAF0070'],...['HRAF0185','HRAF0186','HRAF0320','HRAF0321'].map(id=>[id,'HRAF0353'])];
const interfaces=[];
for(const [movingId,fixedId] of pairs){
  const a=byId.get(movingId),b=byId.get(fixedId);assert.ok(movingIds.includes(movingId)&&!movingIds.includes(fixedId));
  const source=geometry(a),target=geometry(b),tree=new MeshBVH(target),points=[];
  for(const vertex of referencedVertices(source,Infinity)){const point=new Vector3().fromBufferAttribute(source.attributes.position,vertex),q=tree.closestPointToPoint(point);
    points.push({vertex,point:point.toArray(),targetPoint:q.point.toArray(),distanceMm:q.distance*1000});}
  const minimumDistanceMm=Math.min(...points.map(p=>p.distanceMm)),anchors=points.filter(p=>p.distanceMm<=minimumDistanceMm+1);
  assert.ok(anchors.length>0);interfaces.push({movingId,movingName:a.name,sourceGeometryId:a.sourceGeometryId,fixedId,fixedName:b.name,minimumDistanceMm,totalSourceVertices:points.length,anchors});
  source.dispose();target.dispose();
}
const all=interfaces.flatMap(p=>p.anchors),pivot=[0,1,2].map(k=>all.reduce((n,p)=>n+p.point[k],0)/all.length);
const report={status:'Numerical interface witnesses only; no clinical landmarks or runtime movement',parts:frame.parts,movingIds,pivot,interfaces,
  anchorRule:'All referenced vertices within 1mm of the minimum vertex-to-target-triangle distance for each of six source/target pairs',
  limitations:['A nearest surface witness does not establish correct anatomical continuity, tissue correspondence, axon course or a sealed interface.',
    'All 282 Allen reference parts move together; the Visible Human optic chiasm, optic nerves, cervical cord, eyes and all other anatomy stay fixed.',
    'Paired points are numerical and fixed at baseline; neither the 1mm witness band nor subsequent movement budgets are clinically calibrated.'],
  files:['.cache/bonehub-head/frame.json',frame.parts,'data/catalog/female-brain-provenance.json','scripts/prepare-brain-pose-anchors.mjs','scripts/lib/surface-containment.mjs'].map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync(`${out}/anchors.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pivot,interfaces:interfaces.map(p=>({moving:p.movingId,fixed:p.fixedId,minimumMm:p.minimumDistanceMm,anchors:p.anchors.length})),anchors:all.length}));
