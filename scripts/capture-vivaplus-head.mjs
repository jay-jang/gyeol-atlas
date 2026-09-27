// Disposable source-only scene; not the app and not a complete anatomical head.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const folder='.cache/vivaplus-head';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const data=JSON.parse(fs.readFileSync(`${folder}/consistent-surfaces.json`));
assert.equal(sha(`${folder}/consistent-surfaces.json`),JSON.parse(fs.readFileSync(`${folder}/consistent-extraction.json`)).geometrySha256);
const selected=data.meshes.filter(m=>['skull-trabecular-union','head-skin-union'].includes(m.id));
assert.equal(selected.length,2);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],screenshots=[];
try{
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__viva-head-preview__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><title>VIVA+ source boundary diagnostic</title><body></body></html>'}));
  await page.goto('http://127.0.0.1:5174/__viva-head-preview__');
  await page.evaluate(async meshes=>{
    const T=await import('/node_modules/.vite/deps/three.js');
    const scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(1200,900);renderer.setClearColor('#10232c');document.body.style.margin='0';document.body.append(renderer.domElement);
    const camera=new T.PerspectiveCamera(35,1200/900,.001,10);
    scene.add(new T.AmbientLight(0xffffff,2));
    const light=new T.DirectionalLight(0xffffff,3);light.position.set(1,2,3);scene.add(light);
    for(const mesh of meshes){
      const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(mesh.positions),3));
      g.setIndex(new T.BufferAttribute(new Uint32Array(mesh.indices),1));g.computeVertexNormals();
      const skin=mesh.id==='head-skin-union';
      const material=new T.MeshStandardMaterial({color:skin?'#ce9278':'#eee2c5',side:T.DoubleSide,transparent:skin,opacity:skin?.16:1,depthWrite:!skin});
      const object=new T.Mesh(g,material);object.name=mesh.id;scene.add(object);
    }
    const title=document.createElement('div');
    title.style.cssText='position:fixed;top:20px;left:24px;color:white;background:#10232c;padding:12px;font:18px/1.7 sans-serif';
    title.textContent='VIVA+ 50F-standing v2.0.2 · 원본 두개골 해면뼈 경계 + 피부 참조면';document.body.append(title);
    const note=document.createElement('div');
    note.style.cssText='position:fixed;bottom:20px;left:24px;color:white;background:#10232c;padding:12px;font:16px/1.7 sans-serif';
    note.textContent='뇌·아래턱·치아 미표시 / 피질뼈 두께 미구현 / HRA 정합·앱 적용 없음';document.body.append(note);
    window.preview={scene,renderer,camera};
  },selected);
  for(const view of [
    {name:'front',position:[0,1.50,.62],target:[0,1.50,.015]},
    {name:'side',position:[.60,1.50,.025],target:[0,1.50,.025]},
  ]){
    await page.evaluate(async view=>{
      const {scene,renderer,camera}=window.preview;camera.position.set(...view.position);camera.lookAt(...view.target);
      await new Promise(r=>requestAnimationFrame(r));renderer.render(scene,camera);
    },view);
    const path=`${folder}/source-${view.name}.png`;await page.screenshot({path});screenshots.push({...view,path,sha256:sha(path)});
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(`${folder}/captures.json`,JSON.stringify({geometrySha256:sha(`${folder}/consistent-surfaces.json`),displayedGroupIds:selected.map(m=>m.id),screenshots,errors,appMounted:false},null,2)+'\n');
  console.log('Captured two source-only views; page errors 0.');
}finally{await browser.close();}
