// Private common-frame diagnostics, not public application screenshots.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
const out='.cache/lower-body-bone-flow',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report=read(`${out}/report.json`),audit=read(`${out}/readback.json`);assert.equal(audit.reportSha256,sha(`${out}/report.json`));
const atlas=read('public/models/female/atlas-female.json'),packing=read('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative;
assert.equal(sha('.cache/donor-fidelity/source-full.bin.gz'),packing.sha256);assert.equal(sha(report.binary.path),report.binary.sha256);
const raw=gunzipSync(fs.readFileSync('.cache/donor-fidelity/source-full.bin.gz')),saved=gunzipSync(fs.readFileSync(report.binary.path));
const chunks=atlas.chunks.map(c=>gunzipSync(fs.readFileSync(`public/models/female/${c.gzip.split('/').pop()}`)));
const patches=['female-source-restoration','female-knee-source-restoration'].map(n=>{const spec=read(`data/catalog/${n}.json`);assert.equal(sha(`public/${spec.url}`),spec.sha256);return {spec,bytes:gunzipSync(fs.readFileSync(`public/${spec.url}`))};});
const positions=(b,p)=>Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i));
const decode=(b,p)=>({positions:positions(b,p),indices:Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i))});
function native(id){for(const {spec,bytes} of patches){const p=spec.records.find(r=>r.id===id);if(p)return decode(bytes,p);}const p=atlas.parts.find(r=>r.id===id);return decode(chunks[p.chunk],p);}
const parts=[];
for(const s of report.sides){
  const ids=s.bones.flatMap(b=>b.targetIds);assert.equal(ids.length,25);
  for(const id of ids)parts.push({id,side:s.side,name:atlas.parts.find(p=>p.id===id).name,bone:true,fixed:native(id)});
  for(const m of report.muscles.filter(m=>m.side===s.side)){const p=packing.parts.find(p=>p.id===m.id),q=report.binary.records.find(p=>p.id===m.id);parts.push({id:m.id,name:m.name,side:s.side,source:decode(raw,p),afterPositions:positions(saved,q),initialMatrix:s.initialMatrix});}
}
parts.push({id:'HRAF0003',skin:true,fixed:native('HRAF0003')});assert.equal(parts.length,127);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']}),captures=[],errors=[];
try{
  const page=await browser.newPage({viewport:{width:1100,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__lower-body-flow',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"></body></html>'}));await page.goto('http://127.0.0.1:5174/__lower-body-flow');
  await page.evaluate(async parts=>{const T=await import('/node_modules/.vite/deps/three.js'),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1100,1000);renderer.setClearColor('#14212b');document.body.append(renderer.domElement);window.lowerFlow={T,renderer,parts};},parts);
  for(const side of ['left','right'])for(const view of ['front','back'])for(const state of ['initial','candidate']){
    const data=await page.evaluate(({side,view,state})=>{
      const {T,renderer,parts}=window.lowerFlow,scene=new T.Scene(),focus=new T.Box3(),ids=[];
      scene.add(new T.AmbientLight(0xffffff,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(1,2,view==='front'?3:-3);scene.add(light);
      for(const p of parts){
        if(!p.skin&&p.side!==side)continue;const d=p.fixed||p.source,g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(p.source&&state==='candidate'?p.afterPositions:d.positions),3));g.setIndex(new T.BufferAttribute(new Uint32Array(d.indices),1));
        if(p.source&&state==='initial')g.applyMatrix4(new T.Matrix4().fromArray(p.initialMatrix));g.computeVertexNormals();g.computeBoundingBox();if(p.bone)focus.union(g.boundingBox);
        // Frame both source states, including proximal psoas. A bone-only
        // camera clips some held-out muscles and is not a full-scope view.
        if(p.source){const other=g.clone();other.setAttribute('position',new T.BufferAttribute(new Float32Array(state==='initial'?p.afterPositions:p.source.positions),3));if(state==='candidate')other.applyMatrix4(new T.Matrix4().fromArray(p.initialMatrix));other.computeBoundingBox();focus.union(g.boundingBox);focus.union(other.boundingBox);other.dispose();}
        const color=p.skin?'#e6c2a6':p.bone?'#efd5a6':/Gastrocnemius medial/.test(p.name)?'#51bdf5':/Gastrocnemius lateral/.test(p.name)?'#67e998':/Soleus/.test(p.name)?'#ef985d':/Biceps femoris/.test(p.name)?'#ddcb6c':/Iliacus|Piriformis|Gluteus/.test(p.name)?'#a087ba':'#a26674';
        scene.add(new T.Mesh(g,new T.MeshStandardMaterial({color,side:T.DoubleSide,transparent:!!p.skin,opacity:p.skin?.10:1,depthWrite:!p.skin})));ids.push(p.id);
      }
      const target=focus.getCenter(new T.Vector3()),extent=focus.getSize(new T.Vector3()).y+.12,camera=new T.OrthographicCamera(-extent*1.1/2,extent*1.1/2,extent/2,-extent/2,.001,5),direction=new T.Vector3(side==='left'?.25:-.25,.02,view==='front'?1:-1).normalize();camera.position.copy(target).addScaledVector(direction,1.5);camera.lookAt(target);camera.updateProjectionMatrix();renderer.render(scene,camera);
      const result={ids,target:target.toArray(),cameraPosition:camera.position.toArray(),extent,png:renderer.domElement.toDataURL('image/png').split(',')[1]};scene.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});return result;
    },{side,view,state});
    const file=`lower-bone-flow-${side}-${view}-${state}.png`;fs.writeFileSync(`${out}/${file}`,Buffer.from(data.png,'base64'));delete data.png;captures.push({side,view,state,file,sha256:sha(`${out}/${file}`),...data});
  }
  assert.deepEqual(errors,[]);for(const side of ['left','right'])for(const view of ['front','back']){const pair=captures.filter(c=>c.side===side&&c.view===view);assert.equal(pair.length,2);assert.equal(pair[0].ids.length,64);assert.deepEqual(pair[0].ids,pair[1].ids);assert.deepEqual(pair[0].cameraPosition,pair[1].cameraPosition);assert.deepEqual(pair[0].target,pair[1].target);assert.equal(pair[0].extent,pair[1].extent);}
  fs.writeFileSync(`${out}/captures.json`,JSON.stringify({createdAt:new Date().toISOString(),reportSha256:sha(`${out}/report.json`),auditSha256:sha(`${out}/readback.json`),scriptSha256:sha('scripts/capture-lower-body-bone-flow.mjs'),limits:'Private same-side overview: all38 source muscles,25 fixed HRA bone hierarchy surfaces and skin. Mapped source bones, opposite-side muscles, feet, nerves and vessels are omitted. Not public UI or clinical validation.',errors,captures},null,2)+'\n');console.log('Eight paired lower-body diagnostics saved.');
}finally{await browser.close();}
