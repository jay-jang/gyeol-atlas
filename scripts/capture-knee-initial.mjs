// Private full thigh/shank diagnostics; source-same-side versus fixed overview.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
const out='.cache/knee-initial',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report=read(`${out}/report.json`),audit=read(`${out}/audit.json`);assert.equal(audit.reportSha256,sha(`${out}/report.json`));
const atlas=read('public/models/female/atlas-female.json'),membership=read('docs/anatomy-alignment/hra-bone-targets.json'),source=read('docs/anatomy-alignment/donor-source-comparison.json'),packing=read('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative;
assert.equal(sha('.cache/donor-fidelity/source-full.bin.gz'),packing.sha256);
const raw=gunzipSync(fs.readFileSync('.cache/donor-fidelity/source-full.bin.gz')),chunks=atlas.chunks.map(c=>gunzipSync(fs.readFileSync(`public/models/female/${c.gzip.split('/').pop()}`)));
const decode=(bytes,p)=>({positions:Array.from({length:p.vertexCount*3},(_,i)=>bytes.readFloatLE(p.positions+4*i)),indices:Array.from({length:p.indexCount},(_,i)=>bytes.readUInt32LE(p.indices+4*i))});
const parts=[];
for(const side of ['left','right']){
  const boneIds=new Set(membership.targets.filter(t=>t.side===side).flatMap(t=>t.members.map(m=>m.id)));
  const fixedIds=[...boneIds,...source.muscles.filter(m=>m.fitGroup===`${side}-hip`).map(m=>m.id)];assert.equal(fixedIds.length,32);
  for(const id of fixedIds){const p=atlas.parts.find(p=>p.id===id);parts.push({id,name:p.name,side,fixed:decode(chunks[p.chunk],p),bone:boneIds.has(id)});}
  for(const m of report.evaluations[0].muscles.filter(m=>m.side===side)){const p=packing.parts.find(p=>p.id===m.id);parts.push({id:m.id,name:m.name,side,source:decode(raw,p)});}
}
const skin=atlas.parts.find(p=>p.id==='HRAF0003');parts.push({id:skin.id,name:skin.name,fixed:decode(chunks[skin.chunk],skin),skin:true});assert.equal(parts.length,115);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']}),captures=[],errors=[];
try{
  const page=await browser.newPage({viewport:{width:1100,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__knee-initial-diagnostic',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"></body></html>'}));
  await page.goto('http://127.0.0.1:5174/__knee-initial-diagnostic');
  await page.evaluate(async({parts,evaluations})=>{const T=await import('/node_modules/.vite/deps/three.js'),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1100,1000);renderer.setClearColor('#14212b');document.body.append(renderer.domElement);window.kneeInitial={T,renderer,parts,evaluations};},{parts,evaluations:report.evaluations.map(e=>({mode:e.mode,muscles:e.muscles.map(m=>({id:m.id,matrix:m.matrix}))}))});
  for(const side of ['left','right'])for(const evaluation of report.evaluations){
    const mode=evaluation.mode,data=await page.evaluate(({side,mode})=>{
      const {T,renderer,parts,evaluations}=window.kneeInitial,matrices=new Map(evaluations.find(e=>e.mode===mode).muscles.map(m=>[m.id,m.matrix])),scene=new T.Scene(),ids=[],focus=new T.Box3();
      scene.add(new T.AmbientLight(0xffffff,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(1,2,-3);scene.add(light);
      for(const p of parts){
        if(!p.skin&&p.side!==side)continue;const d=p.fixed||p.source,g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(d.positions),3));g.setIndex(new T.BufferAttribute(new Uint32Array(d.indices),1));
        if(p.source)g.applyMatrix4(new T.Matrix4().fromArray(matrices.get(p.id)));g.computeVertexNormals();g.computeBoundingBox();if(p.bone)focus.union(g.boundingBox);
        const color=p.skin?'#e6c2a6':p.bone?'#efd5a6':p.fixed?'#766e91':/Gastrocnemius medial/.test(p.name)?'#51bdf5':/Gastrocnemius lateral/.test(p.name)?'#67e998':/Soleus/.test(p.name)?'#ef985d':/Biceps femoris/.test(p.name)?'#ddcb6c':'#a26674';
        scene.add(new T.Mesh(g,new T.MeshStandardMaterial({color,side:T.DoubleSide,transparent:!!p.skin,opacity:p.skin?.12:1,depthWrite:!p.skin})));ids.push(p.id);
      }
      const target=focus.getCenter(new T.Vector3()),extent=focus.getSize(new T.Vector3()).y+.16,aspect=1.1,camera=new T.OrthographicCamera(-extent*aspect/2,extent*aspect/2,extent/2,-extent/2,.001,5);
      const direction=new T.Vector3(side==='left'?.25:-.25,.03,-1).normalize();camera.position.copy(target).addScaledVector(direction,1.5);camera.lookAt(target);camera.updateProjectionMatrix();renderer.render(scene,camera);
      const result={ids,target:target.toArray(),cameraPosition:camera.position.toArray(),extent,png:renderer.domElement.toDataURL('image/png').split(',')[1]};scene.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});return result;
    },{side,mode});
    const file=`knee-initial-${side}-${mode}.png`;fs.writeFileSync(`${out}/${file}`,Buffer.from(data.png,'base64'));delete data.png;captures.push({side,mode,file,sha256:sha(`${out}/${file}`),...data});
  }
  assert.deepEqual(errors,[]);for(const side of ['left','right']){const rows=captures.filter(c=>c.side===side);for(const r of rows){assert.equal(r.ids.length,58);assert.deepEqual(r.ids,rows[0].ids);assert.deepEqual(r.cameraPosition,rows[0].cameraPosition);assert.deepEqual(r.target,rows[0].target);assert.equal(r.extent,rows[0].extent);}}
  fs.writeFileSync(`${out}/captures.json`,JSON.stringify({createdAt:new Date().toISOString(),reportSha256:sha(`${out}/report.json`),auditSha256:sha(`${out}/audit.json`),scriptSha256:sha('scripts/capture-knee-initial.mjs'),limits:'Private posterior-oblique thigh/shank views: 25 original candidate muscles, 13 fixed hip muscles, 19 fixed HRA hierarchy pieces and skin per side. Source bones, pelvis, foot bones, vessels and nerves are not displayed. Not public UI, full-body or clinical verification.',errors,captures},null,2)+'\n');console.log('Ten fixed-camera diagnostics saved.');
}finally{await browser.close();}
