// Production-bundle browser check without a local TCP server. Requests to the
// test-only origin are fulfilled from dist/; no remote site is contacted.
import assert from 'node:assert/strict';
import {readFile,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '@playwright/test';

const root=path.resolve('dist'),origin='http://gyeol-offline.test';
const output=path.resolve('docs/anatomy-alignment');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.glb':'model/gltf-binary',
  '.gz':'application/octet-stream'};
const snapshot=page=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')||'null'));
const settled=async(page,test,arg=null)=>page.waitForFunction(test,arg,{timeout:60000});
const poseError=(a,b)=>Math.max(...['position','target'].flatMap(key=>a[key].map((v,i)=>Math.abs(v-b[key][i]))));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
  await mkdir(output,{recursive:true});
  const rows=[];
  for(const scenario of [
    {sex:'male',name:'심장',id:'heart',file:'direct-detail-camera-male-heart'},
    {sex:'female',name:'뇌',id:'brain',file:'direct-detail-camera-female-brain'},
    {sex:'female',name:'위 (여성 CT)',id:'stomach',file:'direct-detail-camera-female-ct'},
  ]){
    const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
    await page.route(`${origin}/**`,async route=>{
      const pathname=decodeURIComponent(new URL(route.request().url()).pathname);
      const file=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
      if(!file.startsWith(`${root}${path.sep}`))return route.fulfill({status:403,body:'Forbidden'});
      try{
        if(!(await stat(file)).isFile())throw new Error('Not a file');
        await route.fulfill({status:200,body:await readFile(file),contentType:mime[path.extname(file)]||'application/octet-stream'});
      }catch{return route.fulfill({status:404,body:'Not found'});}
    });
    try{
      await page.goto(origin,{waitUntil:'domcontentloaded'});
      await settled(page,()=>Boolean(document.querySelector('canvas')?.getAttribute('data-visible-structure-ids')));
      if(scenario.sex==='female'){
        await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();
        await settled(page,()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')||'null')?.sex==='female'
          && document.querySelector('canvas')?.getAttribute('data-female-atlas-parts')==='1220');
      }
      await page.getByLabel('연속 해부 박리 깊이').fill('50.5');
      await settled(page,()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')||'null')?.dissection===50.5);
      const before=await snapshot(page);
      assert.ok(before.camera,`${scenario.id} overview camera`);
      const beforeIds=await page.locator('canvas').getAttribute('data-visible-structure-ids');
      await page.locator('.featured-anatomy > button').filter({has:page.getByText(scenario.name,{exact:true})}).click();
      await settled(page,()=>Boolean(JSON.parse(sessionStorage.getItem('gyeol-view-v2')||'null')?.detail));
      let inside=await snapshot(page);
      assert.deepEqual(inside.detailReturn.camera,before.camera,`${scenario.id} origin pose`);
      await page.reload({waitUntil:'domcontentloaded'});
      await settled(page,()=>Boolean(JSON.parse(sessionStorage.getItem('gyeol-view-v2')||'null')?.detail)
        && Boolean(document.querySelector('canvas')?.getAttribute('data-visible-structure-ids')));
      inside=await snapshot(page);
      assert.deepEqual(inside.detailReturn.camera,before.camera,`${scenario.id} persisted pose`);
      await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();
      await settled(page,originPose=>{
        const s=JSON.parse(sessionStorage.getItem('gyeol-view-v2')||'null');
        if(!s||s.detail||s.dissection!==50.5||!s.camera)return false;
        return Math.max(...['position','target'].flatMap(key=>s.camera[key].map((v,i)=>Math.abs(v-originPose[key][i]))))<1e-6;
      },before.camera);
      const after=await snapshot(page),afterIds=await page.locator('canvas').getAttribute('data-visible-structure-ids');
      assert.equal(afterIds,beforeIds,`${scenario.id} visible membership`);
      await page.screenshot({path:path.join(output,`${scenario.file}-desktop.png`)});
      await page.setViewportSize({width:390,height:844});
      await page.screenshot({path:path.join(output,`${scenario.file}-mobile.png`)});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.deepEqual(errors,[],`${scenario.id} browser errors`);
      rows.push({scenario:scenario.id,originPose:before.camera,returnedPose:after.camera,poseError:poseError(before.camera,after.camera),visibleIds:afterIds?.split(',').filter(Boolean).length,errors});
    }finally{await page.close();}
  }
  console.log(JSON.stringify(rows,null,2));
}finally{await browser.close();}
