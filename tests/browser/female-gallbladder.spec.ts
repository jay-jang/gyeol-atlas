import {test,expect} from '@playwright/test';
import {ready,snapshot,openTool,closeTool,organs} from './helpers';
import groups from '../../data/female-biliary-groups.json' with {type:'json'};

const gallbladder=groups[0];
const visible=async(page:import('@playwright/test').Page)=>(await page.locator('canvas').getAttribute('data-visible-structure-ids')||'').split(',').filter(Boolean).sort();

test('female gallbladder detail opens four actual meshes and restores the prior peel',async({page})=>{
  test.setTimeout(180000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5');await ready(page);
  const before=await snapshot(page);
  await (await organs(page)).filter({has:page.getByText(gallbladder.name,{exact:true})}).click();await ready(page);
  await expect.poll(()=>visible(page)).toEqual([...gallbladder.ids].sort());
  await expect.poll(async()=>(await snapshot(page)).detail.id).toBe(gallbladder.id);
  await page.screenshot({path:'docs/anatomy-alignment/female-gallbladder-desktop.png'});
  await page.locator('.organ-detail-parts summary').click();
  await expect(page.locator('.organ-detail-parts button')).toHaveCount(4);
  await page.locator('.organ-detail-parts button').filter({hasText:'Cystic artery'}).click();await ready(page);
  await expect.poll(()=>visible(page)).toEqual(['HRAF0687']);
  await page.setViewportSize({width:390,height:844});await ready(page);
  await page.screenshot({path:'docs/anatomy-alignment/female-gallbladder-mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'기관 전체 모형',exact:true}).click();await ready(page);
  await expect.poll(()=>visible(page)).toEqual([...gallbladder.ids].sort());
  await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();await ready(page);
  const after=await snapshot(page);
  expect(after.detail).toBe(null);
  expect(after.dissection).toBe(before.dissection);
  expect(after.displayMode).toBe(before.displayMode);
  expect(after.markers).toBe(before.markers);
  expect(errors).toEqual([]);
});

test('female cystic artery keeps its English source name and opens the abdominal group',async({page})=>{
  await page.goto('/');await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await openTool(page,'구조 찾기');
  await page.getByLabel('경혈·구조 검색').fill('HRAF0687');
  await expect(page.locator('.structure-item')).toContainText(['Cystic artery']);
  await page.locator('.structure-item').click();await ready(page);await closeTool(page);
  await expect.poll(async()=>(await snapshot(page)).selection.ids).toEqual(['HRAF0687']);
  await expect(page.getByLabel('전신 부위 선택')).toHaveValue('abdomen');
  await page.getByRole('button',{name:'기관 상세 보기',exact:true}).click();await ready(page);
  await expect.poll(()=>visible(page)).toEqual([...gallbladder.ids].sort());
});
