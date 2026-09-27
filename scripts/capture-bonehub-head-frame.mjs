import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
const out='.cache/bonehub-head',hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const frame=JSON.parse(fs.readFileSync(`${out}/frame.json`)),audit=JSON.parse(fs.readFileSync(`${out}/audit.json`));
for(const report of [frame,audit])for(const f of report.files)assert.equal(hash(f.file),f.sha256,f.file);
const original=JSON.parse(gunzipSync(fs.readFileSync(frame.parts))),placed=JSON.parse(gunzipSync(fs.readFileSync(audit.placedFile)));
const parts=JSON.stringify([...placed,...original.filter(p=>['skin','neural','target'].includes(p.kind))]);
const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Offline head diagnostic</title><body style="margin:0"></body>');}
  else if(req.url==='/parts.json'){res.setHeader('Content-Type','application/json');res.end(parts);}
  else if(['/three.module.js','/three.core.js'].includes(req.url)){res.setHeader('Content-Type','text/javascript');fs.createReadStream(`node_modules/three/build${req.url}`).pipe(res);}
  else{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;const captures=[],errors=[];
try{
  browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1100,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async()=>{
    const T=await import('/three.module.js'),parts=await fetch('/parts.json').then(r=>r.json()),scene=new T.Scene(),camera=new T.PerspectiveCamera(30,1.1,.001,10);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1100,1000);renderer.setClearColor('#081d27');renderer.localClippingEnabled=true;document.body.append(renderer.domElement);
    scene.add(new T.AmbientLight(0xffffff,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(1,2,3);scene.add(light);
    const neckClip=new T.Plane(new T.Vector3(0,1,0),-1.38),halfSkull=new T.Plane(new T.Vector3(-1,0,0),0);
    for(const p of parts){const g=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(p.positions),3));g.setIndex(p.indices);g.computeVertexNormals();
      const m=new T.Mesh(g,new T.MeshStandardMaterial({color:p.kind==='head'?'#efd8ab':p.kind==='target'?'#79d9ed':p.kind==='neural'?'#c182d9':'#53d4d5',side:T.DoubleSide,transparent:p.kind==='skin',opacity:p.kind==='skin'?.12:1,depthWrite:p.kind!=='skin',clippingPlanes:[neckClip]}));m.userData={id:p.id,kind:p.kind,variant:p.variant};scene.add(m);}
    const label=document.createElement('div');Object.assign(label.style,{position:'absolute',left:'20px',top:'20px',right:'20px',color:'#fff',font:'16px/1.5 sans-serif',whiteSpace:'pre-line'});document.body.append(label);
    window.diagnostic={T,scene,camera,renderer,neckClip,halfSkull,label};
  });
  for(const variant of ['borrowed-baseline','initial','rigid','similarity'])for(const view of ['anterior','lateral-cut']){
    const info=await page.evaluate(({variant,view})=>{
      const {T,scene,camera,renderer,neckClip,halfSkull,label}=window.diagnostic;const ids=[];
      for(const m of scene.children)if(m.isMesh){m.visible=m.userData.kind!=='head'||m.userData.variant===variant;m.material.clippingPlanes=m.userData.kind==='head'&&view==='lateral-cut'?[neckClip,halfSkull]:[neckClip];if(m.visible&&m.userData.kind==='head')ids.push(m.userData.id);}
      const target=new T.Vector3(0,1.54,-.05);camera.position.copy(target).add(view==='anterior'?new T.Vector3(0,0,.76):new T.Vector3(.76,0,0));camera.lookAt(target);renderer.render(scene,camera);
      label.textContent=`${variant} / ${view} — OFFLINE, NOT APPLIED\nIvory: skull; purple: fixed neural layer; cyan: fixed cervical bones/skin (12%).\nBelow y=1.38m hidden. ${view==='lateral-cut'?'Skull x>0 half hidden for inspection; neural geometry intact.':'Complete skull shown.'}`;
      return {position:camera.position.toArray(),target:target.toArray(),visibleHeadIds:ids};
    },{variant,view});
    assert.equal(info.visibleHeadIds.length,variant==='borrowed-baseline'?18:2);
    const file=`${out}/${variant}-${view}.png`;await page.screenshot({path:file});captures.push({variant,view,file,sha256:hash(file),camera:info});
  }assert.deepEqual(errors,[]);
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
fs.writeFileSync(`${out}/visual.json`,JSON.stringify({status:'Offline fixed-camera diagnostic; not application UI or clinical approval',captures,errors,
  files:[`${out}/frame.json`,`${out}/audit.json`,frame.parts,audit.placedFile,'scripts/capture-bonehub-head-frame.mjs'].map(file=>({file,sha256:hash(file)}))},null,2)+'\n');console.log(JSON.stringify({captures:captures.length,errors}));
