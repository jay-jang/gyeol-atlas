// Standalone geometry diagnostic; no application state, GLB, or public assets changed.
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const out='.cache/donor-feet',hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const audit=JSON.parse(fs.readFileSync(`${out}/audit.json`));
for(const f of audit.files)assert.equal(hash(f.file),f.sha256,f.file);
const server=http.createServer((req,res)=>{
  const files={'/three.module.js':'node_modules/three/build/three.module.js','/three.core.js':'node_modules/three/build/three.core.js','/parts.json':`${out}/visual-parts.json`};
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Female source foot diagnostic</title><body style="margin:0"></body>');}
  else if(files[req.url]){res.setHeader('Content-Type',req.url.endsWith('.json')?'application/json':'text/javascript');res.end(fs.readFileSync(files[req.url]));}
  else{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;const errors=[],captures=[];
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1000,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async()=>{
    const T=await import('/three.module.js'),parts=await fetch('/parts.json').then(r=>r.json());
    const scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(1000,900);renderer.setClearColor('#081d27');renderer.localClippingEnabled=true;document.body.append(renderer.domElement);
    scene.add(new T.AmbientLight(0xffffff,2));const lamp=new T.DirectionalLight(0xffffff,3);lamp.position.set(1,2,3);scene.add(lamp);
    const camera=new T.PerspectiveCamera(30,1000/900,.001,10),cut=new T.Plane(new T.Vector3(0,-1,0),.24);
    for(const p of parts){
      if(p.mode!=='all'&&p.mode!=='surface-shank')continue;
      const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(p.positions),3));g.setIndex(p.indices);g.computeVertexNormals();
      const m=new T.Mesh(g,new T.MeshStandardMaterial({color:p.kind==='donor'?'#ffb25b':p.kind==='target'?'#9ddced':'#54d1e7',
        side:T.DoubleSide,transparent:p.kind==='skin',opacity:p.kind==='skin'?.17:1,depthWrite:p.kind!=='skin',clippingPlanes:[cut]}));
      m.userData={side:p.side,kind:p.kind};scene.add(m);
    }
    const label=document.createElement('div');Object.assign(label.style,{position:'absolute',left:'20px',top:'20px',color:'#fff',font:'18px sans-serif'});document.body.append(label);
    window.diagnostic={T,scene,renderer,camera,label};
  });
  for(const side of ['left','right'])for(const view of ['anterior','lateral']){
    const camera=await page.evaluate(({side,view})=>{
      const {T,scene,renderer,camera,label}=window.diagnostic,box=new T.Box3();
      for(const m of scene.children)if(m.isMesh){m.visible=m.userData.side===side||m.userData.kind==='skin';if(m.visible&&m.userData.kind==='donor')box.expandByObject(m);}
      const center=box.getCenter(new T.Vector3()),distance=box.getSize(new T.Vector3()).length()/2/Math.sin(camera.fov*Math.PI/360)*1.18;
      camera.position.copy(center).add(view==='anterior'?new T.Vector3(0,0,distance):new T.Vector3(side==='left'?distance:-distance,0,0));camera.lookAt(center);renderer.render(scene,camera);
      label.textContent=`${side} / ${view} — OFFLINE CANDIDATE (NOT APPLIED) · orange: female source foot · cyan: HRA skin / shank`;
      return {position:camera.position.toArray(),target:center.toArray()};
    },{side,view});
    const file=`${out}/foot-${side}-${view}.png`;await page.screenshot({path:file});captures.push({side,view,file,sha256:hash(file),camera});
  }
  assert.deepEqual(errors,[]);
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
const report={status:'Independent candidate rendering, not UI or clinical validation',mode:'surface-shank',skinOpacity:.17,
  clipping:'All surfaces above atlas y=0.24m clipped for ankle inspection; lower body not removed from data',captures,errors,
  files:['scripts/capture-donor-feet.mjs',`${out}/audit.json`,`${out}/visual-parts.json`].map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync(`${out}/visual.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
