// Fixed-camera offline comparison of six representative rib surfaces. This is
// not the application view and does not approve the candidate for release.
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {chromium} from '@playwright/test';
import {exactPositionComponents} from './lib/exact-position-components.mjs';

const out='.cache/bonehub-thorax',report=JSON.parse(fs.readFileSync(`${out}/screen.json`));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for(const f of report.files)assert.equal(sha(f.path),f.sha256,f.path);
const inventory=JSON.parse(fs.readFileSync('docs/anatomy-alignment/bonehub-female-inventory.json'));
const receipt=JSON.parse(fs.readFileSync('docs/anatomy-alignment/bonehub-female-receipt.json'));
const atlas=JSON.parse(fs.readFileSync('public/models/female/atlas-female.json'));
const matrix=new Matrix4().fromArray(report.candidates.find(c=>c.mode==='rigid').matrixColumnMajor);
const buffers=new Map();
function packed(part){
  if(!buffers.has(part.chunk)){
    const c=atlas.chunks[part.chunk],z=fs.readFileSync(`public/models/female/${c.gzip.split('/').pop()}`);
    assert.equal(z.length,c.gzipBytes);const b=gunzipSync(z);assert.equal(b.length,c.bytes);buffers.set(part.chunk,b);
  }
  const b=buffers.get(part.chunk),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>b.readFloatLE(part.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>b.readUInt32LE(part.indices+4*i)),1));
  return g;
}
function donor(name){
  const part=inventory.parts.find(p=>p.name===name),file=receipt.files.find(f=>f.path===part?.file);assert.ok(part&&file);
  const b=fs.readFileSync(file.local);assert.equal(createHash('sha256').update(b).digest('hex'),part.sha256);
  const raw=new STLLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
  const {geometry:g}=exactPositionComponents(raw);raw.dispose();const a=g.attributes.position;
  for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i);a.setXYZ(i,Math.fround(x*.001),Math.fround(z*.001),Math.fround(-y*.001));}
  return g.applyMatrix4(matrix);
}
const pack=(g,id,kind,variant)=>({id,kind,variant,positions:Array.from(g.attributes.position.array),indices:Array.from(g.index.array)});
const parts=[],use=['4','7','9'];const words={4:'fourth',7:'seventh',9:'ninth'};
for(const side of ['left','right'])for(const n of use){
  const name=`${side[0].toUpperCase()+side.slice(1)} ${words[n]} rib`,p=atlas.parts.find(x=>x.system==='borrowed'&&x.name===name);assert.ok(p);
  const baseline=packed(p),candidate=donor(`RIB_${n}_${side.toUpperCase()}`);
  parts.push(pack(baseline,p.id,'rib','current'),pack(candidate,p.id,'rib','rigid'));
  baseline.dispose();candidate.dispose();
}
for(const id of ['HRAF0754','HRAF0748','HRAF0757','HRAF0738']){
  const p=atlas.parts.find(x=>x.id===id);assert.ok(p);const g=packed(p);parts.push(pack(g,id,'lung','both'));g.dispose();
}
for(const id of ['HRAF0835','HRAF0837','HRAF0839']){
  const p=atlas.parts.find(x=>x.id===id);assert.ok(p);const g=packed(p);parts.push(pack(g,id,'spine','both'));g.dispose();
}
const skin=packed(atlas.parts.find(p=>p.id==='HRAF0003'));parts.push(pack(skin,'HRAF0003','skin','both'));skin.dispose();
const payload=JSON.stringify(parts),server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Offline female thorax diagnostic</title><body style="margin:0"></body>');}
  else if(req.url==='/parts.json'){res.setHeader('Content-Type','application/json');res.end(payload);}
  else if(['/three.module.js','/three.core.js'].includes(req.url)){res.setHeader('Content-Type','text/javascript');fs.createReadStream(`node_modules/three/build${req.url}`).pipe(res);}
  else{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;const captures=[],errors=[];
try{
  browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1000,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async()=>{
    const T=await import('/three.module.js'),parts=await fetch('/parts.json').then(r=>r.json()),scene=new T.Scene();
    const camera=new T.PerspectiveCamera(35,1000/900,.01,10),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(1000,900);renderer.setClearColor('#081d27');document.body.append(renderer.domElement);
    scene.add(new T.AmbientLight(0xffffff,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(1,2,3);scene.add(light);
    for(const p of parts){const g=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(p.positions),3));g.setIndex(p.indices);g.computeVertexNormals();
      const color=p.kind==='rib'?'#efc48d':p.kind==='lung'?'#b34b72':p.kind==='spine'?'#79d9ed':'#53d4d5';
      const opacity=p.kind==='skin'?.08:p.kind==='lung'?.50:1;
      const mesh=new T.Mesh(g,new T.MeshStandardMaterial({color,side:T.DoubleSide,transparent:opacity<1,opacity,depthWrite:opacity>=1}));
      mesh.userData={id:p.id,kind:p.kind,variant:p.variant};scene.add(mesh);}
    const label=document.createElement('div');Object.assign(label.style,{position:'absolute',left:'16px',top:'16px',color:'#fff',font:'16px/1.5 sans-serif',whiteSpace:'pre-line'});document.body.append(label);
    window.diagnostic={T,scene,camera,renderer,label};
  });
  for(const variant of ['current','rigid'])for(const view of ['front','back']){
    const camera=await page.evaluate(({variant,view})=>{
      const {T,scene,camera,renderer,label}=window.diagnostic,ids=[];
      for(const m of scene.children)if(m.isMesh){m.visible=m.userData.variant==='both'||m.userData.variant===variant;if(m.visible&&m.userData.kind==='rib')ids.push(m.userData.id);}
      const target=new T.Vector3(0,1.27,0);camera.position.copy(target).add(view==='front'?new T.Vector3(0,.05,.92):new T.Vector3(0,.05,-.92));camera.lookAt(target);
      renderer.render(scene,camera);
      label.textContent=`${variant} / ${view} — OFFLINE, NOT APPLIED\nIvory: 6 selected ribs; red: 4 lung segments; cyan: native spine/skin (8%).`;
      return {position:camera.position.toArray(),target:target.toArray(),ribIds:ids};
    },{variant,view});
    assert.equal(camera.ribIds.length,6);
    const file=`${out}/${variant}-${view}.png`;await page.screenshot({path:file});captures.push({variant,view,file,sha256:sha(file),camera});
  }
  assert.deepEqual(errors,[]);
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
fs.writeFileSync(`${out}/visual.json`,JSON.stringify({status:'Fixed-camera offline visual comparison; not app UI or anatomical approval',captures,errors,
  sourceReport:`${out}/screen.json`,sourceReportSha256:sha(`${out}/screen.json`),scriptSha256:sha('scripts/capture-bonehub-thorax-candidate.mjs')},null,2)+'\n');
console.log(JSON.stringify({captures:captures.length,errors}));
