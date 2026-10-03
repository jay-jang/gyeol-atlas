import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import {ready,snapshot,closeTool,settledCamera} from './helpers';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const catalog:{id:string;model:string}[]=read('data/connective-structures.json');
const tags=read('data/connective-tags.json');
const maleIds=new Set([...catalog.map(e=>e.id),...Object.keys(tags.male)]);
const femaleIds=new Set(Object.keys(tags.female));
const visible=async(page:Page)=>new Set(((await page.locator('canvas').getAttribute('data-visible-structure-ids'))||'').split(',').filter(Boolean));
const openDisplay=(page:Page)=>page.getByRole('button',{name:'표시 설정',exact:true}).click();

test('male ligaments and tendons are present, peel with their systems and can be hidden or viewed alone',async({page})=>{
  test.setTimeout(180000);
  const requests:string[]=[],errors:string[]=[];
  page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await ready(page);
  for(const file of ['ligament-full.glb','tendon-full.glb'])expect(requests.some(u=>u.endsWith(`/models/${file}`))).toBe(true);
  const depth=page.getByLabel('연속 해부 박리 깊이');
  // Muscles are fading: every ligament and supplement tendon is present.
  await depth.fill('66');await ready(page);
  await expect.poll(async()=>[...await visible(page)].filter(id=>id.startsWith('ZA_ligament_')).length).toBe(358);
  expect([...await visible(page)].filter(id=>id.startsWith('ZA_tendon_')).length).toBe(58);
  // Ligaments leave with the skeleton; nothing of theirs remains at 90%.
  await depth.fill('90');await ready(page);
  await expect.poll(async()=>[...await visible(page)].filter(id=>maleIds.has(id)).length).toBe(0);
  await depth.fill('66');await ready(page);await settledCamera(page);
  const before=await snapshot(page);
  await openDisplay(page);
  const toggle=page.getByRole('checkbox',{name:/인대·힘줄 표시/});
  await expect(toggle).toBeChecked();
  await expect(page.locator('.connective-setting')).toContainText(`${maleIds.size}개`);
  await toggle.uncheck();await ready(page);
  await expect.poll(async()=>[...await visible(page)].filter(id=>maleIds.has(id)).length).toBe(0);
  const hidden=await snapshot(page);
  expect(hidden.connective).toBe(false);expect(hidden.camera).toEqual(before.camera);expect(hidden.markers).toBe(before.markers);expect(hidden.dissection).toBe(66);
  await toggle.check();await ready(page);
  await expect.poll(async()=>[...await visible(page)].filter(id=>id.startsWith('ZA_ligament_')).length).toBe(358);
  // Only ligaments and tendons, then back to the same peel.
  await page.getByRole('button',{name:'인대·힘줄만 보기'}).click();await ready(page);
  const card=page.getByRole('region',{name:'선택 구조 조작'});
  await expect(card).toContainText(`인대·힘줄 ${maleIds.size}개 구조`);
  await expect(card).toContainText('대부분의 힘줄은 근육 모형에 포함');
  await expect.poll(async()=>{const ids=await visible(page);return ids.size===maleIds.size&&[...ids].every(id=>maleIds.has(id));}).toBe(true);
  await page.screenshot({path:'docs/anatomy-expansion/connective-only-desktop.png'});
  await settledCamera(page);const studied=(await snapshot(page)).camera;
  await card.getByRole('button',{name:'구조 선택 해제',exact:true}).click();await ready(page);await settledCamera(page);
  // Clearing returns to the same peel; the camera stays where the viewer was looking.
  const back=await snapshot(page);
  expect(back.selection).toBe(null);expect(back.dissection).toBe(66);expect(back.displayMode).toBe('dissection');
  for(const key of ['position','target'] as const)for(let axis=0;axis<3;axis++)expect(back.camera[key][axis]).toBeCloseTo(studied[key][axis],6);
  // Search keeps English, TA2 Latin and the source hierarchy; the card names the tissue kind.
  const input=page.getByLabel('경혈·구조 검색');await input.click();await input.fill('Ligamentum cruciatum anterius');
  const result=page.locator('.structure-item').filter({hasText:'오른쪽 앞십자인대'});
  await expect(result).toContainText('Anterior cruciate ligament (right)');
  await result.click();await ready(page);
  await expect(card.locator('.selection-kind')).toHaveText('선택 구조 · 인대');
  await expect(card).toContainText('TA2 · Ligamentum cruciatum anterius');
  await page.screenshot({path:'docs/anatomy-expansion/connective-acl-desktop.png'});
  expect(errors).toEqual([]);
});

test('female reference shows only its source knee ligaments, menisci and quadriceps tendons',async({page})=>{
  test.setTimeout(180000);
  await page.goto('/');await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await openDisplay(page);
  await expect(page.locator('.connective-setting')).toContainText(`${femaleIds.size}개`);
  await expect(page.locator('.connective-setting')).toContainText('무릎 인대·반달연골');
  await page.getByRole('button',{name:'인대·힘줄만 보기'}).click();await ready(page);
  await expect.poll(async()=>{const ids=await visible(page);return ids.size===femaleIds.size&&[...ids].every(id=>femaleIds.has(id));}).toBe(true);
  await closeTool(page);
});

test('the ligament setting and its view fit a phone without replacing the scene',async({page})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');await ready(page);
  await openDisplay(page);
  const panel=await page.locator('.ax-panel').boundingBox(),canvas=await page.locator('canvas').boundingBox();
  expect(panel!.height).toBeLessThanOrEqual(canvas!.height*.45+1);
  await page.locator('.connective-setting').scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'인대·힘줄만 보기'})).toBeInViewport();
  await page.getByRole('button',{name:'인대·힘줄만 보기'}).click();await ready(page);
  await expect(page.locator('.ax-panel')).toHaveCount(0);
  const card=page.getByRole('region',{name:'선택 구조 조작'});
  await expect(card.getByRole('button',{name:'구조 선택 해제',exact:true})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'docs/anatomy-expansion/connective-only-mobile.png'});
});
