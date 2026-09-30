import {test,expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {ready,snapshot,openTool,closeTool,organs} from './helpers';
import groups from '../../data/female-airway-groups.json' with {type:'json'};

const airway=groups.find(group=>group.id==='tracheobronchial-tree')!;
const visible=async(page:Page)=>(await page.locator('canvas').getAttribute('data-visible-structure-ids')||'').split(',').filter(Boolean).sort();

test('female tracheobronchial tree opens every source mesh and keeps individual selection on desktop and mobile',async({page})=>{
  test.setTimeout(180000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5');await ready(page);
  const before=await snapshot(page);
  await (await organs(page)).filter({has:page.getByText(airway.name,{exact:true})}).click();await ready(page);
  await expect.poll(()=>visible(page)).toEqual([...airway.ids].sort());
  await expect.poll(async()=>(await snapshot(page)).detail.id).toBe(airway.id);
  await expect(page.locator('canvas')).toHaveAttribute('data-rendered-markers','0');
  await page.screenshot({path:'docs/anatomy-alignment/female-airway-desktop.png'});
  await page.locator('.organ-detail-parts summary').click();
  await expect(page.locator('.organ-detail-parts button')).toHaveCount(36);
  await page.locator('.organ-detail-parts button').filter({hasText:'Right anterior basal bronchus'}).click();await ready(page);
  await expect.poll(()=>visible(page)).toEqual(['HRAF0808']);
  await page.setViewportSize({width:390,height:844});await ready(page);
  await page.screenshot({path:'docs/anatomy-alignment/female-airway-mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.reload();await ready(page);
  await expect.poll(()=>visible(page)).toEqual(['HRAF0808']);
  await page.getByRole('button',{name:'기관 전체 모형',exact:true}).click();await ready(page);
  await expect.poll(()=>visible(page)).toEqual([...airway.ids].sort());
  await page.screenshot({path:'docs/anatomy-alignment/female-airway-mobile-whole.png'});
  await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();await ready(page);
  const after=await snapshot(page);
  expect(after.detail).toBe(null);
  expect(after.dissection).toBe(before.dissection);
  expect(after.displayMode).toBe(before.displayMode);
  expect(after.markers).toBe(before.markers);
  expect(errors).toEqual([]);
});

test('female airway search keeps its original English name and enters the same source group',async({page})=>{
  await page.goto('/');await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await openTool(page,'구조 찾기');
  await page.getByLabel('경혈·구조 검색').fill('기관지 나무');
  await expect(page.locator('.structure-item')).toHaveCount(36);
  await expect(page.locator('.structure-item').filter({hasText:'Right anterior basal bronchus'})).toBeVisible();
  await page.getByLabel('경혈·구조 검색').fill('HRAF0808');
  await expect(page.locator('.structure-item')).toContainText(['Right anterior basal bronchus']);
  await page.locator('.structure-item').click();await ready(page);await closeTool(page);
  await expect.poll(async()=>(await snapshot(page)).selection.ids).toEqual(['HRAF0808']);
  await expect.poll(async()=>(await visible(page)).includes('HRAF0808')).toBe(true);
  await expect(page.getByLabel('전신 부위 선택')).toHaveValue('chest');
  await page.getByRole('button',{name:'기관 상세 보기',exact:true}).click();await ready(page);
  await expect.poll(()=>visible(page)).toEqual([...airway.ids].sort());
  await expect.poll(async()=>(await snapshot(page)).detail.id).toBe(airway.id);
});
