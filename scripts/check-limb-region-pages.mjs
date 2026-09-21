// Public build check: real catalog search and committed visible mesh IDs.
// This does not expose or modify the renderer's internal scene.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {limbSkeletonRegion} from '../src/anatomy-region.ts';
const origin=process.env.PAGES_ORIGIN||'http://127.0.0.1:5174/';
const catalogs={male:JSON.parse(fs.readFileSync('scripts/model-inputs.json')).assets,
  female:JSON.parse(fs.readFileSync('data/female-atlas-structures.json'))};
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],failures=[],checks=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
  const ready=()=>page.getByText('해부 모델 로드 완료').waitFor({timeout:120000});
  await page.goto(origin);await ready();
  for(const sex of ['male','female']) {
    if(sex==='female') {await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready();}
    await page.getByRole('button',{name:'골격 빠른 보기',exact:true}).click();await ready();
    const catalog=catalogs[sex],allIds=catalog.filter(s=>limbSkeletonRegion(s)).map(s=>s.id);
    for(const region of ['upper-limb','lower-limb','abdomen','pelvis','chest','upper-body','lower-body','whole']) {
      await page.getByLabel('전신 부위 선택').selectOption(region);
      const expected=catalog.filter(s=>{
        const limb=limbSkeletonRegion(s);
        return limb&&(region==='whole'||region===limb||region===(limb==='upper-limb'?'upper-body':'lower-body'));
      }).map(s=>s.id).sort();
      await page.waitForFunction(({allIds,expected})=>{
        const ids=(document.querySelector('canvas')?.dataset.visibleStructureIds||'').split(',');
        return JSON.stringify(ids.filter(id=>allIds.includes(id)).sort())===JSON.stringify(expected);
      },{allIds,expected});
      checks.push({sex,region,expectedNamedLimbStructures:expected.length,passed:true});
    }
    for(const id of sex==='female'?['BM0064','BM0069','BM0078','BM0127']:['FMA23951','FMA24459','FMA23131','FMA32651']) {
      if(!await page.getByLabel('해부 구조 검색').isVisible())await page.getByRole('button',{name:'구조 찾기',exact:true}).click();
      await page.getByLabel('해부 구조 검색').fill(id);
      await page.locator('.structure-item').filter({hasText:id}).click();await ready();
      const expected=limbSkeletonRegion(catalog.find(s=>s.id===id));
      assert.equal(await page.getByLabel('전신 부위 선택').inputValue(),expected);
      await page.waitForFunction(id=>document.querySelector('canvas')?.dataset.visibleStructureIds?.split(',').includes(id),id);
      checks.push({sex,id,region:expected,passed:true});
    }
    await page.getByRole('button',{name:'도구 패널 닫기',exact:true}).click();
    await page.getByRole('button',{name:'골격 빠른 보기',exact:true}).click();await ready();
    await page.getByLabel('전신 부위 선택').selectOption('upper-limb');
    await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2'))?.anatomyRegion==='upper-limb');
    const desktopDistance=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')).camera.position[2]);
    await page.setViewportSize({width:390,height:844});
    // Wait for the resized camera pose to settle before the explicit capture.
    await page.waitForFunction(desktopDistance=>{
      const s=JSON.parse(sessionStorage.getItem('gyeol-view-v2'));
      return s?.anatomyRegion==='upper-limb' && s.camera?.position[2]>desktopDistance;
    },desktopDistance);
    await page.screenshot({path:`docs/anatomy-alignment/pages-${sex}-limb-region-mobile.png`});
    await page.setViewportSize({width:1440,height:900});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  const report={origin,checkedAt:new Date().toISOString(),scope:'270 named limb skeleton structures; not all trunk or connective tissue regions',checks,errors,failures};
  fs.writeFileSync('docs/anatomy-alignment/pages-limb-region-verification.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally {await browser.close();}
