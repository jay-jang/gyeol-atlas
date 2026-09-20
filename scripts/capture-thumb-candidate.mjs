// Disposable local comparison; restores the fixed v1 baseline before applying
// the candidate, so it remains reproducible after future runtime changes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
const candidatePath='.cache/arm-registration/thumb-clearance-candidate.json';
const candidate=JSON.parse(fs.readFileSync(candidatePath));
const baselinePath='docs/anatomy-alignment/female-arm-registration-v1.json',baseline=JSON.parse(fs.readFileSync(baselinePath));
const atlasPath='public/models/female/atlas-female.json',atlas=JSON.parse(fs.readFileSync(atlasPath)),buffers=new Map();
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const f of candidate.files)assert.equal(hash(f.path),f.sha256,f.path);
const parts=candidate.hands.flatMap(h=>h.records).map(r=>{
  const p=atlas.parts.find(p=>p.id===r.id),path=`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').pop()}`;
  if(!buffers.has(path))buffers.set(path,gunzipSync(fs.readFileSync(path)));
  const b=buffers.get(path);return {id:p.id,baseline:baseline.records.find(r=>r.id===p.id),
    positions:Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+i*4)),
    normals:Array.from({length:p.vertexCount*3},(_,i)=>b.readInt16LE(p.normals+i*2))};
});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],screenshots=[];let fiberUrl;
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.getByText('해부 모델 로드 완료').waitFor({timeout:90000});
  await page.goto('http://127.0.0.1:5174');await ready();
  await page.evaluate(()=>{
    const s=JSON.parse(sessionStorage.getItem('gyeol-view-v2'));
    Object.assign(s,{sex:'female',anatomyRegion:'whole',displayMode:'layers',selection:null,detail:null,comparison:null,isolated:false,cutaway:0});
    s.layers={skin:true,bone:true,muscle:false,organ:false,vessel:false,lymph:false,nerve:false};s.alpha.skin=.25;
    s.camera={position:[.43,.84,.42],target:[.43,.84,-.015]};sessionStorage.setItem('gyeol-view-v2',JSON.stringify(s));
  });
  await page.reload();await ready();assert.ok(fiberUrl);
  for(const stage of ['before','after'])for(const side of ['left','right']){
    await page.evaluate(async({url,parts,hands,stage,side})=>{
      const {_roots}=await import(url),state=_roots.get(document.querySelector('canvas')).store.getState();
      const {BufferAttribute,Int16BufferAttribute,Matrix4}=await import('/node_modules/.vite/deps/three.js');
      for(const part of parts){
        const mesh=state.scene.getObjectByName(part.id);if(!mesh?.isMesh)throw new Error(`Missing ${part.id}`);
        const source=stage==='before'?part.baseline:hands.flatMap(h=>h.records).find(r=>r.id===part.id),m=source.linear,t=source.translation;
        const normal=new Int16BufferAttribute(new Int16Array(part.normals),3,true),values=new Float32Array(part.normals.length);
        for(let i=0;i<normal.count;i++)values.set([normal.getX(i),normal.getY(i),normal.getZ(i)],i*3);
        mesh.geometry.setAttribute('position',new BufferAttribute(new Float32Array(part.positions),3));
        mesh.geometry.setAttribute('normal',new BufferAttribute(values,3));
        mesh.geometry.applyMatrix4(new Matrix4().set(m[0][0],m[1][0],m[2][0],t[0],m[0][1],m[1][1],m[2][1],t[1],m[0][2],m[1][2],m[2][2],t[2],0,0,0,1));
        mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
      }
      const x=side==='left'?.43:-.43;state.camera.position.set(x,.84,.42);state.controls.target.set(x,.84,-.015);state.controls.update();
      let banner=document.getElementById('thumb-diagnostic');if(!banner){banner=document.createElement('div');banner.id='thumb-diagnostic';document.body.append(banner);}
      banner.style.cssText='position:fixed;top:80px;left:420px;z-index:9999;background:white;color:black;padding:12px;font-size:16px';
      banner.textContent=stage==='before'?'엄지 교정 전 — 팔 부분 교정 v1 기준':'엄지 부분 교정 후보 — 피부·관절 정합 전체 검증 아님';
      state.invalidate();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    },{url:fiberUrl,parts,hands:candidate.hands,stage,side});
    const path=`.cache/arm-registration/thumb-${stage}-${side}.png`;await page.screenshot({path});screenshots.push({path,sha256:hash(path)});
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync('.cache/arm-registration/thumb-captures.json',JSON.stringify({status:'Local disposable diagnostic, not deployment verification',screenshots,errors,
    files:[candidatePath,baselinePath,atlasPath,'scripts/capture-thumb-candidate.mjs',...buffers.keys()].map(path=>({path,sha256:hash(path)}))},null,2)+'\n');
  console.log('Four thumb comparison captures; browser errors 0.');
} finally {await browser.close();}
