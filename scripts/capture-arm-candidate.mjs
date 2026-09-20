// Changes only this disposable browser scene, never app geometry or sources.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const handOnly=process.argv.includes('--hand');
const candidate=JSON.parse(fs.readFileSync(handOnly?'.cache/arm-registration/hand-candidates.json':'.cache/arm-registration/candidates.json'));
for(const file of candidate.files)assert.equal(createHash('sha256').update(fs.readFileSync(file.path)).digest('hex'),file.sha256);
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
    s.camera={position:[-.35,1.03,.9],target:[-.35,1.03,-.09]};
    sessionStorage.setItem('gyeol-view-v2',JSON.stringify(s));
  });
  await page.reload();await ready();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.visibleBone==='321');
  assert.ok(fiberUrl,'Use the local development server only');
  const banner=async text=>page.evaluate(text=>{
    let el=document.getElementById('experiment-banner');
    if(!el){el=document.createElement('div');el.id='experiment-banner';document.body.append(el);}
    el.style.cssText='position:fixed;left:330px;top:80px;z-index:9999;background:#fff;color:#111;padding:12px;font-size:16px';
    el.textContent=text;
  },text);
  await banner('교정 전 — 현재 원본 / 실험용 관찰 화면');
  await page.screenshot({path:`.cache/arm-registration/${handOnly?'hand-':''}before.png`});
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
  await banner('미채택 교정 후보 — 실험 전용 / 공개 모델에 적용하지 않음');
  await page.screenshot({path:`.cache/arm-registration/${handOnly?'hand-':''}after.png`});
  assert.deepEqual(errors,[]);
  console.log(`Captured unchanged baseline and rejected ${transformed.length}-bone candidate in disposable local scene; browser errors 0.`);
} finally {await browser.close();}
