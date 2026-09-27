// Private diagnostic renderer, not a screenshot/test of the public app UI.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const out='.cache/calf-knee-provenance';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const audit=JSON.parse(fs.readFileSync(`${out}/audit.json`));
for(const f of audit.files.filter(f=>!f.path.endsWith('.stl')))assert.equal(hash(f.path),f.sha256,f.path);
const scenes=JSON.parse(fs.readFileSync(`${out}/diagnostic.json`));assert.equal(scenes.length,4);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],captures=[];
try{
  const page=await browser.newPage({viewport:{width:1100,height:850}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__calf-knee-diagnostic',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"></body></html>'}));
  await page.goto('http://127.0.0.1:5174/__calf-knee-diagnostic');
  await page.evaluate(async()=>{
    const T=await import('/node_modules/.vite/deps/three.js');
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1100,850);renderer.setClearColor('#14212b');document.body.append(renderer.domElement);
    window.knee={T,renderer};
  });
  for(const data of scenes)for(const view of ['posterior','oblique']){
    const evidence=await page.evaluate(({data,view})=>{
      const {T,renderer}=window.knee,scene=new T.Scene();scene.add(new T.AmbientLight(0xffffff,2));
      const light=new T.DirectionalLight(0xffffff,3);light.position.set(1,2,-3);scene.add(light);
      const focus=new T.Box3();
      for(const p of data.parts){
        const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(p.positions),3));g.setIndex(new T.BufferAttribute(new Uint32Array(p.indices),1));g.computeVertexNormals();g.computeBoundingBox();
        if(data.focusIds.includes(p.id))focus.union(g.boundingBox);
        const muscle=p.id.startsWith('VHF'),source=p.id.startsWith('SOURCE-');
        const material=new T.MeshStandardMaterial({color:muscle?'#51bdf5':source?'#67e998':'#efd5a6',side:T.DoubleSide,transparent:muscle,opacity:muscle?.48:1,depthWrite:!muscle});
        const mesh=new T.Mesh(g,material);mesh.userData.id=p.id;scene.add(mesh);
      }
      const centre=focus.getCenter(new T.Vector3()),extent=Math.max(.19,focus.getSize(new T.Vector3()).length()*1.35),aspect=1100/850;
      const camera=new T.OrthographicCamera(-extent*aspect/2,extent*aspect/2,extent/2,-extent/2,.001,5);
      const direction=new T.Vector3(view==='posterior'?0:data.side==='left'?-1:1,.15,-1).normalize();camera.position.copy(centre).addScaledVector(direction,1);camera.lookAt(centre);camera.updateProjectionMatrix();renderer.render(scene,camera);
      const result={cameraPosition:camera.position.toArray(),target:centre.toArray(),extent,ids:data.parts.map(p=>p.id),png:renderer.domElement.toDataURL('image/png').split(',')[1]};
      scene.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});return result;
    },{data,view});
    const file=`knee-${data.side}-${data.frame}-${view}.png`;
    fs.writeFileSync(`${out}/${file}`,Buffer.from(evidence.png,'base64'));delete evidence.png;
    captures.push({side:data.side,frame:data.frame,view,file,sha256:hash(`${out}/${file}`),...evidence});
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(`${out}/captures.json`,JSON.stringify({createdAt:new Date().toISOString(),status:'PRIVATE DIAGNOSTIC, not app UI or anatomical approval',
    auditSha256:hash(`${out}/audit.json`),diagnosticSha256:hash(`${out}/diagnostic.json`),scriptSha256:hash('scripts/capture-calf-knee-provenance.mjs'),
    colorKey:{sourceMuscle:'blue, 48% opacity',sourceLigaments:'green',fixedHraTargets:'beige'},
    limits:'Camera frames the knee; distal muscle/bone portions extend beyond viewport. Skin, other muscles and untested structures are omitted. Source and HRA ligaments are intentionally shown together for correspondence comparison.',errors,captures},null,2)+'\n');
  console.log('Eight knee diagnostic images saved; browser errors 0.');
}finally{await browser.close();}
