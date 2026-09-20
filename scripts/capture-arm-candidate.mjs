// Changes only this disposable browser scene, never app geometry or sources.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
const handOnly=process.argv.includes('--hand');
const comparison=process.argv.find(arg=>arg.startsWith('--comparison='))?.split('=')[1];
assert.ok(!comparison||['area-upper','joint-upper','joint-area-upper','free-upper','hand-clearance'].includes(comparison),'Unknown comparison');
assert.ok(!comparison||!process.argv.some(arg=>['--hand','--articulated','--upper-existing','--coupled-hand'].includes(arg)),'Comparison modes cannot be combined with legacy modes');
const articulated=Boolean(comparison)||process.argv.includes('--articulated');
assert.ok(!(handOnly&&articulated),'Choose one experiment');
assert.ok(!process.argv.includes('--upper-existing')||articulated,'Upper-length mode requires articulated experiment');
assert.ok(!process.argv.includes('--coupled-hand')||(articulated&&process.argv.includes('--upper-existing')),'Coupled hand requires articulated existing-upper mode');
const prefix=comparison?`${comparison}-`:articulated?(process.argv.includes('--coupled-hand')?'articulated-coupled-hand-':process.argv.includes('--upper-existing')?'articulated-existing-upper-':'articulated-'):handOnly?'hand-':'';
const candidatePath=`.cache/arm-registration/${prefix}candidates.json`;
const candidate=JSON.parse(fs.readFileSync(candidatePath));
for(const file of candidate.files)assert.equal(createHash('sha256').update(fs.readFileSync(file.path)).digest('hex'),file.sha256);
const atlasPath='public/models/female/atlas-female.json',atlas=JSON.parse(fs.readFileSync(atlasPath)),buffers=new Map();
const rawParts=candidate.arms.flatMap(a=>a.parts).map(row=>{
  const p=atlas.parts.find(p=>p.id===row.id);assert.ok(p);
  const path=`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').pop()}`;
  if(!buffers.has(path))buffers.set(path,gunzipSync(fs.readFileSync(path)));
  const data=buffers.get(path);
  return {id:p.id,positions:Array.from({length:p.vertexCount*3},(_,i)=>data.readFloatLE(p.positions+i*4)),
    normals:Array.from({length:p.vertexCount*3},(_,i)=>data.readInt16LE(p.normals+i*2))};
});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  let fiberUrl;const errors=[];
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5174');
  const ready=()=>page.getByText('해부 모델 로드 완료').waitFor({timeout:90000});
  await ready();
  await page.evaluate(()=>{
    const s=JSON.parse(sessionStorage.getItem('gyeol-view-v2'));
    s.sex='female';
    s.layers={skin:true,muscle:false,bone:true,organ:false,vessel:false,lymph:false,nerve:false};
    s.displayMode='layers';s.alpha.skin=.28;
    s.selection=null;s.detail=null;s.comparison=null;s.isolated=false;s.cutaway=0;
    s.camera={position:[-.35,1.03,1.15],target:[-.35,1.03,-.09]};
    sessionStorage.setItem('gyeol-view-v2',JSON.stringify(s));
  });
  await page.reload();await ready();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.visibleBone==='321');
  assert.ok(fiberUrl,'Use the local development server only');
  // The app now has a partial registration. Explicitly restore the pinned raw
  // baseline in this disposable scene before comparing another candidate, so
  // its correction is never accidentally applied twice.
  await page.evaluate(async({url,rawParts})=>{
    const {_roots}=await import(url),state=_roots.get(document.querySelector('canvas')).store.getState();
    const {BufferAttribute,Int16BufferAttribute}=await import('/node_modules/.vite/deps/three.js');
    for(const part of rawParts){
      const mesh=state.scene.getObjectByName(part.id);if(!mesh?.isMesh)throw new Error(`Missing ${part.id}`);
      mesh.geometry.setAttribute('position',new BufferAttribute(new Float32Array(part.positions),3));
      mesh.geometry.setAttribute('normal',new Int16BufferAttribute(new Int16Array(part.normals),3,true));
      delete mesh.geometry.userData.femaleArmRegistration;
      mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
      mesh.userData.bounds=[mesh.geometry.boundingBox.min.toArray(),mesh.geometry.boundingBox.max.toArray()];
    }
    state.invalidate();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  },{url:fiberUrl,rawParts});
  const banner=async text=>page.evaluate(text=>{
    let el=document.getElementById('experiment-banner');
    if(!el){el=document.createElement('div');el.id='experiment-banner';document.body.append(el);}
    el.style.cssText='position:fixed;left:330px;top:80px;z-index:9999;background:#fff;color:#111;padding:12px;font-size:16px';
    el.textContent=text;
  },text);
  await banner('교정 전 — 고정 원본 좌표 / 실험용 관찰 화면');
  await page.screenshot({path:`.cache/arm-registration/${prefix}before.png`});
  const transformed=await page.evaluate(async ({url,arms})=>{
    const { _roots }=await import(url),state=_roots.get(document.querySelector('canvas')).store.getState();
    const count=[];
    for(const arm of arms)for(const part of arm.parts.filter(p=>p.transformed)){
      const mesh=state.scene.getObjectByName(part.id);
      if(!mesh?.isMesh)throw new Error(`Missing candidate mesh ${part.id}`);
      if(!mesh.matrix.equals(mesh.matrix.clone().identity()))throw new Error('Expected identity packed mesh placement');
      const m=part.linear||arm.linear,t=part.translation||arm.translation;
      const matrix=mesh.matrix.clone().set(m[0][0],m[1][0],m[2][0],t[0],m[0][1],m[1][1],m[2][1],t[1],m[0][2],m[1][2],m[2][2],t[2],0,0,0,1);
      mesh.applyMatrix4(matrix);count.push(part.id);
    }
    state.scene.updateMatrixWorld(true);state.invalidate();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return count;
  },{url:fiberUrl,arms:candidate.arms});
  assert.equal(new Set(transformed).size,handOnly?54:60);
  await banner(comparison==='hand-clearance'?'팔·손 부분 교정 — 손가락 등 정렬 미완료 / 진단 화면':'미채택 교정 후보 — 실험 전용 / 공개 모델에 적용하지 않음');
  await page.screenshot({path:`.cache/arm-registration/${prefix}after.png`});
  if(articulated){
    await page.evaluate(async url=>{
      const {_roots}=await import(url),state=_roots.get(document.querySelector('canvas')).store.getState();
      state.camera.position.set(.35,1.03,1.15);state.controls.target.set(.35,1.03,-.09);state.controls.update();state.invalidate();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    },fiberUrl);
    await page.screenshot({path:`.cache/arm-registration/${prefix}after-left.png`});
  }
  assert.deepEqual(errors,[]);
  const hash=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  const screenshots=['before','after',...(articulated?['after-left']:[])].map(view=>{
    const path=`.cache/arm-registration/${prefix}${view}.png`;return {view,path,sha256:hash(path)};
  });
  fs.writeFileSync(`.cache/arm-registration/${prefix}captures.json`,JSON.stringify({status:'Disposable local comparison against pinned raw geometry; not proof of deployment',
    baselineRestoredFromSourceIds:rawParts.map(p=>p.id),
    transformedIds:transformed,errors,screenshots,
    files:[candidatePath,'scripts/capture-arm-candidate.mjs',atlasPath,...buffers.keys()].map(path=>({path,sha256:hash(path)}))},null,2)+'\n');
  console.log(`Captured restored raw baseline and ${transformed.length}-bone candidate in disposable local scene; browser errors 0.`);
} finally {await browser.close();}
