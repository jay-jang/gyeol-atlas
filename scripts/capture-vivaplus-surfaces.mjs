// Source-only disposable diagnostic scene. Does not mount or mutate the app.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const folder='.cache/vivaplus';
const sha256=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const data=JSON.parse(fs.readFileSync(`${folder}/surfaces.json`));
assert.equal(sha256(`${folder}/surfaces.json`),JSON.parse(fs.readFileSync(`${folder}/surface-extraction.json`)).geometryFileSha256);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],screenshots=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__viva-preview__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><title>Source geometry diagnostic</title><body></body></html>'}));
  await page.goto('http://127.0.0.1:5174/__viva-preview__');
  await page.evaluate(async data=>{
    const T=await import('/node_modules/.vite/deps/three.js');
    const scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(1440,1000);renderer.setClearColor('#10232c');document.body.style.margin='0';
    document.body.append(renderer.domElement);
    const camera=new T.PerspectiveCamera(35,1.44,.01,20);
    scene.add(new T.AmbientLight(0xffffff,2));
    const light=new T.DirectionalLight(0xffffff,3);light.position.set(1,2,3);scene.add(light);
    for(const mesh of data.meshes){
      if(mesh.name.endsWith('-null'))continue; // Alternate computational surfaces, not extra bones.
      const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(mesh.positions),3));
      g.setIndex(new T.BufferAttribute(new Uint32Array(mesh.indices),1));g.computeVertexNormals();
      const skin=mesh.name==='skin',muscle=mesh.name==='subscapularis';
      const m=new T.MeshStandardMaterial({color:skin?'#cf9278':muscle?'#b95c67':'#eee2c5',side:T.DoubleSide,
        transparent:skin,opacity:skin?.22:1,depthWrite:!skin});
      const object=new T.Mesh(g,m);object.name=mesh.id;scene.add(object);
    }
    const title=document.createElement('div');title.style.cssText='position:fixed;top:20px;left:30px;color:white;background:#10232c;padding:12px;font:18px sans-serif';
    title.textContent='여성 상지 원본의 유한요소 경계면 — HRA 정합·배포 없음 / 근육 전체 자료 아님';document.body.append(title);
    window.preview={scene,renderer,camera,title};
  },data);
  const views=[
    {name:'front',position:[0,1.03,1.8],target:[0,1.03,0],skin:true},
    {name:'left-hand',position:[.43,.79,.5],target:[.41,.79,.04],skin:true},
    {name:'left-hand-bones',position:[.43,.79,.5],target:[.41,.79,.04],skin:false},
    {name:'left-elbow',position:[.27,1.045,.38],target:[.27,1.045,-.015],skin:false},
    {name:'left-shoulder',position:[.15,1.3,.38],target:[.12,1.3,-.04],skin:false},
  ];
  for(const view of views){
    await page.evaluate(async view=>{
      const {scene,renderer,camera}=window.preview;
      for(const object of scene.children)if(object.name.endsWith('-skin'))object.visible=view.skin;
      camera.position.set(...view.position);camera.lookAt(...view.target);
      await new Promise(r=>requestAnimationFrame(r));renderer.render(scene,camera);
    },view);
    const path=`${folder}/source-${view.name}.png`;await page.screenshot({path});screenshots.push({...view,path,sha256:sha256(path)});
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(`${folder}/captures.json`,JSON.stringify({geometrySha256:sha256(`${folder}/surfaces.json`),screenshots,errors,appMounted:false},null,2)+'\n');
  console.log(`Captured ${screenshots.length} source-only views; browser errors 0.`);
}finally{await browser.close();}
