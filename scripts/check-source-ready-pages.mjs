// Deployed post-ready state check, not interception of production first draws.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const origin=process.env.PAGES_ORIGIN||'http://127.0.0.1:5174/';
const female=JSON.parse(fs.readFileSync('data/female-atlas-structures.json'));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],failures=[],checks=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
  const ready=()=>page.getByText('해부 모델 로드 완료').waitFor({timeout:120000});
  await page.goto(origin);await ready();
  for(const step of ['female','ct','return','ct','return']) {
    if(step==='female')await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();
    else if(step==='ct')await page.locator('.featured-anatomy > button').filter({has:page.getByText('위 (여성 CT)',{exact:true})}).click();
    else await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();
    await ready();
    const expected=step==='ct'?['CTF_stomach']:female.filter(s=>s.layer===(step==='female'?'skin':'organ')&&!s.hierarchy.includes('pregnancy')).map(s=>s.id).sort();
    await page.waitForFunction(expected=>JSON.stringify((document.querySelector('canvas')?.dataset.visibleStructureIds||'').split(',').sort())===JSON.stringify(expected),expected);
    const state=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')));
    assert.equal(state.sex,'female');assert.equal(Boolean(state.detail),step==='ct');
    checks.push({step,visibleCount:expected.length,passed:true});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  const report={origin,checkedAt:new Date().toISOString(),method:'Post-ready public source transitions and exact visible IDs; not first-frame instrumentation',checks,errors,failures};
  fs.writeFileSync('docs/anatomy-alignment/pages-source-ready-verification.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally {await browser.close();}
