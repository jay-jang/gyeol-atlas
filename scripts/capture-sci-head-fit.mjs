import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
const folder='.cache/sci-head-fit',read=p=>JSON.parse(fs.readFileSync(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const report=read(`${folder}/report.json`);for(const f of report.files)assert.equal(sha(fs.readFileSync(f.path)),f.sha256);
const source=read('.cache/sci-head/shared-candidate.json'),binary=gunzipSync(fs.readFileSync(source.binary.path));
const atlas=read('public/models/female/atlas-female.json'),target=[];
for(const id of ['HRAF0003',...report.anchors.targetEyePartIds.flat()]){
  const p=atlas.parts.find(p=>p.id===id),b=gunzipSync(fs.readFileSync(`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').at(-1)}`));
  const positions=Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+i*4));
  let indices=Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+i*4));
  if(id==='HRAF0003'){
    const cropped=[];for(let i=0;i<indices.length;i+=3)if(indices.slice(i,i+3).every(v=>positions[v*3+1]>=1.4))cropped.push(...indices.slice(i,i+3));indices=cropped;
  }
  target.push({id,positions,indices});
}
const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><title>SCI placement diagnostic</title><body style="margin:0;background:#10232c"></body></html>');}
  else if(req.url==='/source.bin'){res.setHeader('Content-Type','application/octet-stream');res.end(binary);}
  else if(['/three.module.js','/three.core.js'].includes(req.url)){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(`node_modules/three/build${req.url}`));}
  else{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
try{
  browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1400,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async ({source,report,target})=>{
    const T=await import('/three.module.js'),bytes=await(await fetch('/source.bin')).arrayBuffer();
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1400,1000);renderer.setClearColor('#10232c');renderer.setScissorTest(true);document.body.append(renderer.domElement);
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,700/395,.001,10);
    scene.add(new T.AmbientLight(0xffffff,1.7));const light=new T.DirectionalLight(0xffffff,2);light.position.set(1,2,3);scene.add(light);
    const mesh=(g,color,opacity)=>{g.computeVertexNormals();return new T.Mesh(g,new T.MeshStandardMaterial({color,opacity,transparent:opacity<1,depthWrite:opacity===1,side:T.DoubleSide}));};
    for(const part of target){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(part.positions),3));g.setIndex(part.indices);scene.add(mesh(g,part.id==='HRAF0003'?'#cccccc':'#72f69a',part.id==='HRAF0003'?.10:1));}
    const groups=[];
    for(const fit of report.fits){
      const group=new T.Group();group.applyMatrix4(new T.Matrix4().fromArray(fit.matrix));
      for(const part of source.parts.filter(p=>['label-1','label-2','label-6'].includes(p.id))){
        const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(bytes,part.positions,part.vertexCount*3),3));g.setIndex(new T.BufferAttribute(new Uint32Array(bytes,part.indices,part.indexCount),1));
        group.add(mesh(g,part.id==='label-1'?'#68baf7':part.id==='label-2'?'#ed9da9':'#d8dbc7',part.id==='label-6'?.22:1));
      }
      scene.add(group);groups.push(group);
    }
    const label=(text,x,y,size=16)=>{const p=document.createElement('div');p.textContent=text;p.style.cssText=`position:fixed;left:${x}px;top:${y}px;color:white;font:${size}px/1.5 sans-serif;background:#10232c;padding:8px`;document.body.append(p);};
    label('SCI → 현재 여성 전신 배치 시험 · 피부 이탈과 기준점 차이로 두 후보 모두 미적용',18,8,20);
    label('분홍: SCI 라벨2 / 반투명 뼈색: SCI 라벨6 / 파랑: SCI 라벨1 / 초록: 현재 공막·각막 / 회색: 현재 피부',18,44,15);
    for(let col=0;col<2;col++){
      const r=report.results[col],bone=r.materials.find(p=>p.id==='label-6');
      label(col===0?'눈·머리 상단의 근사 기준점 맞춤':'그 뒤 피부 최근접 표면으로 보정',col*700+20,82,18);
      label(`눈 기준 차이 ${r.anchorResidualsMm.slice(0,2).map(v=>v.toFixed(2)).join(' / ')} mm · 뼈 피부 이탈 ${bone.counts.outside}정점`,col*700+20,113,15);
      groups.forEach((g,i)=>g.visible=i===col);
      for(let row=0;row<2;row++){
        const target=new T.Vector3(0,1.54,-.055);camera.position.copy(target).add(row===0?new T.Vector3(0,0,.64):new T.Vector3(.64,0,0));camera.lookAt(target);
        renderer.setViewport(col*700,70+(1-row)*395,700,395);renderer.setScissor(col*700,70+(1-row)*395,700,395);renderer.render(scene,camera);
      }
    }
    label('출처별 조직 범위가 다름 · 숫자 라벨의 이름은 잠정 해석 · 원본 전체에 동일한 공통 변환',18,926);
    label('신경 연결·전신 정합·임상 정확도 미검증 · 실제 앱이 아닌 별도 진단 화면',18,960);
  },{source,report,target});
  const path=`${folder}/comparison.png`;await page.screenshot({path});assert.deepEqual(errors,[]);
  fs.writeFileSync(`${folder}/capture.json`,JSON.stringify({path,sha256:sha(fs.readFileSync(path)),reportSha256:sha(fs.readFileSync(`${folder}/report.json`)),errors,appMounted:false},null,2)+'\n');
  console.log('SCI placement four-view capture saved; page errors 0.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
