// Diagnostic-only rendering of current packed coordinates; never writes anatomy.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const out='.cache/donor-muscle',atlasPath='public/models/female/atlas-female.json';
const hash=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const audit=JSON.parse(fs.readFileSync(`${out}/relations.json`));
for(const f of audit.files)assert.equal(hash(f.path),f.sha256,f.path);
const atlas=JSON.parse(fs.readFileSync(atlasPath)),buffers=new Map();
const parts=atlas.parts.filter(p=>p.id==='HRAF0003'||/^(Femur|Tibia|Fibula|Gastrocnemius medial|Gastrocnemius lateral|Soleus) \(/.test(p.name)).map(p=>{
  const path=`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').pop()}`;
  if(!buffers.has(path))buffers.set(path,gunzipSync(fs.readFileSync(path)));
  const b=buffers.get(path);return {id:p.id,name:p.name,
    positions:Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),
    indices:Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i))};
});assert.equal(parts.length,13);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],captures=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});let fiberUrl;
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5174');await page.getByText('해부 모델 로드 완료').waitFor({timeout:90000});assert.ok(fiberUrl);
  await page.evaluate(async({url,parts})=>{
    const {_roots}=await import(url);_roots.get(document.querySelector('canvas')).store.getState().setFrameloop('never');
    const {Scene,Mesh,MeshStandardMaterial,BufferGeometry,BufferAttribute,DoubleSide,AmbientLight,DirectionalLight,WebGLRenderer,PerspectiveCamera}=await import('/node_modules/.vite/deps/three.js');
    document.body.replaceChildren();
    document.querySelectorAll('style,link[rel="stylesheet"]').forEach(el=>el.remove());
    document.body.style.margin='0';
    const renderer=new WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,900);renderer.setClearColor('#071820');document.body.append(renderer.domElement);
    const scene=new Scene(),camera=new PerspectiveCamera(35,1440/900,.001,10);scene.add(new AmbientLight(0xffffff,2));
    const light=new DirectionalLight(0xffffff,2);light.position.set(1,2,-3);scene.add(light);
    for(const p of parts){
      const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(p.positions),3));g.setIndex(new BufferAttribute(new Uint32Array(p.indices),1));g.computeVertexNormals();
      const skin=p.name==='Skin',color=skin?'#eac4a7':p.name.startsWith('Gastrocnemius medial')?'#4bbcff':p.name.startsWith('Gastrocnemius lateral')?'#61dc92':p.name.startsWith('Soleus')?'#ee9455':'#eeeecc';
      const m=new Mesh(g,new MeshStandardMaterial({color,side:DoubleSide,transparent:skin,opacity:skin?.14:1,depthWrite:!skin}));m.name=p.name;m.userData.id=p.id;scene.add(m);
    }
    const banner=document.createElement('div');banner.style.cssText='position:fixed;left:30px;top:20px;background:white;color:black;padding:14px;font:18px sans-serif;line-height:1.6';document.body.append(banner);
    window.calfDiagnostic={scene,camera,renderer,banner};
  },{url:fiberUrl,parts});
  for(const side of ['left','right'])for(const view of ['posterior','medial']){
    const ids=await page.evaluate(async({side,view})=>{
      const {scene,camera,renderer,banner}=window.calfDiagnostic,sign=side==='left'?1:-1,x=.13*sign;
      for(const m of scene.children)if(m.isMesh)m.visible=m.name==='Skin'||m.name.endsWith(`(${side})`);
      // Camera near-plane clips nothing in the area of interest. The full skin
      // remains present; the frame intentionally shows only one lower leg.
      camera.position.set(...(view==='posterior'?[x,.3,-1.1]:[x-.95*sign,.3,-.18]));camera.lookAt(x,.29,-.08);
      banner.textContent=`${side==='left'?'왼쪽':'오른쪽'} 종아리 · ${view==='posterior'?'뒤':'안쪽'} · 현재 위치 진단 (교정 아님)\n파랑: 안쪽 장딴지근 / 초록: 바깥쪽 장딴지근 / 주황: 가자미근 / 흰색: 뼈`;
      banner.style.whiteSpace='pre-line';await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));renderer.render(scene,camera);
      return scene.children.filter(m=>m.isMesh&&m.visible).map(m=>m.userData.id);
    },{side,view});
    // Save the renderer's own image, not the browser compositor. The latter
    // produced a duplicate white banner rectangle below the model in this setup.
    // Captions and the color key belong to the metadata/document, not this PNG.
    const path=`${out}/calf-${side}-${view}.png`;
    const png=await page.evaluate(()=>window.calfDiagnostic.renderer.domElement.toDataURL('image/png').split(',')[1]);
    fs.writeFileSync(path,Buffer.from(png,'base64'));captures.push({side,view,path,sha256:hash(path),ids});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/captures.json`,JSON.stringify({status:'LOCAL DIAGNOSTIC; recolored and restricted to three calf muscles and three native bones per side plus whole skin; source coordinates unchanged',captureMethod:'WebGL canvas toDataURL; not a screenshot of app UI',colorKey:{medialGastrocnemius:'#4bbcff',lateralGastrocnemius:'#61dc92',soleus:'#ee9455',bone:'#eeeecc',skin:'#eac4a7'},errors,captures,
    files:[atlasPath,'scripts/capture-donor-calf.mjs',...buffers.keys()].map(path=>({path,sha256:hash(path)}))},null,2)+'\n');
  console.log('Four current-calf diagnostic views, no browser errors.');
}finally{await browser.close();}
