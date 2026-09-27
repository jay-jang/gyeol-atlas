// Before/after diagnostic only: private browser geometry, fixed cameras.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const path='.cache/finger-chains/candidate.json',candidate=JSON.parse(fs.readFileSync(path));
for(const f of candidate.files)assert.equal(hash(f.path),f.sha256,f.path);
const baseline=candidate.baselineRegistration;
const atlas=JSON.parse(fs.readFileSync('public/models/female/atlas-female.json')),buffers=new Map();
const parts=candidate.combined.records.map(record=>{
  const p=atlas.parts.find(p=>p.id===record.id),file=`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').pop()}`;
  if(!buffers.has(file))buffers.set(file,gunzipSync(fs.readFileSync(file)));const b=buffers.get(file);
  return {id:p.id,before:baseline.records.find(r=>r.id===p.id),after:record,
    positions:Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),
    normals:Array.from({length:p.vertexCount*3},(_,i)=>b.readInt16LE(p.normals+2*i))};
});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],screenshots=[];let fiber;
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiber=r.url();});page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.getByText('해부 모델 로드 완료').waitFor({timeout:120000});
  await page.goto('http://127.0.0.1:5174');await ready();
  await page.evaluate(()=>{
    const s=JSON.parse(sessionStorage.getItem('gyeol-view-v2'));
    Object.assign(s,{sex:'female',anatomyRegion:'whole',displayMode:'layers',selection:null,detail:null,comparison:null,isolated:false,cutaway:0});
    s.layers={skin:true,bone:true,muscle:false,organ:false,vessel:false,lymph:false,nerve:false};s.alpha.skin=.2;
    s.camera={position:[.43,.84,.4],target:[.43,.84,-.015]};sessionStorage.setItem('gyeol-view-v2',JSON.stringify(s));
  });
  await page.reload();await ready();assert.ok(fiber);
  for(const side of ['left','right'])for(const view of ['front','back'])for(const stage of ['before','after']){
    await page.evaluate(async({fiber,parts,side,view,stage})=>{
      const {_roots}=await import(fiber),s=_roots.get(document.querySelector('canvas')).store.getState();
      const {BufferAttribute,Int16BufferAttribute,Matrix4}=await import('/node_modules/.vite/deps/three.js');
      for(const p of parts){
        const mesh=s.scene.getObjectByName(p.id);if(!mesh?.isMesh)throw new Error(p.id);
        const r=p[stage],m=r.linear,t=r.translation,normals=new Int16BufferAttribute(new Int16Array(p.normals),3,true),values=new Float32Array(p.normals.length);
        for(let i=0;i<normals.count;i++)values.set([normals.getX(i),normals.getY(i),normals.getZ(i)],i*3);
        mesh.geometry.setAttribute('position',new BufferAttribute(new Float32Array(p.positions),3));mesh.geometry.setAttribute('normal',new BufferAttribute(values,3));
        mesh.geometry.applyMatrix4(new Matrix4().set(m[0][0],m[1][0],m[2][0],t[0],m[0][1],m[1][1],m[2][1],t[1],m[0][2],m[1][2],m[2][2],t[2],0,0,0,1));
        mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
      }
      const x=side==='left'?.43:-.43;s.camera.position.set(x,.83,view==='front'?.38:-.42);s.controls.target.set(x,.83,-.02);s.controls.update();
      let banner=document.getElementById('finger-diagnostic');if(!banner){banner=document.createElement('div');banner.id='finger-diagnostic';document.body.append(banner);}
      banner.style.cssText='position:fixed;top:82px;left:440px;z-index:9999;background:white;color:black;padding:12px;font-size:16px';
      banner.textContent=`${side} ${view} · ${stage==='before'?'현재 공개 자세':'약지·새끼손가락 후보'} — 임상 정합 승인 아님`;
      s.invalidate();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    },{fiber,parts,side,view,stage});
    const file=`.cache/finger-chains/${side}-${view}-${stage}.png`;await page.screenshot({path:file});screenshots.push({path:file,sha256:hash(file)});
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync('.cache/finger-chains/captures.json',JSON.stringify({status:'Disposable geometry diagnostic, not application release evidence',screenshots,errors,
    files:[path,'scripts/capture-finger-chains.mjs',...buffers.keys()].map(path=>({path,sha256:hash(path)}))},null,2)+'\n');
  console.log('Eight fixed-camera finger-chain diagnostic captures; page errors 0.');
}finally{await browser.close();}
