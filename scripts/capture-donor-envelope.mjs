// Standalone source-frame diagnostic. No app/browser state is loaded or changed.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {chromium} from '@playwright/test';

const root=process.argv[2];assert.ok(root);
const sha=b=>createHash('sha256').update(b).digest('hex');
const receipt=JSON.parse(fs.readFileSync('docs/anatomy-alignment/donor-original-receipt.json'));
const record=receipt.combined.find(r=>r.entry.endsWith('/VHF_Both_All.stl'));
const raw=fs.readFileSync(path.join(root,record.entry));assert.equal(sha(raw),record.sha256);
const skin=new STLLoader().parse(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));skin.scale(.001,.001,.001);
const skinBytes=Buffer.from(skin.attributes.position.array.buffer);
const packing=JSON.parse(fs.readFileSync('docs/anatomy-alignment/donor-fidelity-packing.json')).unsimplifiedAlternative;
const zipped=fs.readFileSync('.cache/donor-fidelity/source-full.bin.gz');assert.equal(sha(zipped),packing.sha256);
const muscleBytes=gunzipSync(zipped),out='.cache/donor-original-envelope';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  const js={'/three.module.js':'node_modules/three/build/three.module.js','/three.core.js':'node_modules/three/build/three.core.js'};
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Donor source envelope</title><body style="margin:0"></body>');}
  else if(js[req.url]){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(js[req.url]));}
  else if(req.url==='/skin.bin'){res.end(skinBytes);}
  else if(req.url==='/muscles.bin'){res.end(muscleBytes);}
  else{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;const errors=[],captures=[];
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1000,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async parts=>{
    const T=await import('/three.module.js'),scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(1000,1000);renderer.setClearColor('#081d27');document.body.append(renderer.domElement);
    scene.add(new T.AmbientLight(0xffffff,2));const lamp=new T.DirectionalLight(0xffffff,3);lamp.position.set(1,2,3);scene.add(lamp);
    const camera=new T.PerspectiveCamera(30,1,.001,10),body=new T.Group();scene.add(body);
    // Proper common axis rotation only; no atlas fit, reflection, or translation.
    body.setRotationFromMatrix(new T.Matrix4().set(-1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1));
    const bytes=await fetch('/skin.bin').then(r=>r.arrayBuffer()),g=new T.BufferGeometry();
    g.setAttribute('position',new T.BufferAttribute(new Float32Array(bytes),3));g.computeVertexNormals();
    const shell=new T.Mesh(g,new T.MeshStandardMaterial({color:'#58cbe3',side:T.DoubleSide}));body.add(shell);
    const data=await fetch('/muscles.bin').then(r=>r.arrayBuffer()),muscles=new T.Group();body.add(muscles);
    for(const p of parts){
      const m=new T.BufferGeometry();m.setAttribute('position',new T.BufferAttribute(new Float32Array(data,p.positions,p.vertexCount*3),3));
      m.setIndex(new T.BufferAttribute(new Uint32Array(data,p.indices,p.indexCount),1));m.computeVertexNormals();
      muscles.add(new T.Mesh(m,new T.MeshStandardMaterial({color:'#e99170',roughness:.8,side:T.DoubleSide})));
    }
    window.diagnostic={T,scene,renderer,camera,body,shell,muscles};
  },packing.parts);
  for(const mode of ['surface','muscles-with-envelope']){
    const result=await page.evaluate(mode=>{
      const {T,scene,renderer,camera,body,shell,muscles}=window.diagnostic;
      muscles.visible=mode!=='surface';shell.material.transparent=muscles.visible;shell.material.opacity=muscles.visible?.13:1;shell.material.depthWrite=!muscles.visible;shell.material.needsUpdate=true;
      const box=new T.Box3().setFromObject(body),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
      const distance=size.length()/2/Math.sin(camera.fov*Math.PI/360)*1.05;
      camera.position.copy(center).add(new T.Vector3(.35,0,1).normalize().multiplyScalar(distance));camera.lookAt(center);renderer.render(scene,camera);
      return {png:renderer.domElement.toDataURL('image/png').split(',')[1],camera:camera.position.toArray(),target:center.toArray()};
    },mode);
    const file=`${out}/source-${mode}.png`,bytes=Buffer.from(result.png,'base64');fs.writeFileSync(file,bytes);
    captures.push({mode,file,sha256:sha(bytes),camera:result.camera,target:result.target});
  }
  assert.deepEqual(errors,[]);
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));skin.dispose();}
const report={status:'SOURCE-FRAME VISUAL DIAGNOSTIC; not HRA registration or application UI verification',
  sourceAllSha256:record.sha256,sourceMusclePackingSha256:packing.sha256,scriptSha256:sha(fs.readFileSync('scripts/capture-donor-envelope.mjs')),
  colors:{surface:'cyan; opaque or 13% opacity',muscles:'salmon'},commonRotationRows:[[-1,0,0],[0,0,1],[0,1,0]],captures,errors};
fs.writeFileSync(`${out}/visual.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
