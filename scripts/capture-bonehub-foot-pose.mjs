import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const mode=process.argv[2]||'sampled';assert.ok(['sampled','full'].includes(mode));
const out='.cache/bonehub-foot',hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const input=`${out}/pose-${mode}.json`,report=JSON.parse(fs.readFileSync(input));for(const f of report.files)assert.equal(hash(f.file),f.sha256,f.file);
const server=http.createServer((req,res)=>{
  const files={'/three.module.js':'node_modules/three/build/three.module.js','/three.core.js':'node_modules/three/build/three.core.js','/parts.json':`${out}/pose-${mode}-parts.json`};
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Native female foot candidate</title><body style="margin:0"></body>');}
  else if(files[req.url]){res.setHeader('Content-Type',req.url.endsWith('.json')?'application/json':'text/javascript');fs.createReadStream(files[req.url]).pipe(res);}
  else{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;const captures=[],errors=[];
try{
  browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1000,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async()=>{
    const T=await import('/three.module.js'),parts=await fetch('/parts.json').then(r=>r.json()),scene=new T.Scene();
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,900);renderer.setClearColor('#081d27');renderer.localClippingEnabled=true;document.body.append(renderer.domElement);
    const camera=new T.PerspectiveCamera(30,1000/900,.001,10),up=new T.Plane(new T.Vector3(0,-1,0),.24),sidePlane=new T.Plane(new T.Vector3(1,0,0),0);
    scene.add(new T.AmbientLight(0xffffff,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(1,2,3);scene.add(light);
    for(const p of parts.filter(p=>p.kind!=='donor'||p.variant==='candidate')){
      const g=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(p.positions),3));g.setIndex(p.indices);g.computeVertexNormals();
      const m=new T.Mesh(g,new T.MeshStandardMaterial({color:p.kind==='donor'?'#ffb25b':p.kind==='target'?'#9ddced':'#54d1e7',side:T.DoubleSide,transparent:p.kind==='skin',opacity:p.kind==='skin'?.17:1,depthWrite:p.kind!=='skin',clippingPlanes:[up,sidePlane]}));m.userData={side:p.side,kind:p.kind};scene.add(m);
    }
    const label=document.createElement('div');Object.assign(label.style,{position:'absolute',left:'20px',top:'20px',right:'20px',color:'#fff',font:'16px/1.5 sans-serif'});document.body.append(label);
    window.diagnostic={T,scene,renderer,camera,label,sidePlane};
  });
  for(const side of ['left','right'])for(const view of ['anterior','lateral']){
    const camera=await page.evaluate(({side,view,mode})=>{
      const {T,scene,renderer,camera,label,sidePlane}=window.diagnostic,box=new T.Box3();sidePlane.normal.set(side==='left'?1:-1,0,0);
      let visibleSourceMeshes=0;for(const m of scene.children)if(m.isMesh){m.visible=m.userData.side===side||m.userData.kind==='skin';if(m.visible&&m.userData.kind==='donor'){box.expandByObject(m);visibleSourceMeshes++;}}
      if(visibleSourceMeshes!==17)throw Error('Expected seventeen complete foot source labels');
      const center=box.getCenter(new T.Vector3()),distance=box.getSize(new T.Vector3()).length()/2/Math.sin(camera.fov*Math.PI/360)*1.2;
      camera.position.copy(center).add(view==='anterior'?new T.Vector3(0,0,distance):new T.Vector3(side==='left'?distance:-distance,0,0));camera.lookAt(center);renderer.render(scene,camera);
      label.textContent=`${side} / ${view} / ${mode}: 17 female source labels. OFFLINE / NOT APPLIED. Orange: BoneHub foot; cyan: fixed HRA skin and lower-leg bones.`;
      return {position:camera.position.toArray(),target:center.toArray(),visibleSourceMeshes};
    },{side,view,mode});
    const file=`${out}/${mode}-${side}-${view}.png`;await page.screenshot({path:file});captures.push({side,view,file,sha256:hash(file),camera});
  }
  assert.deepEqual(errors,[]);
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
fs.writeFileSync(`${out}/visual-${mode}.json`,JSON.stringify({mode,status:'Offline geometry diagnostic, not application or anatomical approval',skinOpacity:.17,
  clipping:'Above y=0.24m and opposite body half hidden only for rendering',captures,errors,
  files:[input,`${out}/pose-${mode}-parts.json`,'scripts/capture-bonehub-foot-pose.mjs'].map(file=>({file,sha256:hash(file)}))},null,2)+'\n');console.log(JSON.stringify({captures:captures.length,errors}));
