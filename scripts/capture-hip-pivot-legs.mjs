import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {Matrix4} from 'three';
import {lowerBodyPoseContext} from './lib/lower-body-pose-context.mjs';
const ctx=lowerBodyPoseContext(process.argv[2]),{read,sha}=ctx,out='.cache/hip-cartilage-pivots',bytes=read(`${out}/legs.json`),r=JSON.parse(bytes),audit=JSON.parse(read(`${out}/readback.json`));assert.equal(audit.legReportSha256,sha(bytes));
const decode=g=>({positions:Array.from(g.attributes.position.array),indices:Array.from(g.index.array)}),parts=ctx.bones.map(b=>({id:`source-${b.side}-${b.name}`,source:true,side:b.side,name:b.name,data:decode(b.raw.clone().applyMatrix4(new Matrix4().fromArray(r.root)))}));
for(const id of [...new Set(ctx.bones.flatMap(b=>b.targetIds))])parts.push({id,data:decode(ctx.runtimeMap.get(id).g)});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']}),errors=[],captures=[];
try{
  const page=await browser.newPage({viewport:{width:1100,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__hip-pivots',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#14212b;color:white;font:16px sans-serif"><div id="label" style="position:absolute;top:14px;left:18px;max-width:1040px"></div></body></html>'}));await page.goto('http://127.0.0.1:5174/__hip-pivots');
  await page.evaluate(async ({parts,r})=>{
    const T=await import('/node_modules/.vite/deps/three.js'),renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1100,1000);renderer.setClearColor('#14212b');document.body.append(renderer.domElement);const focus=new T.Box3();
    for(const p of parts){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(p.data.positions),3));g.computeBoundingBox();focus.union(g.boundingBox);
      if(p.source&&p.name!=='Pelvis')for(const c of r.candidates.filter(c=>c.side===p.side)){const other=g.clone().applyMatrix4(new T.Matrix4().fromArray(c.matrix));other.computeBoundingBox();focus.union(other.boundingBox);other.dispose();}g.dispose();}
    window.hipPivot={T,renderer,parts,r,focus};
  },{parts,r});
  for(const view of ['front','oblique'])for(const state of ['root','FemurHead','PelvisAcetabulum']){
    const data=await page.evaluate(({view,state})=>{
      const {T,renderer,parts,r,focus}=window.hipPivot,scene=new T.Scene(),ids=[];scene.add(new T.AmbientLight(0xffffff,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(1,2,3);scene.add(light);
      for(const p of parts){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(p.data.positions),3));g.setIndex(new T.BufferAttribute(new Uint32Array(p.data.indices),1));if(p.source&&p.name!=='Pelvis'&&state!=='root')g.applyMatrix4(new T.Matrix4().fromArray(r.candidates.find(c=>c.side===p.side&&c.pivotName===state).matrix));g.computeVertexNormals();scene.add(new T.Mesh(g,new T.MeshStandardMaterial({color:p.source?'#4bafff':'#efce93',side:T.DoubleSide,transparent:!!p.source,opacity:p.source?.58:1,depthWrite:!p.source})));ids.push(p.id);}
      for(const side of ['left','right']){const c=r.candidates.find(c=>c.side===side&&c.pivotName===(state==='root'?'FemurHead':state)),m=new T.Mesh(new T.SphereGeometry(.0035,16,10),new T.MeshBasicMaterial({color:'#ff6077',depthTest:false}));m.position.fromArray(c.pivot);m.renderOrder=10;scene.add(m);}
      const target=focus.getCenter(new T.Vector3()),size=focus.getSize(new T.Vector3()),extent=Math.max(size.y,size.x/1.1)+.13,camera=new T.OrthographicCamera(-extent*1.1/2,extent*1.1/2,extent/2,-extent/2,.001,5),direction=new T.Vector3(view==='front'?0:.65,.03,1).normalize();camera.position.copy(target).addScaledVector(direction,2);camera.lookAt(target);renderer.render(scene,camera);document.getElementById('label').textContent=`${state} / ${view} | blue: source bones; tan: fixed HRA; pink: estimated pivot (shown through surfaces) | diagnostic only`;
      const result={ids,target:target.toArray(),cameraPosition:camera.position.toArray(),extent};scene.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});return result;
    },{view,state});const file=`hip-pivot-${view}-${state}.png`;await page.screenshot({path:`${out}/${file}`});captures.push({view,state,file,sha256:sha(read(`${out}/${file}`)),...data});
  }
  assert.deepEqual(errors,[]);for(const view of ['front','oblique']){const rows=captures.filter(c=>c.view===view);for(const row of rows){assert.deepEqual(row.ids,rows[0].ids);assert.deepEqual(row.target,rows[0].target);assert.deepEqual(row.cameraPosition,rows[0].cameraPosition);assert.equal(row.extent,rows[0].extent);}}
  fs.writeFileSync(`${out}/captures.json`,JSON.stringify({createdAt:new Date().toISOString(),reportSha256:sha(bytes),auditSha256:sha(read(`${out}/readback.json`)),scriptSha256:sha(read('scripts/capture-hip-pivot-legs.mjs')),errors,captures,limits:'Paired bone-only diagnostics, same focus/camera across three states. Source pelvis stays at the lumbar root. Pink markers are numerical sphere estimates rendered without depth testing. Skin, muscles, spine, organs, vessels, nerves, lymph and feet are omitted. Transparency can conceal depth ordering. Not an app/mobile, peel or clinical validation.'},null,2)+'\n');console.log('Six hip-pivot diagnostic views saved.');
}finally{await browser.close();}
