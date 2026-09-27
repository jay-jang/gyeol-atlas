// Public rendered membership and hidden-structure selection; not anatomical alignment.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,expect} from '@playwright/test';
const origin=(process.env.SMOKE_ORIGIN||'https://jay-jang.github.io/gyeol-atlas').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage(),errors=[],failures=[],results=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
  const ready=()=>expect(page.getByText('해부 모델 로드 완료')).toBeVisible({timeout:120000});
  const visible=async()=>(await page.locator('canvas').getAttribute('data-visible-structure-ids')||'').split(',');
  await page.goto(`${origin}/`);await ready();
  for(const sex of ['male','female']){
    await page.locator('.explore-sidebar').getByRole('button',{name:sex==='male'?'남성':'여성',exact:true}).click();await ready();
    const rows=JSON.parse(fs.readFileSync(`docs/anatomy-alignment/gluteal-peel-${sex}.json`)).changes;
    const ids=rows.map(r=>r.id),depths=sex==='male'?[34,38,42,46,64]:[36,41,50,64];
    for(const [width,height] of [[1440,900],[390,844]]){
      await page.setViewportSize({width,height});
      for(const depth of depths){
        await page.getByLabel('연속 해부 박리 깊이').fill(String(depth));await ready();
        const expected=rows.filter(r=>depth<r.afterEnd).map(r=>r.id).sort();
        await expect.poll(async()=>(await visible()).filter(id=>ids.includes(id)).sort()).toEqual(expected);
      }
      const selected=sex==='male'?'FMA22333':'VHF0027';
      await page.getByRole('button',{name:'구조 찾기',exact:true}).click();
      await page.getByLabel('해부 구조 검색').fill(selected);
      await page.locator('.structure-item').click();await ready();
      await page.getByRole('button',{name:'도구 패널 닫기',exact:true}).click();
      await expect.poll(visible).toContain(selected);
      await page.getByRole('button',{name:'구조 선택 해제',exact:true}).click();
      await page.getByLabel('연속 해부 박리 깊이').fill('64');await ready();
      await expect.poll(async()=>(await visible()).filter(id=>ids.includes(id))).toEqual([]);
      results.push({sex,width,height,depths,hiddenSelection:selected});
    }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  console.log(JSON.stringify({origin,checkedAt:new Date().toISOString(),results,errors,failures}));
} finally {await browser.close();}
