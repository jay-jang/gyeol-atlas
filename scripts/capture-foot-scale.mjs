// Isolated browser-only visualization of rejected/unapproved scale hypotheses.
// No model, registration, or application state outside this browser is changed.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const auditPath='.cache/foot-registration/scale-audit.json';
const audit=JSON.parse(fs.readFileSync(auditPath));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const f of audit.files)assert.equal(hash(f.path),f.sha256,f.path);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],screenshots=[];let fiberUrl;
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.getByText('해부 모델 로드 완료').waitFor({timeout:90000});
  await page.goto('http://127.0.0.1:5174');await ready();
  await page.evaluate(()=>{
    const s=JSON.parse(sessionStorage.getItem('gyeol-view-v2'));
    Object.assign(s,{sex:'female',anatomyRegion:'whole',displayMode:'layers',selection:null,detail:null,comparison:null,isolated:false,cutaway:0});
    s.layers={skin:true,bone:true,muscle:false,organ:false,vessel:false,lymph:false,nerve:false};s.alpha.skin=.25;
    s.camera={position:[.14,.5,-.03],target:[.14,.04,-.03]};sessionStorage.setItem('gyeol-view-v2',JSON.stringify(s));
  });
  await page.reload();await ready();assert.ok(fiberUrl);
  for(const foot of audit.feet)for(const stage of ['current','undo-reach'])for(const view of ['top','side']){
    const scenario=foot.scenarios.find(s=>s.name===stage);
    await page.evaluate(async({url,feet,foot,scenario,view})=>{
      const {_roots}=await import(url),state=_roots.get(document.querySelector('canvas')).store.getState();
      const {Vector3}=await import('/node_modules/.vite/deps/three.js');
      // Save exact runtime positions once, and reset BOTH feet for every capture.
      for(const f of feet)for(const part of f.scenarios[0].parts){
        const mesh=state.scene.getObjectByName(part.id);if(!mesh?.isMesh)throw new Error(`Missing ${part.id}`);
        const g=mesh.geometry,pos=g.attributes.position;
        if(!g.userData.footAuditOriginal)g.userData.footAuditOriginal=pos.array.slice();
        pos.array.set(g.userData.footAuditOriginal);
        if(f.side===foot.side)for(let i=0;i<pos.count;i++){
          const p=new Vector3().fromBufferAttribute(pos,i).sub(new Vector3(...foot.pivot)).multiplyScalar(scenario.scale).add(new Vector3(...foot.pivot));
          pos.setXYZ(i,p.x,p.y,p.z);
        }
        pos.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();
      }
      const sign=foot.side==='left'?1:-1,x=.145*sign,target=[x,.048,-.04];
      state.camera.up.set(...(view==='top'?[0,0,-1]:[0,1,0]));
      // A documented diagnostic near-plane removes the overlying knee in the
      // top view. It is not a tissue section or a changed application default.
      state.camera.near=view==='top'?.45:.001;state.camera.updateProjectionMatrix();
      state.camera.position.set(...(view==='top'?[x,.6,-.04]:[x+.58*sign,.065,-.04]));
      state.controls.target.set(...target);state.controls.update();
      let banner=document.getElementById('foot-diagnostic');if(!banner){banner=document.createElement('div');banner.id='foot-diagnostic';document.body.append(banner);}
      banner.style.cssText='position:fixed;bottom:80px;left:410px;z-index:9999;background:white;color:black;padding:12px;font-size:16px';
      banner.textContent=`${foot.side==='left'?'왼발':'오른발'} · ${view==='top'?'위 (관찰용 근위부 클립)':'옆'} · ${scenario.name==='current'?'현재 좌표':'축소 가설 (미적용·해부 정합 미검증)'}`;
      state.invalidate();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    },{url:fiberUrl,feet:audit.feet,foot,scenario,view});
    const path=`.cache/foot-registration/${foot.side}-${stage}-${view}.png`;
    await page.screenshot({path});screenshots.push({side:foot.side,stage,view,path,sha256:hash(path)});
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync('.cache/foot-registration/captures.json',JSON.stringify({status:'LOCAL DISPOSABLE DIAGNOSTIC; not deployed',errors,screenshots,
    files:[auditPath,'scripts/capture-foot-scale.mjs'].map(path=>({path,sha256:hash(path)}))},null,2)+'\n');
  console.log('Eight local foot diagnostic screenshots; browser errors 0.');
}finally{await browser.close();}
