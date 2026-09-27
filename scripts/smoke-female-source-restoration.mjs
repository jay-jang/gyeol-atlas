// Deployed asset + interaction check, not a complete deployed vertex audit.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
const origin=(process.env.SMOKE_ORIGIN||'https://jay-jang.github.io/gyeol-atlas').replace(/\/$/,'');
const spec=JSON.parse(fs.readFileSync('data/catalog/female-source-restoration.json'));
const proof=JSON.parse(fs.readFileSync('docs/anatomy-alignment/hra-ilium-restoration-readback.json'));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],failures=[],requests=[];let assetResponse;
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  page.on('response',r=>{if(r.status()>=400)failures.push({url:r.url(),status:r.status()});if(r.url().endsWith(spec.url))assetResponse=r;});
  const ready=()=>expect(page.getByText('해부 모델 로드 완료')).toBeVisible({timeout:120000});
  await page.goto(`${origin}/#wiki`);await expect(page.getByRole('heading',{name:'위키에 물어보기'})).toBeVisible();
  assert.equal(requests.filter(u=>u.endsWith(spec.url)).length,0);
  await page.getByRole('link',{name:'3D 경혈 지도',exact:true}).click();await ready();
  assert.equal(requests.filter(u=>u.endsWith(spec.url)).length,0);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready();
  assert.ok(assetResponse,'Female overview must request the restoration asset');
  const body=await assetResponse.body(),assetBodySha256=createHash('sha256').update(body).digest('hex');
  assert.equal(assetBodySha256,body.length===spec.bytes?proof.uncompressedSha256:spec.sha256);
  await page.getByRole('button',{name:'구조 찾기',exact:true}).click();await page.getByLabel('해부 구조 검색').fill('HRAF0827');
  await page.locator('.structure-item').click();await ready();await page.getByRole('button',{name:'도구 패널 닫기',exact:true}).click();
  await page.getByRole('region',{name:'선택 구조 조작'}).getByRole('button',{name:'선택 구조만 보기',exact:true}).click();await ready();
  await expect.poll(()=>page.locator('canvas').getAttribute('data-visible-structure-ids')).toBe('HRAF0827');
  await page.reload();await ready();await expect.poll(()=>page.locator('canvas').getAttribute('data-visible-structure-ids')).toBe('HRAF0827');
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5');await ready();
  const view=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')));assert.equal(view.selection,null);assert.equal(view.dissection,50.5);
  await page.locator('.explore-sidebar').getByRole('button',{name:'남성',exact:true}).click();await ready();
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  const result={origin,checkedAt:new Date().toISOString(),version:spec.version,assetBodyBytes:body.length,assetBodySha256,selectedAndRestored:'HRAF0827',peelReturn:50.5,errors,failures,
    scope:'Actual deployed asset bytes, lazy-load separation, select/isolate/reload/peel/sex flow. Full vertex/normal/index hash across201 depths was checked locally, not by this public script.'};
  fs.mkdirSync('.cache/hra-ilium-restoration',{recursive:true});fs.writeFileSync('.cache/hra-ilium-restoration/public.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
