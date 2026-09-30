import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin=(process.env.SMOKE_ORIGIN||'https://jay-jang.github.io/gyeol-atlas/').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage();const errors=[],failures=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
  const ready=()=>page.getByText('해부 모델 로드 완료').waitFor({timeout:90000});
  const state=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')));
  await page.goto(`${origin}/#atlas/KI3`);await ready();
  for(const sex of ['male','female'])for(const [width,height] of [[1440,900],[390,844]]){
    await page.setViewportSize({width,height});
    if((await state()).sex!==sex){await page.locator('.ax-top').getByRole('button',{name:sex==='male'?'남성':'여성',exact:true}).click();await ready();}
    await page.locator('.point-summary').click();
    await page.getByRole('button',{name:'대응 장부의 해부 구조 비교'}).click();await ready();
    await page.getByRole('button',{name:'비교 대상만 보기',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')).isolated===true);
    const before=await state();assert.equal(before.comparison.ids.length,sex==='male'?2:50);
    await page.getByRole('button',{name:'구조 선택 해제',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')).comparison===null);
    assert.equal(await page.locator('.selection-card').count(),0);assert.equal(await page.locator('.comparison-note').count(),0);
    const after=await state();assert.equal(after.selection,null);assert.equal(after.isolated,false);
    for(const key of ['layers','alpha','markers','pointId'])assert.deepEqual(after[key],before[key]);
    await page.evaluate(comparison=>{
      const s=JSON.parse(sessionStorage.getItem('gyeol-view-v2'));
      sessionStorage.setItem('gyeol-view-v2',JSON.stringify({...s,comparison}));
    },before.comparison);
    await page.reload();await ready();assert.equal((await state()).comparison,null);
    assert.equal(await page.locator('.comparison-note').count(),0);
    results.push({sex,width,height,members:before.comparison.ids.length,cleared:true,legacyRestored:true});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  console.log(JSON.stringify({origin,results,errors,failures}));
} finally {await browser.close();}
