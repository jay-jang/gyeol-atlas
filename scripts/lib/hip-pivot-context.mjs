import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {lowerBodyPoseContext} from './lower-body-pose-context.mjs';

// Shared decoding for new pivot interpolation diagnostics. Historical reports
// keep their frozen loaders. No runtime writes or additional fitted frames.
export function hipPivotContext(finalRoot){
  const ctx=lowerBodyPoseContext(finalRoot),{read,sha,finish}=ctx,json=p=>JSON.parse(read(p)),hip=json('docs/anatomy-alignment/hip-pivot-legs.json'),lumbar=json('docs/anatomy-alignment/lumbar-source-frames.json'),root=new Matrix4().fromArray(hip.root),bytes=read(lumbar.partsFile);
  assert.equal(sha(bytes),lumbar.files.find(f=>f.file===lumbar.partsFile).sha256);const packed=JSON.parse(gunzipSync(bytes));
  const geometry=p=>{const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(p.positions),3));g.setIndex(new BufferAttribute(new Uint32Array(p.indices),1));return g;};
  const bones=ctx.bones.map(b=>({name:`${b.side}-${b.name}`,kind:'same-frame-denver',side:b.side,targetIds:b.targetIds,raw:b.raw,source:finish(b.raw.clone().applyMatrix4(root)),target:b.target,frame:b.name==='Pelvis'?'root':b.side,anchor:['Pelvis','Femur','Tibia','Fibula'].includes(b.name)}));
  for(const p of lumbar.parts){const raw=finish(geometry(packed.find(q=>q.id===p.name)).applyMatrix4(new Matrix4().fromArray(lumbar.denverMatrices.final)));bones.push({name:p.name,kind:'approximate-bonehub-to-denver',targetIds:[p.id],raw,source:finish(raw.clone().applyMatrix4(root)),target:finish(geometry(packed.find(q=>q.id===p.id))),frame:'root',anchor:p.training});}
  assert.equal(bones.length,16);assert.equal(bones.filter(b=>b.anchor).length,12);
  const frames=['root','left','right'].map(name=>{const matrix=name==='root'?new Matrix4():new Matrix4().fromArray(hip.candidates.find(c=>c.side===name&&c.pivotName==='FemurHead').matrix),members=bones.filter(b=>b.anchor&&b.frame===name),g=finish(mergeGeometries(members.map(b=>b.source)));return {name,matrix,members:members.map(b=>b.name),geometry:g,nearest:point=>g.boundsTree.closestPointToPoint(point)};});
  read('scripts/lib/hip-pivot-context.mjs');
  return {...ctx,hip,lumbar,root,pivotBones:bones,frames};
}
