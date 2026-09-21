import fs from 'node:fs';
import {chromium} from '@playwright/test';
const origin=process.env.AUDIT_ORIGIN||'http://127.0.0.1:5174/';
const layerById=Object.fromEntries([
  ...JSON.parse(fs.readFileSync('scripts/model-inputs.json')).assets,
  ...JSON.parse(fs.readFileSync('data/full-system-structures.json')),
  ...JSON.parse(fs.readFileSync('data/sex-lymph-structures.json')),
].map(s=>[s.id,s.layer]));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const report={origin,startedAt:new Date().toISOString(),steps:[],errors:[],failures:[]};
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});let fiberUrl='';
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('requestfailed',r=>report.failures.push({url:r.url(),error:r.failure()?.errorText}));
  await page.goto(origin);await page.getByText('해부 모델 로드 완료').waitFor({timeout:120000});
  await page.evaluate(async ({url,layerById})=>{
    const {_roots}=await import(/* @vite-ignore */url),state=_roots.get(document.querySelector('canvas')).store.getState();
    const renderer=state.gl,render=renderer.render;
    window.__firstFrames=[];
    renderer.render=function(scene,camera){
      const groups={};
      scene.traverseVisible(mesh=>{
        if(!mesh.isMesh)return;
        const layer=mesh.userData.layer||layerById[mesh.name]||layerById[mesh.parent?.name];
        if(!layer)return;
        const group=groups[mesh.parent?.name]??={count:0,layers:{},ids:[],alphaMin:1,alphaMax:0,materials:[]};
        group.count++;group.layers[layer]=(group.layers[layer]||0)+1;group.ids.push(mesh.name);
        group.alphaMin=Math.min(group.alphaMin,mesh.material.opacity);group.alphaMax=Math.max(group.alphaMax,mesh.material.opacity);
        group.materials.push([mesh.name,mesh.material.opacity,mesh.material.transparent]);
      });
      const start=performance.now();
      const result=render.call(this,scene,camera);
      const signature=JSON.stringify(Object.entries(groups).map(([name,g])=>[name,g.materials]));
      const previous=window.__firstFrames.at(-1);
      if(previous?.signature===signature){previous.frames++;previous.maxSubmissionMs=Math.max(previous.maxSubmissionMs,performance.now()-start);}
      else window.__firstFrames.push({atMs:start,signature,groups,frames:1,maxSubmissionMs:performance.now()-start,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
        uiDepth:Number(document.querySelector('input[aria-label="연속 해부 박리 깊이"]').value),
        declaredParts:document.querySelector('canvas').dataset.femaleAtlasParts,
        state:JSON.parse(sessionStorage.getItem('gyeol-view-v2'))});
      return result;
    };
  },{url:fiberUrl,layerById});
  for(const step of ['male-20','male-32','male-34.5','male-48','male-64','female','ct','return']) {
    const start=Date.now();
    if(step.startsWith('male-'))await page.getByLabel('연속 해부 박리 깊이').fill(step.slice(5));
    else if(step==='female')await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();
    else if(step==='ct')await page.locator('.featured-anatomy > button').filter({has:page.getByText('위 (여성 CT)',{exact:true})}).click();
    else await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();
    await page.getByText('해부 모델 로드 완료').waitFor({timeout:120000});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const frames=await page.evaluate(()=>window.__firstFrames.splice(0).map(({signature,...frame})=>frame));
    report.steps.push({step,elapsedMs:Date.now()-start,frames});
    console.log(JSON.stringify({step,elapsedMs:Date.now()-start,frames:frames.map(f=>({uiDepth:f.uiDepth,groups:Object.fromEntries(Object.entries(f.groups).map(([name,g])=>[name,{count:g.count,layers:g.layers,alpha:[g.alphaMin,g.alphaMax]}])),submissionMs:f.maxSubmissionMs,drawCalls:f.drawCalls,triangles:f.triangles}))}));
  }
} catch(error) {report.error=String(error);throw error;}
finally {fs.mkdirSync('.cache/first-frame',{recursive:true});fs.writeFileSync('.cache/first-frame/audit.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
