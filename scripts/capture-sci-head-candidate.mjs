import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
const shared=process.argv.includes('--shared');assert.ok(process.argv.slice(2).every(arg=>arg==='--shared'));
const root='.cache/sci-head',report=JSON.parse(fs.readFileSync(`${root}/${shared?'shared-':''}candidate.json`));
const sha=b=>createHash('sha256').update(b).digest('hex');
const packed=fs.readFileSync(report.binary.path);assert.equal(sha(packed),report.binary.sha256);
const binary=gunzipSync(packed);
const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><title>SCI head candidate</title><body style="margin:0;background:#10232c"></body></html>');}
  else if(req.url==='/candidate.bin'){res.setHeader('Content-Type','application/octet-stream');res.end(binary);}
  else if(['/three.module.js','/three.core.js'].includes(req.url)){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(`node_modules/three/build${req.url}`));}
  else{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
try{
  browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async ({report,shared})=>{
    const T=await import('/three.module.js'),bytes=await(await fetch('/candidate.bin')).arrayBuffer();
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,1000);renderer.setClearColor('#10232c');renderer.setScissorTest(true);document.body.append(renderer.domElement);
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,480/400,.001,10);
    scene.add(new T.AmbientLight(0xffffff,1.5));const light=new T.DirectionalLight(0xffffff,2);light.position.set(1,2,3);scene.add(light);
    const specs={'label-1':['#81cbe8',1],'label-2':['#e6a0aa',1],'label-3':['#ede4c7',1],'label-6':['#c3d6cf',1],'non-background-envelope':['#c9b9a6',.12]};
    for(const part of report.parts){
      if(!specs[part.id])continue;
      const [color,opacity]=specs[part.id],g=new T.BufferGeometry();
      g.setAttribute('position',new T.BufferAttribute(new Float32Array(bytes,part.positions,part.vertexCount*3),3));g.setIndex(new T.BufferAttribute(new Uint32Array(bytes,part.indices,part.indexCount),1));g.computeVertexNormals();
      const m=new T.Mesh(g,new T.MeshStandardMaterial({color,opacity,transparent:opacity<1,depthWrite:opacity===1,side:T.DoubleSide}));m.name=part.id;scene.add(m);
    }
    const label=(text,x,y,size=16)=>{const p=document.createElement('div');p.textContent=text;p.style.cssText=`position:fixed;left:${x}px;top:${y}px;color:white;font:${size}px/1.5 sans-serif;background:#10232c;padding:8px`;document.body.append(p);};
    label(`SCI 여성 머리 · ${shared?'공유 복셀 경계 (계단형)':'개별 보간 표면'} · 조직 이름은 잠정 해석`,18,8,20);
    const sets=[['label-1','label-2','label-6','non-background-envelope'],['label-2','non-background-envelope'],['label-3','non-background-envelope']];
    const titles=['원본 라벨 1·2·6 + 외곽','원본 라벨 2 (회백질 추정)','원본 라벨 3 (백질 추정)'];
    const box=new T.Box3(...report.parts.find(p=>p.id==='non-background-envelope').bounds.map(v=>new T.Vector3(...v))),target=box.getCenter(new T.Vector3());
    for(let col=0;col<3;col++){
      label(titles[col],col*480+16,58);
      for(const o of scene.children)if(o.isMesh)o.visible=sets[col].includes(o.name);
      for(let row=0;row<2;row++){
        camera.position.copy(target).add(row===0?new T.Vector3(0,0,.62):new T.Vector3(.62,0,0));camera.lookAt(target);
        renderer.setViewport(col*480,85+(1-row)*400,480,400);renderer.setScissor(col*480,85+(1-row)*400,480,400);renderer.render(scene,camera);
      }
    }
    label('상단: 앞 / 하단: 왼쪽에서 관찰 · LPS 원본 좌표 · 절단 경계는 닫힌 인공 끝면 포함',18,925);
    label('HRA 전신에 미정합 · 앱 미적용 · 출처: SCI Head Model, Warner et al. 2019 · 임상 검수 아님',18,960);
  },{report,shared});
  const path=`${root}/${shared?'shared-':''}candidate.png`;await page.screenshot({path});assert.deepEqual(errors,[]);
  fs.writeFileSync(`${root}/${shared?'shared-':''}candidate-capture.json`,JSON.stringify({path,sha256:sha(fs.readFileSync(path)),inputSha256:report.binary.sha256,errors,appMounted:false},null,2)+'\n');
  console.log('SCI candidate capture saved; page errors 0.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
