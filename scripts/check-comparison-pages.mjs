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
  // Since the minimal atlas the card floats at the right, clear of the depth rail.
  const landscapeCard=await page.locator('.selection-card').boundingBox(),rail=await page.locator('.ax-depth').boundingBox();
  assert.ok(landscapeCard.x>=rail.x+rail.width&&landscapeCard.x+landscapeCard.width<=844&&landscapeCard.y+landscapeCard.height<=390);
  if(screenshotDir)await page.screenshot({path:`${screenshotDir}/public-comparison-landscape.png`});
  await page.getByRole('button',{name:'구조 선택 해제',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready();
  await page.locator('.point-summary').click();
  await page.getByRole('button',{name:'대응 장부의 해부 구조 비교'}).click();
  // The carried stomach is compared in the overview; the CT stomach stays a separate choice.
  const alternative=page.getByRole('button',{name:'위 (여성 CT) 상세',exact:true});
  await alternative.waitFor({state:'visible'});
  assert.deepEqual((await state()).selection.ids,['FT_FMA7148']);
  const card=await page.locator('.selection-card').boundingBox(),button=await alternative.boundingBox(),bar=await page.locator('.ax-point-bar').boundingBox();
  assert.ok(button.y>=card.y&&button.y+button.height<=card.y+card.height&&card.y+card.height<=bar.y);
  assert.equal(requests.filter(u=>u.includes('/female-detail/')).length,0);
  if(screenshotDir)await page.screenshot({path:`${screenshotDir}/public-comparison-female-ct.png`});
  await alternative.click();await ready();
  assert.equal((await state()).detail.id,'stomach-ct');
  // Scene attributes are published a frame after the state change.
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.visibleStructureIds==='CTF_stomach',undefined,{timeout:30000});
  assert.equal(await page.locator('canvas').getAttribute('data-rendered-markers'),'0');
  await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();await ready();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.femaleAtlasParts==='1220',undefined,{timeout:30000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  console.log('Static comparison smoke passed: landscape isolation, carried female stomach comparison with an explicit CT alternative and no early download, source-separated selection and HRA return; zero browser/HTTP errors.');
} finally {await browser.close();}
