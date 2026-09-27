import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
assert.ok(process.argv.slice(2).length===0||process.argv.slice(2).length===1&&process.argv[2]==='--all-vertices');
const out=process.argv[2]?'.cache/brain-pose-full':'.cache/brain-pose',hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f));
const fit=read(`${out}/fit.json`),audit=read(`${out}/audit.json`),anchors=read('.cache/brain-pose/anchors.json'),head=read('.cache/bonehub-head/audit.json');
for(const r of [fit,audit,anchors,head])for(const f of r.files)assert.equal(hash(f.file),f.sha256,f.file);
const original=JSON.parse(gunzipSync(fs.readFileSync(anchors.parts))),snapshots=JSON.parse(gunzipSync(fs.readFileSync(fit.parts)));
const native=JSON.parse(gunzipSync(fs.readFileSync(head.placedFile))).filter(p=>p.variant==='rigid');
const parts=JSON.stringify([...original.filter(p=>p.kind==='skin'||p.kind==='target'||p.kind==='neural'&&!anchors.movingIds.includes(p.id)),...native.map(p=>({...p,kind:'skull',variant:undefined})),
  ...snapshots.flatMap(s=>s.parts.map(p=>({...p,kind:'brain',variant:s.mode})))]);
const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Offline rigid brain pose diagnostic</title><body style="margin:0"></body>');}
  else if(req.url==='/parts.json'){res.setHeader('Content-Type','application/json');res.end(parts);}
  else if(['/three.module.js','/three.core.js'].includes(req.url)){res.setHeader('Content-Type','text/javascript');fs.createReadStream(`node_modules/three/build${req.url}`).pipe(res);}
  else{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;const captures=[],errors=[];
try{
  browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1000,height:900}});page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async()=>{
    const T=await import('/three.module.js'),parts=await fetch('/parts.json').then(r=>r.json()),scene=new T.Scene(),camera=new T.PerspectiveCamera(30,1000/900,.001,10),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(1000,900);renderer.setClearColor('#081d27');renderer.localClippingEnabled=true;document.body.append(renderer.domElement);
    scene.add(new T.AmbientLight(0xffffff,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(1,2,3);scene.add(light);
    const clip=new T.Plane(new T.Vector3(0,1,0),-1.38);
    for(const p of parts){const g=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(p.positions),3)).setIndex(p.indices);g.computeVertexNormals();
      const m=new T.Mesh(g,new T.MeshStandardMaterial({color:p.kind==='brain'?'#ce7bde':p.kind==='skull'?'#efd8ab':'#53d4d5',side:T.DoubleSide,transparent:p.kind==='skin',opacity:p.kind==='skin'?.12:1,depthWrite:p.kind!=='skin',clippingPlanes:[clip]}));m.userData={id:p.id,kind:p.kind,variant:p.variant};scene.add(m);}
    const groups={optic:['HRAF0123','HRAF0256','HRAF0070','HRAF0067','HRAF0069'],cord:['HRAF0185','HRAF0186','HRAF0320','HRAF0321','HRAF0353']},frames={};
    for(const [name,ids] of Object.entries(groups)){const box=new T.Box3();for(const m of scene.children)if(m.isMesh&&ids.includes(m.userData.id))box.expandByObject(m);const target=box.getCenter(new T.Vector3()),distance=box.getSize(new T.Vector3()).length()/2/Math.sin(camera.fov*Math.PI/360)*1.3;
      frames[name]={target:target.toArray(),position:target.clone().add(new T.Vector3(.4,.5,1).normalize().multiplyScalar(distance)).toArray()};}
    frames.head={target:[0,1.54,-.05],position:[0,1.54,.71]};
    const label=document.createElement('div');Object.assign(label.style,{position:'absolute',left:'20px',top:'20px',right:'20px',color:'#fff',font:'16px/1.5 sans-serif',whiteSpace:'pre-line'});document.body.append(label);
    window.diagnostic={scene,camera,renderer,label,frames,groups};
  });
  for(const mode of ['baseline','unconstrained','anchored'])for(const view of ['head','optic','cord']){
    const result=await page.evaluate(({mode,view,full})=>{
      const {scene,camera,renderer,label,frames,groups}=window.diagnostic,visible=[];
      for(const m of scene.children)if(m.isMesh){m.visible=(!m.userData.variant||m.userData.variant===mode)&&(view==='head'||groups[view].includes(m.userData.id));if(m.visible)visible.push({id:m.userData.id,kind:m.userData.kind});}
      camera.position.fromArray(frames[view].position);camera.lookAt(...frames[view].target);renderer.render(scene,camera);
      label.textContent=`${full?'FULL VERTEX':'SAMPLED'} / ${mode} / ${view} — OFFLINE / NOT APPLIED\nPurple: moved Allen reference; cyan: fixed native structures/skin.\n${view==='head'?'Ivory: native skull in fixed rigid candidate frame. Below y=1.38m hidden.':'Numerical interface view; continuity is NOT anatomically verified.'}`;
      return {visible,camera:frames[view]};
    },{mode,view,full:fit.fullVertexObjective});
    assert.equal(result.visible.filter(p=>p.kind==='brain').length,view==='head'?282:view==='optic'?2:4);if(view!=='head')assert.equal(result.visible.length,5);
    const file=`${out}/${mode}-${view}.png`;await page.screenshot({path:file});captures.push({mode,view,file,sha256:hash(file),...result});
  }assert.deepEqual(errors,[]);
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
fs.writeFileSync(`${out}/visual.json`,JSON.stringify({status:'Offline fixed-camera geometry views, not application UI or anatomical approval',captures,errors,
  files:[`${out}/fit.json`,`${out}/audit.json`,fit.parts,anchors.parts,head.placedFile,'scripts/capture-reference-brain-pose.mjs'].map(file=>({file,sha256:hash(file)}))},null,2)+'\n');console.log(JSON.stringify({out,captures:captures.length,errors}));
