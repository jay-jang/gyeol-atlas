import fs from 'node:fs';
import {chromium,expect} from '@playwright/test';

const origin=process.env.SMOKE_ORIGIN||'https://jay-jang.github.io/gyeol-atlas/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const report={origin,checkedAt:new Date().toISOString(),viewports:[],errors:[],failedResponses:[]};
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)report.failedResponses.push({url:r.url(),status:r.status()});});
  const ready=()=>expect(page.getByText('해부 모델 로드 완료')).toBeVisible({timeout:60000});
  const snapshot=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')));
  await page.goto(origin);await ready();
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready();
  await page.locator('.featured-anatomy > button').filter({has:page.getByText('뇌',{exact:true})}).click();await ready();
  expect((await snapshot()).selection.ids).toHaveLength(283);
  await expect(page.locator('[data-brain-provenance]')).toContainText('Allen 참조 282개 + Visible Human 시신경교차 1개');
  await page.locator('[data-brain-provenance] summary').click();
  await page.locator('.organ-detail-parts summary').click();
  await page.locator('.organ-detail-parts button').first().click();await ready();
  expect((await snapshot()).selection.ids).toEqual(['HRAF0070']);
  const source=page.locator('.selection-card > div > .selection-source');
  await expect(source).toContainText('Visible Human 여성 시신경교차');
  for(const [width,height] of [[1440,900],[390,844],[844,390]]){
    await page.setViewportSize({width,height});
    await source.scrollIntoViewIfNeeded();await expect(source).toBeInViewport({ratio:1});
    await expect(page.getByRole('button',{name:'전신으로 돌아가기',exact:true})).toBeInViewport({ratio:1});
    report.viewports.push({width,height,sourceAndReturnVisible:true});
  }
  await page.setViewportSize({width:1440,height:900});
  await page.reload();await ready();
  expect((await snapshot()).selection.ids).toEqual(['HRAF0070']);
  await expect(source).toContainText('Visible Human 여성 시신경교차');
  await page.getByRole('button',{name:'기관 전체 모형',exact:true}).click();await ready();
  const parts=page.locator('.organ-detail-parts');
  if(await parts.getAttribute('open')===null)await parts.locator('summary').click();
  await parts.locator('button').nth(1).click();await ready();
  expect((await snapshot()).selection.ids).toEqual(['HRAF0071']);
  await expect(source).toContainText('Allen 기반');
  await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();await ready();
  await page.locator('.explore-sidebar').getByRole('button',{name:'남성',exact:true}).click();await ready();
  await expect(page.locator('[data-brain-provenance]')).toHaveCount(0);
  expect(report.errors).toEqual([]);expect(report.failedResponses).toEqual([]);
  report.status='passed';
  fs.mkdirSync('.cache/brain-provenance',{recursive:true});
  fs.writeFileSync('.cache/brain-provenance/public.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
