// Observe source transitions without changing scheduling, geometry or materials.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const rounds=Number(process.env.SCHEDULING_ROUNDS||8);assert.ok(Number.isInteger(rounds)&&rounds>0&&rounds<=30);
const out='.cache/source-scheduling';fs.mkdirSync(out,{recursive:true});
async function boundedSnapshot(query){
  let timer;
  try{return await Promise.race([query(),new Promise(resolve=>{
    timer=setTimeout(()=>resolve({snapshotError:'Diagnostic query did not return within 3 seconds'}),3000);
  })]);}catch(error){return {snapshotError:String(error)};}finally{clearTimeout(timer);}
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const report={status:'running',startedAt:new Date().toISOString(),rounds,errors:[],console:[],steps:[],limitations:[
  'Timing is from headless software rendering on this machine, not end-user latency or GPU completion.',
  'Observer wraps renderer submission but never requests a scene render or edits anatomy.'
]};
let page;
try{
  if(process.argv.includes('--preload-male')){
    const warm=await browser.newPage({viewport:{width:1440,height:1100}});report.prelude=[];
    try{
      await warm.goto('http://127.0.0.1:5174');await warm.getByText('해부 모델 로드 완료').waitFor({timeout:120000});
      for(const depth of ['34.5','68.5','80.5','88.5']){
        const start=Date.now();await warm.getByLabel('연속 해부 박리 깊이').fill(depth);
        await warm.getByText('해부 모델 로드 완료').waitFor({timeout:120000});
        await warm.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const row={depth,elapsedMs:Date.now()-start};report.prelude.push(row);console.log(JSON.stringify({prelude:row}));
      }
    }finally{await warm.close();}
  }
  page=await browser.newPage({viewport:{width:1440,height:1100}});let fiberUrl;
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(['warning','error'].includes(m.type()))report.console.push({type:m.type(),text:m.text()});});
  await page.goto('http://127.0.0.1:5174');
  const ready=()=>page.getByText('해부 모델 로드 완료').waitFor({timeout:120000});await ready();assert.ok(fiberUrl);
  await page.evaluate(async url=>{
    const {_roots}=await import(url),canvas=document.querySelector('canvas'),state=_roots.get(canvas).store.getState();
    const audit=window.__sourceSchedule={frames:[],longTasks:[],events:[],gl:state.gl,step:'install'};
    canvas.addEventListener('webglcontextlost',()=>audit.events.push({kind:'contextlost',t:performance.now()}));
    canvas.addEventListener('webglcontextrestored',()=>audit.events.push({kind:'contextrestored',t:performance.now()}));
    new PerformanceObserver(list=>{for(const e of list.getEntries())audit.longTasks.push({t:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
    const render=state.gl.render;
    audit.wrapped=function(scene,camera){
      const row={step:audit.step,start:performance.now(),end:null,counts:{female:0,ct:0,maleDetail:0},groups:[]};
      scene.traverseVisible(m=>{
        if(m.isGroup&&m.name.endsWith('-atlas'))row.groups.push(m.name);
        if(!m.isMesh)return;
        if(/^(HRAF|BM|VHF)/.test(m.name))row.counts.female++;
        if(m.name.startsWith('CTF_'))row.counts.ct++;
        if(m.name.startsWith('BP4_'))row.counts.maleDetail++;
      });audit.frames.push(row);
      try{return render.call(this,scene,camera);}finally{row.end=performance.now();}
    };state.gl.render=audit.wrapped;
  },fiberUrl);
  const snapshot=()=>page.evaluate(async url=>{
    const {_roots}=await import(url),canvas=document.querySelector('canvas'),state=_roots.get(canvas)?.store.getState(),a=window.__sourceSchedule;
    return {at:performance.now(),step:a.step,view:JSON.parse(sessionStorage.getItem('gyeol-view-v2')),frames:a.frames.filter(f=>f.step===a.step),
      longTasks:a.longTasks,events:a.events,canvasConnected:canvas.isConnected,documentVisible:document.visibilityState,
      rendererSame:state?.gl===a.gl,hookPresent:state?.gl.render===a.wrapped,contextLost:state?.gl.getContext().isContextLost(),
      internal:state?{frames:state.internal.frames,active:state.internal.active,priority:state.internal.priority,frameloop:state.frameloop}:null,
      groups:(()=>{const found=[];state?.scene.traverse(o=>{if(o.name.endsWith('-atlas'))found.push({name:o.name,visible:o.visible,children:o.children.length});});return found;})(),
      memory:state?.gl.info.memory,programs:state?.gl.info.programs?.length};
  },fiberUrl);
  for(let i=0;i<1+rounds*2;i++){
    const action=i===0?'female':i%2?'ct':'return',key=`${i}/${action}`;
    await page.evaluate(key=>{window.__sourceSchedule.step=key;},key);
    const start=Date.now();
    if(action==='female')await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();
    else if(action==='ct')await page.locator('.featured-anatomy > button').filter({has:page.getByText('위 (여성 CT)',{exact:true})}).click();
    else await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();
    await ready();const readyMs=Date.now()-start;
    let failure=null;
    try{await page.waitForFunction(({key,target})=>window.__sourceSchedule.frames.some(f=>f.step===key&&f.counts[target]>0),{key,target:action==='ct'?'ct':'female'},{timeout:15000});}
    catch(e){failure=String(e);}
    const state=await boundedSnapshot(snapshot),row={key,readyMs,observedMs:Date.now()-start,failure,...state};report.steps.push(row);
    console.log(JSON.stringify({key,readyMs,observedMs:row.observedMs,failure:Boolean(failure),snapshotError:state.snapshotError,frameCount:state.frames?.length,
      submissionsMs:state.frames?.map(f=>f.end-f.start),internal:state.internal,rendererSame:state.rendererSame,hookPresent:state.hookPresent,groups:state.groups}));
    if(failure||state.snapshotError){
      try{await page.screenshot({path:`${out}/failure.png`,timeout:3000});}catch(error){row.screenshotError=String(error);}
      break;
    }
  }
  report.status=report.steps.some(s=>s.failure||s.snapshotError)?'observation incomplete; inspect diagnostics before interpreting':'target submissions observed in every requested transition';
}catch(e){report.status='diagnostic failed';report.error=String(e);throw e;}
finally{
  await browser.close();
  report.files=['scripts/audit-source-scheduling.mjs','src/PackedAtlas.tsx','src/Atlas.tsx'].map(path=>({path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex')}));
  fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');
}
