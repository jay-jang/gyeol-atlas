import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
const folder='.cache/vivaplus-head-fit',report=JSON.parse(fs.readFileSync(`${folder}/report.json`));
const skinOnly=process.argv.includes('--skin-only');
assert.ok(process.argv.slice(2).every(arg=>arg==='--skin-only'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=fs.readFileSync(report.visualization.path);assert.equal(sha(bytes),report.visualization.sha256);
const meshes=JSON.parse(gunzipSync(bytes)).meshes;
const server=http.createServer((req,res)=>{
  const files={'/three.module.js':'node_modules/three/build/three.module.js','/three.core.js':'node_modules/three/build/three.core.js'};
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><title>Head registration diagnostic</title><body style="margin:0"></body></html>');}
  else if(files[req.url]){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(files[req.url]));}
  else{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const errors=[];
try{
  browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async ({meshes,counts,skinOnly,rms})=>{
    const T=await import('/three.module.js'),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(1440,1000);renderer.setClearColor('#10232c');renderer.setScissorTest(true);document.body.style.background='#10232c';document.body.append(renderer.domElement);
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,480/420,.001,10);
    scene.add(new T.AmbientLight(0xffffff,1.8));const light=new T.DirectionalLight(0xffffff,2);light.position.set(1,2,3);scene.add(light);
    for(const mesh of meshes){
      if(skinOnly?['skull','brain'].includes(mesh.kind):mesh.kind==='skin'||mesh.id==='initial-skull')continue;
      const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(mesh.positions),3));g.setIndex(mesh.indices);g.computeVertexNormals();
      const skull=mesh.kind==='skull'||mesh.kind==='skin',skin=mesh.kind==='target-skin';
      const m=new T.Mesh(g,new T.MeshStandardMaterial({color:skull?'#73c9e8':skin?'#b8b9b3':'#e7a1a5',
        transparent:true,opacity:skull?.27:skin?.08:1,depthWrite:!skull&&!skin,side:T.DoubleSide}));m.name=mesh.id;m.userData.kind=mesh.kind;scene.add(m);
      if(skull){const wire=new T.LineSegments(new T.EdgesGeometry(g,35),new T.LineBasicMaterial({color:'#9ae5ff',transparent:true,opacity:.35}));wire.name=mesh.id;wire.userData.kind=mesh.kind;scene.add(wire);}
    }
    const label=(text,x,y,size=17)=>{const p=document.createElement('div');p.textContent=text;p.style.cssText=`position:fixed;left:${x}px;top:${y}px;color:white;font:${size}px/1.5 sans-serif;background:#10232c;padding:8px`;document.body.append(p);};
    label(skinOnly?'피부 정합 비교 · 파랑: 변환한 원본 피부 / 회색: 현재 HRA 피부':'여성 머리 정합 후보 비교 · 분홍: 현재 HRA 뇌 / 파랑: 골격 / 회색: 현재 피부',18,8,20);
    const modes=[skinOnly?'initial':'current-borrowed','rigid','similarity'],names=[skinOnly?'초기 위치':'현재 보완 골격','새 원본: 회전·이동','새 원본: 회전·이동·균일 확대'];
    for(let col=0;col<3;col++){
      label(names[col],col*480+15,55);label(skinOnly?`맞춤 표본 RMS ${rms[col].toFixed(3)} mm`:`교차 증거가 있는 신경계 구조 ${counts[col]}개`,col*480+15,85,15);
      for(const o of scene.children)if(o.userData.kind===(skinOnly?'skin':'skull'))o.visible=o.name===(skinOnly?`${modes[col]}-skin`:col===0?modes[col]:`${modes[col]}-skull`);
      for(let row=0;row<2;row++){
        const target=new T.Vector3(-.002,1.55,-.055);camera.position.copy(target).add(row===0?new T.Vector3(0,0,.61):new T.Vector3(.61,0,0));camera.lookAt(target);
        renderer.setViewport(col*480,80+(1-row)*420,480,420);renderer.setScissor(col*480,80+(1-row)*420,480,420);renderer.render(scene,camera);
      }
    }
    label(skinOnly?'피부 최근접 표면 맞춤 · 검수한 해부 표지점 대응이 아님 · 두개골과 동일한 공통 변환':'후보는 해면뼈 경계만 포함 · 피질뼈 두께·아래턱·치아 제외 · 교차 개수는 임상 관통 깊이가 아님',18,927,16);
    label('피부 맞춤만으로 뇌·골격 관계가 개선되지 않아 적용 보류 · 실제 앱 화면이 아닌 별도 진단 장면',18,960,16);
  },{meshes,skinOnly,rms:[report.fits[1].sampleRmsMm[0],report.fits[1].finalRmsMm,report.fits[2].finalRmsMm],counts:['current-borrowed','rigid','similarity'].map(mode=>report.results.find(r=>r.mode===mode).crossings.length)});
  const path=`${folder}/${skinOnly?'skin-comparison':'comparison'}.png`;await page.screenshot({path});assert.deepEqual(errors,[]);
  fs.writeFileSync(`${folder}/${skinOnly?'capture-skin':'capture'}.json`,JSON.stringify({path,sha256:sha(fs.readFileSync(path)),inputSha256:report.visualization.sha256,errors,appMounted:false,skinOnly,modes:[skinOnly?'initial':'current-borrowed','rigid','similarity']},null,2)+'\n');
  console.log('Saved six-view head-fit comparison; page errors 0.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
