import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const origin=(process.env.SMOKE_ORIGIN||'https://jay-jang.github.io/gyeol-atlas/').replace(/\/$/,'');
const screenshotDir=process.env.COMPARISON_SCREENSHOT_DIR;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:844,height:390}});
  const errors=[],failures=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
  page.on('request',r=>requests.push(r.url()));
  const ready=()=>page.getByText('해부 모델 로드 완료').waitFor({timeout:90000});
  const state=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')));
  await page.goto(`${origin}/#atlas/CV12`);await ready();
  await page.locator('.point-summary').click();
  await page.getByRole('button',{name:'대응 장부의 해부 구조 비교'}).click();await ready();
  await page.getByRole('button',{name:'비교 대상만 보기',exact:true}).click();
  await page.locator('.selection-card').getByRole('button',{name:'확대',exact:true}).click();
  assert.deepEqual((await state()).selection.ids,['FMA7148']);
  assert.equal(await page.locator('.explore-sidebar').isVisible(),false);
  assert.ok((await page.locator('.selection-card').boundingBox()).x<30);
  if(screenshotDir)await page.screenshot({path:`${screenshotDir}/public-comparison-landscape.png`});
  await page.getByRole('button',{name:'구조 선택 해제',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready();
  await page.locator('.point-summary').click();
  await page.getByRole('button',{name:'대응 장부의 해부 구조 비교'}).click();
  const alternative=page.getByRole('button',{name:'위 (여성 CT) 별도 상세 보기',exact:true});
  await alternative.waitFor({state:'visible'});
  await page.waitForFunction(()=>{
    const button=document.querySelector('.comparison-feedback button');
    if(!button)return false;
    const b=button.getBoundingClientRect(),dock=document.querySelector('.dock-body').getBoundingClientRect();
    return b.top>=dock.top&&b.bottom<=dock.bottom;
  },undefined,{timeout:10000}).catch(async error=>{
    console.error(await page.evaluate(()=>Object.fromEntries(['.comparison-feedback button','.comparison-feedback','.dock-body','.floating-dock'].map(selector=>{
      const el=document.querySelector(selector),b=el?.getBoundingClientRect();
      return [selector,{top:b?.top,bottom:b?.bottom,height:b?.height,scrollTop:el?.scrollTop,scrollHeight:el?.scrollHeight,clientHeight:el?.clientHeight}];
    }))));
    throw error;
  });
  assert.equal(requests.filter(u=>u.includes('/female-detail/')).length,0);
  assert.equal((await state()).comparison,null);
  if(screenshotDir)await page.screenshot({path:`${screenshotDir}/public-comparison-female-ct.png`});
  await alternative.click();await ready();
  assert.equal((await state()).detail.id,'stomach-ct');
  assert.equal(await page.locator('canvas').getAttribute('data-visible-structure-ids'),'CTF_stomach');
  assert.equal(await page.locator('canvas').getAttribute('data-rendered-markers'),'0');
  await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();await ready();
  assert.equal(await page.locator('canvas').getAttribute('data-female-atlas-parts'),'1220');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  console.log('Static comparison smoke passed: landscape isolation, explicit female CT alternative with no early download, source-separated selection and HRA return; zero browser/HTTP errors.');
} finally {await browser.close();}
