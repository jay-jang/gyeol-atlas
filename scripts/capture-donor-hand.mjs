// Read-only source diagnostic. Geometry exists only in a disposable browser.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
const atlas=JSON.parse(fs.readFileSync('.cache/male-details/atlas.json'));
const candidate=JSON.parse(fs.readFileSync('.cache/arm-registration/hand-candidates.json'));
for(const file of candidate.files)assert.equal(createHash('sha256').update(fs.readFileSync(file.path)).digest('hex'),file.sha256);
const ids=new Set(candidate.arms.flatMap(a=>a.parts).filter(p=>p.transformed).map(p=>p.sourceId));
const buffers=new Map();
const parts=atlas.parts.filter(p=>ids.has(p.id)||p.name==='Skin').map(p=>{
  if(!buffers.has(p.chunk))buffers.set(p.chunk,gunzipSync(fs.readFileSync(`.cache/arm-registration/${atlas.chunks[p.chunk].gzip.split('/').pop()}`)));
  const bytes=buffers.get(p.chunk);
  return {id:p.id,name:p.name,positions:Array.from({length:p.vertexCount*3},(_,i)=>bytes.readFloatLE(p.positions+4*i)),
    indices:Array.from({length:p.indexCount},(_,i)=>bytes.readUInt32LE(p.indices+4*i))};
});
assert.equal(parts.length,55);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});let fiberUrl;const errors=[];
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5174');
  await page.getByText('해부 모델 로드 완료').waitFor({timeout:90000});
  assert.ok(fiberUrl);
  await page.evaluate(async ({url,parts})=>{
    const {_roots}=await import(url),state=_roots.get(document.querySelector('canvas')).store.getState();
    const {BufferGeometry,BufferAttribute,Mesh,MeshStandardMaterial,DoubleSide,Scene,AmbientLight,DirectionalLight,WebGLRenderer,PerspectiveCamera}=await import('/node_modules/.vite/deps/three.js');
    state.setFrameloop('never');
    // A dedicated canvas prevents a pending app frame from contaminating evidence.
    document.body.replaceChildren();document.body.style.margin='0';
    const renderer=new WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(1440,900);renderer.setClearColor('#071820');document.body.append(renderer.domElement);
    const camera=new PerspectiveCamera(35,1440/900,.01,10);
    const diagnostic=new Scene();diagnostic.add(new AmbientLight(0xffffff,2));
    const light=new DirectionalLight(0xffffff,3);light.position.set(1,2,3);diagnostic.add(light);
    for(const part of parts){
      const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(part.positions),3));
      g.setIndex(new BufferAttribute(new Uint32Array(part.indices),1));g.computeVertexNormals();
      const skin=part.name==='Skin';
      const m=new MeshStandardMaterial({color:skin?'#edbba1':'#eeeecc',transparent:skin,opacity:skin?.28:1,side:DoubleSide,depthWrite:!skin});
      const mesh=new Mesh(g,m);mesh.name=`diagnostic-${part.id}`;diagnostic.add(mesh);
    }
    camera.position.set(.27,.82,.65);camera.lookAt(.27,.82,.015);
    window.donorDiagnostic={scene:diagnostic,renderer,camera};
    const banner=document.createElement('div');banner.textContent='원본 BP4 남성 손 — 위치 변환 없음 / 진단 전용';
    banner.style.cssText='position:fixed;left:330px;top:80px;z-index:9999;background:white;color:black;padding:12px;font-size:16px';document.body.append(banner);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    renderer.render(diagnostic,camera);
  },{url:fiberUrl,parts});
  await page.screenshot({path:'.cache/arm-registration/donor-hand-front.png'});
  await page.evaluate(async ()=>{
    const {scene,renderer,camera}=window.donorDiagnostic;
    camera.position.set(.7,.85,.25);camera.lookAt(.27,.82,.015);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    renderer.render(scene,camera);
  });
  await page.screenshot({path:'.cache/arm-registration/donor-hand-oblique.png'});
  assert.deepEqual(errors,[]);console.log('Captured untransformed donor skin and 54 hand bones; browser errors 0.');
} finally {await browser.close();}
