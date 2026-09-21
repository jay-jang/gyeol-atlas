// Disposable browser comparison reconstructed from raw packed positions/normals.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const regPath='data/catalog/female-foot-registration.json',registration=JSON.parse(fs.readFileSync(regPath));
const atlasPath='public/models/female/atlas-female.json',atlas=JSON.parse(fs.readFileSync(atlasPath)),buffers=new Map();
assert.equal(hash(atlasPath),registration.sourceManifestSha256);
const parts=registration.records.map(record=>{
  const p=atlas.parts.find(p=>p.id===record.id),path=`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').pop()}`;
  if(!buffers.has(path))buffers.set(path,gunzipSync(fs.readFileSync(path)));
  const b=buffers.get(path);return {id:p.id,record,
    positions:Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),
    normals:Array.from({length:p.vertexCount*3},(_,i)=>Math.max(-1,b.readInt16LE(p.normals+2*i)/32767))};
});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],screenshots=[];let fiberUrl;
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.getByText('해부 모델 로드 완료').waitFor({timeout:90000});
  await page.goto('http://127.0.0.1:5174');await ready();
  await page.evaluate(()=>{
    const s=JSON.parse(sessionStorage.getItem('gyeol-view-v2'));
    Object.assign(s,{sex:'female',anatomyRegion:'whole',displayMode:'layers',selection:null,detail:null,comparison:null,isolated:false,cutaway:0});
    s.layers={skin:true,bone:true,muscle:false,organ:false,vessel:false,lymph:false,nerve:false};s.alpha.skin=.25;
    s.camera={position:[.145,.6,-.04],target:[.145,.048,-.04]};sessionStorage.setItem('gyeol-view-v2',JSON.stringify(s));
  });await page.reload();await ready();assert.ok(fiberUrl);
  for(const side of ['left','right'])for(const stage of ['before','after'])for(const view of ['top','side']){
    await page.evaluate(async({url,parts,side,stage,view})=>{
      const {_roots}=await import(url),state=_roots.get(document.querySelector('canvas')).store.getState();
      const {BufferAttribute,Matrix4}=await import('/node_modules/.vite/deps/three.js');
      for(const part of parts){
        const mesh=state.scene.getObjectByName(part.id);if(!mesh?.isMesh)throw Error(`Missing ${part.id}`);
        const g=mesh.geometry;g.setAttribute('position',new BufferAttribute(new Float32Array(part.positions),3));
        g.setAttribute('normal',new BufferAttribute(new Float32Array(part.normals),3));
        if(stage==='after'){
          const m=part.record.linear,t=part.record.translation;
          g.applyMatrix4(new Matrix4().set(m[0][0],m[1][0],m[2][0],t[0],m[0][1],m[1][1],m[2][1],t[1],m[0][2],m[1][2],m[2][2],t[2],0,0,0,1));
        }g.computeBoundingBox();g.computeBoundingSphere();
      }
      const sign=side==='left'?1:-1,x=.145*sign;
      state.camera.up.set(...(view==='top'?[0,0,-1]:[0,1,0]));state.camera.near=view==='top'?.45:.001;state.camera.updateProjectionMatrix();
      state.camera.position.set(...(view==='top'?[x,.6,-.04]:[x+.58*sign,.065,-.04]));
      state.controls.target.set(x,.048,-.04);state.controls.update();
      let banner=document.getElementById('toe-diagnostic');if(!banner){banner=document.createElement('div');banner.id='toe-diagnostic';document.body.append(banner);}
      banner.style.cssText='position:fixed;bottom:90px;left:410px;z-index:9999;background:white;color:black;padding:12px;font-size:16px';
      banner.textContent=`${side==='left'?'왼발':'오른발'} · ${view==='top'?'위 (관찰용 근위부 클립)':'옆'} · ${stage==='before'?'발가락 교정 전':'발가락 부분 교정 — 전체 정합 미완료'}`;
      state.invalidate();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    },{url:fiberUrl,parts,side,stage,view});
    const path=`.cache/foot-registration/forefoot-${side}-${stage}-${view}.png`;await page.screenshot({path});screenshots.push({path,sha256:hash(path)});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync('.cache/foot-registration/forefoot-captures.json',JSON.stringify({status:'LOCAL DIAGNOSTIC, not deployment verification',errors,screenshots,
    files:[regPath,atlasPath,'scripts/capture-forefoot-registration.mjs',...buffers.keys()].map(path=>({path,sha256:hash(path)}))},null,2)+'\n');
  console.log('Eight before/after toe views, browser errors 0.');
}finally{await browser.close();}
