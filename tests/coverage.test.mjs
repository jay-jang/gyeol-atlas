import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const assets=read('scripts/model-inputs.json').assets;

test('all source muscle and neural leaves and named point landmarks have meshes',()=>{
  const audit=read('docs/anatomy-expansion/catalog-audit.json');
  for(const [layer,ids] of Object.entries(audit.requiredSourceIds))
    for(const id of ids) assert.ok(assets.some(a=>a.id===id&&a.layer===layer),`${layer}: ${id}`);
  const points=read('data/points.json');
  for(const [point,ids] of Object.entries({GB20:['FMA13408','FMA13409'],KI3:['FMA258847'],HT7:['FMA38617','FMA38619']}))
    for(const id of ids)assert.ok(points.find(p=>p.id===point).structures.includes(id));
});

test('supplement has official version membership and non-empty geometry in the common body coordinates',async()=>{
  const membership=fs.readFileSync('data/catalog/v43-FMA2Obj.txt','utf8');
  assert.match(membership,/# Data Version\s+4\.3/);
  const ids=new Set(membership.match(/FJ\d+/g));
  const model=await new NodeIO().read('public/models/nerve.glb');
  const meshes=new Map(model.getRoot().listMeshes().map(m=>[m.getName(),m]));
  for(const a of assets.filter(a=>a.sourceVersion==='4.3')){
    assert.ok(ids.has(a.id));assert.match(a.fmaId,/^FMA\d+$/);
    if(a.layer!=='nerve')continue;
    const mesh=meshes.get(a.id);assert.ok(mesh,a.name);
    const p=mesh.listPrimitives()[0].getAttribute('POSITION').getArray();
    assert.ok(p.length>0);
    for(let i=0;i<p.length;i+=3){assert.ok(Math.abs(p[i])<.65);assert.ok(p[i+1]>0&&p[i+1]<1.9);assert.ok(Math.abs(p[i+2])<.4);}
  }
  const cord=assets.find(a=>a.name==='Neural tissue of spinal cord');assert.ok(cord);
  const p=meshes.get(cord.id).listPrimitives()[0].getAttribute('POSITION').getArray();
  const ys=Array.from(p).filter((_,i)=>i%3===1);
  assert.ok(Math.max(...ys)-Math.min(...ys)>.4,'real cord spans over 40cm');
  for(const name of ['Left median nerve','Left radial nerve','Left ulnar nerve']) assert.ok(assets.some(a=>a.name===name),name);
});
