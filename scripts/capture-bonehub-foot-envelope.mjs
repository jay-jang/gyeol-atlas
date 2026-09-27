import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
const root='.cache/bonehub-ct-inspection',input=`${root}/envelope.json`,report=JSON.parse(fs.readFileSync(input));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(hash(report.binary.file),report.binary.sha256);
const binary=gunzipSync(fs.readFileSync(report.binary.file));
const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><title>Source CT envelope diagnostic</title><body style="margin:0;background:#081d27"></body>');}
  else if(req.url==='/parts.bin'){res.setHeader('Content-Type','application/octet-stream');res.end(binary);}
  else if(['/three.module.js','/three.core.js'].includes(req.url)){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(`node_modules/three/build${req.url}`));}
  else{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const captures=[],errors=[];
try{
  browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1500,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async report=>{
    const T=await import('/three.module.js'),bytes=await(await fetch('/parts.bin')).arrayBuffer(),scene=new T.Scene();
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1500,1000);renderer.setClearColor('#081d27');renderer.setScissorTest(true);document.body.append(renderer.domElement);
    const camera=new T.PerspectiveCamera(32,500/440,1,5000);scene.add(new T.AmbientLight(0xffffff,1.8));
    const light=new T.DirectionalLight(0xffffff,2.5);light.position.set(500,600,700);scene.add(light);
    for(const part of [...report.sourceParts,...report.candidates.flatMap(c=>[c.surface,c.artificialClosures])]){
      const source=new Float32Array(bytes,part.positions,part.vertices*3),xyz=new Float32Array(source.length);
      // Proper rotation: native LPS -> display X=left,Y=superior,Z=anterior.
      for(let i=0;i<source.length;i+=3){xyz[i]=source[i];xyz[i+1]=source[i+2];xyz[i+2]=-source[i+1];}
      const g=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(xyz,3));g.setIndex(new T.BufferAttribute(new Uint32Array(bytes,part.indices,part.triangles*3),1));g.computeVertexNormals();
      const bone=part.kind==='bone',cap=part.kind==='artificial-caps';
      const m=new T.Mesh(g,new T.MeshStandardMaterial({color:bone?(part.name.endsWith('LEFT')?'#ffb25b':'#ece0c9'):cap?'#eb4bca':'#55dbea',transparent:!bone,opacity:cap?.75:bone?1:.2,depthWrite:bone,side:T.DoubleSide,flatShading:!bone}));
      m.name=part.name;m.userData.kind=part.kind;scene.add(m);
    }
    const text=(s,x,y)=>{const d=document.createElement('div');d.textContent=s;d.style.cssText=`position:absolute;left:${x}px;top:${y}px;color:white;font:16px/1.4 sans-serif`;document.body.append(d);};
    text('OFFLINE / Native female CT + 34 source foot labels. Stored thresholds, NOT HU. NOT verified skin or HRA placement.',18,14);
    text('Cyan: unsmoothed voxel envelope. Magenta: artificial crop closure at z=199.5 mm. Both feet remain connected.',18,952);
    for(let i=0;i<3;i++)text(`Stored threshold ${report.candidates[i].thresholdStored}`,i*500+18,48);
    window.diagnostic={T,scene,renderer,camera,text};
  },report);
  for(const mode of ['bones-through-envelope','opaque-envelope']){
    const views=await page.evaluate(({report,mode})=>{
      const {T,scene,renderer,camera}=window.diagnostic,views=[];
      for(let col=0;col<3;col++){
        const c=report.candidates[col],box=new T.Box3();
        for(const m of scene.children)if(m.isMesh){m.visible=m.userData.kind==='bone'||m.name===c.surface.name||m.name===c.artificialClosures.name;if(m.name===c.surface.name){box.expandByObject(m);m.material.opacity=mode==='opaque-envelope'?1:.2;m.material.transparent=mode!=='opaque-envelope';m.material.depthWrite=mode==='opaque-envelope';}}
        const center=box.getCenter(new T.Vector3()),distance=box.getSize(new T.Vector3()).length()/2/Math.sin(camera.fov*Math.PI/360)*1.12;
        for(let row=0;row<2;row++){
          const direction=row===0?new T.Vector3(0,.25,1).normalize():new T.Vector3(1,.3,.2).normalize();
          camera.position.copy(center).addScaledVector(direction,distance);camera.lookAt(center);
          renderer.setViewport(col*500,60+(1-row)*440,500,440);renderer.setScissor(col*500,60+(1-row)*440,500,440);renderer.render(scene,camera);
          views.push({threshold:c.thresholdStored,view:row===0?'anterior-oblique':'left-oblique',visibleBones:scene.children.filter(m=>m.isMesh&&m.visible&&m.userData.kind==='bone').length,position:camera.position.toArray(),target:center.toArray()});
        }
      }return views;
    },{report,mode});
    assert.ok(views.every(v=>v.visibleBones===34));
    const file=`${root}/${mode}.png`;await page.screenshot({path:file});captures.push({mode,file,sha256:hash(file),views});
  }
  assert.deepEqual(errors,[]);
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
fs.writeFileSync(`${root}/envelope-visual.json`,JSON.stringify({status:'Offline source-coordinate diagnostic, not application UI or clinical review',captures,errors,files:[input,'scripts/capture-bonehub-foot-envelope.mjs'].map(file=>({file,sha256:hash(file)}))},null,2)+'\n');
console.log(JSON.stringify({captures:captures.length,errors}));
