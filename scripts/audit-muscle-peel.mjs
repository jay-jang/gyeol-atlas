import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {KHRDracoMeshCompression} from '@gltf-transform/extensions';
import draco from 'draco3dgltf';
import {Box3,Vector3,Matrix4} from 'three';
import {musclePeelRanks} from '../src/muscle-peel.ts';
import {musclePeelGroups,musclePeelRelations} from '../src/muscle-peel-relations.ts';
const read=path=>JSON.parse(fs.readFileSync(path));
const io=new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({'draco3d.decoder':await draco.createDecoderModule()});
const male=await io.read('public/models/muscle.glb'),rows=[];
for(const node of male.getRoot().listNodes()){
  if(!node.getMesh())continue;
  const box=new Box3(),matrix=new Matrix4().fromArray(node.getWorldMatrix());
  for(const p of node.getMesh().listPrimitives()){
    const points=p.getAttribute('POSITION').getArray();
    for(let i=0;i<points.length;i+=3)box.expandByPoint(new Vector3().fromArray(points,i).applyMatrix4(matrix));
  }
  const center=box.getCenter(new Vector3()),extent=box.getSize(new Vector3());
  const ax=center.y<.83?.095:Math.abs(center.x)>.2&&center.y<1.5?.29:0;
  rows.push({id:node.getName(),score:Math.hypot(Math.abs(center.x)-ax,center.z)+Math.max(extent.x,extent.z)*.24});
}
assert.equal(rows.length,437);
const atlas=read('public/models/female/atlas-female.json'),cache=new Map();
const female=atlas.parts.filter(p=>['muscular','donor-muscle'].includes(p.system)).map(p=>{
  if(!cache.has(p.chunk))cache.set(p.chunk,gunzipSync(fs.readFileSync(`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').pop()}`)));
  const bytes=cache.get(p.chunk),box=new Box3();
  for(let i=0;i<p.vertexCount;i++)box.expandByPoint(new Vector3(...[0,1,2].map(j=>bytes.readFloatLE(p.positions+(i*3+j)*4))));
  const c=box.getCenter(new Vector3());return {id:p.id,score:Math.hypot(c.x,c.z)};
});
assert.equal(female.length,92);
const result={method:'Actual source geometry scores; before=6ab02cb renderer schedule; after=source-backed display precedence. Not a complete anatomical depth validation.',sexes:[]};
for(const [sex,input] of [['male',rows],['female',female]]){
  const sorted=[...input].sort((a,b)=>b.score-a.score||(sex==='male'?a.id.localeCompare(b.id):0));
  const before=new Map(sorted.map((p,i)=>[p.id,(sex==='male'?20:24)+i/Math.max(1,sorted.length-1)*(sex==='male'?46:36)]));
  const ranks=musclePeelRanks(input),after=new Map([...ranks].map(([id,rank])=>[id,24+rank*36]));
  const relations=musclePeelRelations.filter(([outer,inner])=>before.has(outer)&&before.has(inner)).map(([outer,inner])=>({outer,inner,
    before:[before.get(outer),before.get(inner)],after:[after.get(outer),after.get(inner)],
    beforeReversed:before.get(outer)>before.get(inner),beforeOverlapping:before.get(outer)+4>before.get(inner),
    afterSeparated:after.get(outer)+4<=after.get(inner)+1e-10}));
  assert.ok(relations.every(r=>r.afterSeparated));
  const summary={sex,meshes:input.length,verifiedRelationMeshes:new Set(musclePeelGroups.filter(g=>g.sex===sex).flatMap(g=>g.levels.flat())).size,
    relations:relations.length,beforeReversed:relations.filter(r=>r.beforeReversed).length,beforeOverlapping:relations.filter(r=>r.beforeOverlapping).length,afterViolations:relations.filter(r=>!r.afterSeparated).length};
  result.sexes.push({...summary,relationDetails:relations,starts:Object.fromEntries(after)});console.log(JSON.stringify(summary));
}
result.files=['public/models/muscle.glb','public/models/female/atlas-female.json',...atlas.chunks.filter((_,i)=>cache.has(i)).map(c=>`public/models/female/${c.gzip.split('/').pop()}`),'scripts/audit-muscle-peel.mjs','src/muscle-peel.ts','src/muscle-peel-relations.ts','src/dissection.ts','src/Atlas.tsx','src/PackedAtlas.tsx'].map(path=>({path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex')}));
fs.writeFileSync('docs/anatomy-alignment/muscle-peel-audit.json',JSON.stringify(result,null,2)+'\n');
