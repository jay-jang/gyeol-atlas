import {test,expect} from '@playwright/test';
import {ready,openTool,closeTool,snapshot} from './helpers';
test('added muscles, spinal cord and thyroid can be searched, isolated and framed',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/');await ready(page);
 for(const [query,id] of [['광배근','FMA13358'],['목빗근','FMA13408'],['척수 신경조직','FJ4426'],['정중신경','FJ4224'],['FMA13369','FJ3671']]){
  await openTool(page,'구조 찾기');await page.getByLabel('해부 구조 검색').fill(query);
  await page.locator('.structure-item').filter({hasText:id}).click();await ready(page);
  await page.getByRole('button',{name:'선택 구조 확대',exact:true}).click();
  await page.getByRole('button',{name:'선택 구조만 보기',exact:true}).click();
  await expect.poll(async()=>(await snapshot(page)).selection.ids[0]).toBe(id);
  await expect(page.locator('.selection-card')).toBeVisible();
  if(id==='FJ4426'||id==='FMA13358')await page.screenshot({path:`docs/anatomy-expansion/${id}.png`});
 }
});
