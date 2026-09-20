import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const origin=process.env.SMOKE_ORIGIN||'https://jay-jang.github.io/gyeol-atlas/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);const ready=()=>page.getByText('해부 모델 로드 완료').waitFor({timeout:90000});await ready();
  for(const scenario of [
    {sex:'male',label:'남성',depth:49,hidden:['FMA22559','FMA45958','FMA45961'],visible:['FMA65015','FMA65017','FMA65019']},
    {sex:'female',label:'여성',depth:46.5,hidden:['VHF0005','VHF0020'],visible:['VHF0022','VHF0018','VHF0019','VHF0024']},
  ]){
    await page.locator('.explore-sidebar').getByRole('button',{name:scenario.label,exact:true}).click();await ready();
    await page.getByLabel('연속 해부 박리 깊이').fill(String(scenario.depth));await ready();
    await page.waitForFunction(s=>{
      const canvas=document.querySelector('canvas'),ids=new Set(canvas?.dataset.visibleStructureIds?.split(',')||[]);
      return canvas?.dataset.modelSex===s.sex&&s.visible.every(id=>ids.has(id))&&s.hidden.every(id=>!ids.has(id));
    },scenario);
    const state=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')));
    assert.equal(state.dissection,scenario.depth);assert.equal(state.selection,null);assert.equal(state.displayMode,'dissection');
    checks.push({...scenario,passed:true});
  }
  await page.getByRole('button',{name:'도움말',exact:true}).click();
  assert.match(await page.locator('.viewer-help').innerText(),/전체 해부 층서가 검증된 것은 아닙니다/);
  assert.deepEqual(errors,[]);
  const report={origin,checkedAt:new Date().toISOString(),method:'Public built app: real visible mesh IDs at two discriminating peel settings, no selected-mesh override; not all-depth anatomical validation',checks,errors};
  await fs.writeFile('docs/anatomy-alignment/muscle-peel-pages.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally {await browser.close();}
