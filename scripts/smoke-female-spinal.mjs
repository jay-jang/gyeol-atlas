// Public selection/membership check. Local source/geometry audits are separate.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const origin=(process.env.SMOKE_ORIGIN||'https://jay-jang.github.io/gyeol-atlas').replace(/\/$/,'');
const group=JSON.parse(fs.readFileSync('data/female-composite-groups.json')).find(g=>g.id==='spinal-cord');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],failures=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push({url:r.url(),status:r.status()});});
  const ready=()=>expect(page.getByText('해부 모델 로드 완료')).toBeVisible({timeout:120000});
  await page.goto(`${origin}/`);await ready();
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready();
  await page.getByRole('button',{name:'구조 찾기',exact:true}).click();await page.getByLabel('경혈·구조 검색').fill('HRAF0370');
  await page.locator('.structure-item').click();await ready();await page.getByRole('button',{name:'도구 패널 닫기',exact:true}).click();
  const card=page.getByRole('region',{name:'선택 구조 조작'}),canvas=page.locator('canvas');
  const visible=async()=>(await canvas.getAttribute('data-visible-structure-ids')||'').split(',').filter(Boolean).sort();
  await card.getByRole('button',{name:'척수 수록 분절 전체 상세 보기',exact:true}).click();await ready();
  await expect.poll(visible).toEqual([...group.ids].sort());
  await card.locator('.organ-detail-parts summary').click();const buttons=card.locator('.organ-detail-parts button');
  assert.equal(await buttons.count(),29);const labels=await buttons.allTextContents();
  assert.ok(labels[13].includes('T6')&&labels[14].includes('T7')&&labels[15].includes('T8'));
  for(let i=0;i<group.ids.length;i++){await buttons.nth(i).click();await ready();await expect.poll(visible).toEqual([group.ids[i]]);}
  await page.reload();await ready();await expect.poll(visible).toEqual([group.ids.at(-1)]);
  await card.getByRole('button',{name:'척수 수록 분절 전체 모형',exact:true}).click();await ready();await expect.poll(visible).toEqual([...group.ids].sort());
  await page.setViewportSize({width:390,height:844});
  await expect(card.locator('.organ-detail-parts summary')).toBeInViewport({ratio:1});
  await expect(card.getByRole('button',{name:'전신으로 돌아가기',exact:true})).toBeInViewport({ratio:1});
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5');await ready();
  const view=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')));assert.equal(view.detail,null);assert.equal(view.selection,null);
  await page.locator('.ax-top').getByRole('button',{name:'남성',exact:true}).click();await ready();
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  const result={origin,checkedAt:new Date().toISOString(),group:group.id,allSelectedIds:group.ids,labels,reloadSingleId:group.ids.at(-1),peelReturn:50.5,errors,failures,
    scope:'Actual public whole/29-part selection, source ordering, reload, mobile controls, peel and sex return; source geometry and anatomical alignment were not revalidated by this script.'};
  fs.mkdirSync('.cache/neural-source',{recursive:true});fs.writeFileSync('.cache/neural-source/public-spinal.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
