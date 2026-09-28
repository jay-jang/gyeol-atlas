import {test,expect} from '@playwright/test';
import {ready,snapshot,choosePoint} from './helpers';

for(const scenario of [
  {sex:'남성',name:'심장'},
  {sex:'여성',name:'뇌'},
  {sex:'여성',name:'위 (여성 CT)'},
] as const)test(`${scenario.sex} ${scenario.name}: direct detail return restores its original camera after reload`,async({page})=>{
  test.setTimeout(150000);
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  if(scenario.sex==='여성')await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();
  await ready(page);
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5');await ready(page);
  const before=await snapshot(page),canvas=page.locator('canvas');
  const ids=await canvas.getAttribute('data-visible-structure-ids');
  await page.locator('.featured-anatomy > button').filter({has:page.getByText(scenario.name,{exact:true})}).click();await ready(page);
  expect((await snapshot(page)).detailReturn.camera).toEqual(before.camera);
  await page.reload();await ready(page);
  expect((await snapshot(page)).detailReturn.camera).toEqual(before.camera);
  await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();await ready(page);
  await expect.poll(async()=>{
    const after=await snapshot(page);
    return Math.max(...['position','target'].flatMap(key=>after.camera[key].map((value:number,i:number)=>Math.abs(value-before.camera[key][i]))));
  }).toBeLessThan(1e-6);
  const after=await snapshot(page);
  expect(after.dissection).toBe(50.5);
  expect(after.detail).toBe(null);
  await expect(canvas).toHaveAttribute('data-visible-structure-ids',ids!);
});

test('a point chosen from a directly opened heart detail returns to the original camera',async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5');await ready(page);
  const before=await snapshot(page);
  await page.locator('.featured-anatomy > button').filter({has:page.getByText('심장',{exact:true})}).click();await ready(page);
  await choosePoint(page,'ST36');await ready(page);
  await expect.poll(async()=>{
    const after=await snapshot(page);
    return Math.max(...['position','target'].flatMap(key=>after.camera[key].map((value:number,i:number)=>Math.abs(value-before.camera[key][i]))));
  }).toBeLessThan(1e-6);
  const after=await snapshot(page);
  expect(after.pointId).toBe('ST36');
  expect(after.dissection).toBe(50.5);
  expect(after.detail).toBe(null);
});

for(const scenario of [
  {sex:'남성',name:'심장',source:'male'},
  {sex:'여성',name:'뇌',source:'female'},
  {sex:'여성',name:'위 (여성 CT)',source:'female-detail'},
] as const)test(`${scenario.sex} ${scenario.name}: detail return restores the actual 50.5% peel`,async({page})=>{
  test.setTimeout(150000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  if(scenario.sex==='여성')await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();
  await ready(page);
  const depth=page.getByLabel('연속 해부 박리 깊이'),canvas=page.locator('canvas');
  await depth.fill('50.5');await ready(page);
  const before=await snapshot(page);
  const visibleBefore=await canvas.getAttribute('data-visible-structure-ids');
  expect(before.displayMode).toBe('dissection');expect(before.dissection).toBe(50.5);
  expect(before.layers.muscle).toBe(true);expect(before.layers.bone).toBe(true);
  await page.locator('.featured-anatomy > button').filter({has:page.getByText(scenario.name,{exact:true})}).click();await ready(page);
  let inside=await snapshot(page);
  expect(inside.detail).toBeTruthy();expect(inside.detailReturn.dissection).toBe(50.5);
  expect(inside.displayMode).toBe('layers');
  await expect(canvas).toHaveAttribute('data-visible-structure-ids',new RegExp('.+'));
  if(scenario.source==='female-detail'){
    await expect(canvas).toHaveAttribute('data-female-detail-parts','11');
    await page.reload();await ready(page);
    inside=await snapshot(page);
    expect(inside.detailReturn.dissection).toBe(50.5);
  }
  await page.screenshot({path:`docs/anatomy-alignment/detail-peel-${scenario.source}-${scenario.name==='뇌'?'brain':scenario.name==='심장'?'heart':'stomach'}-open.png`});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();await ready(page);
  const after=await snapshot(page);
  expect(after.detail).toBe(null);expect(after.detailReturn).toBe(null);expect(after.selection).toBe(null);
  for(const key of ['sex','anatomyRegion','stage','dissection','displayMode','layers','alpha','markers','pointId','selectionTarget'])
    expect(after[key],key).toEqual(before[key]);
  await expect(canvas).toHaveAttribute('data-visible-structure-ids',visibleBefore!);
  if(scenario.sex==='여성'){
    await expect(canvas).toHaveAttribute('data-female-atlas-parts','1220');
    expect(visibleBefore!.split(',').every(id=>!id.startsWith('ZA_')&&!id.startsWith('BP4_')&&!id.startsWith('FMA'))).toBe(true);
  }
  const rect=await canvas.boundingBox();expect(rect!.height).toBeGreaterThan(400);
  await page.screenshot({path:`docs/anatomy-alignment/detail-peel-${scenario.source}-${scenario.name==='뇌'?'brain':scenario.name==='심장'?'heart':'stomach'}-returned-mobile.png`});
  expect(errors).toEqual([]);
});

test('selecting a point from heart detail restores peel layers and whole-body framing',async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  const depth=page.getByLabel('연속 해부 박리 깊이'),canvas=page.locator('canvas');
  await depth.fill('50.5');await ready(page);
  const ids=await canvas.getAttribute('data-visible-structure-ids');
  await page.locator('.featured-anatomy > button').filter({has:page.getByText('심장',{exact:true})}).click();await ready(page);
  await choosePoint(page,'ST36');await ready(page);
  const state=await snapshot(page);
  expect(state.pointId).toBe('ST36');expect(state.detail).toBe(null);expect(state.detailReturn).toBe(null);
  expect(state.dissection).toBe(50.5);expect(state.displayMode).toBe('dissection');
  await expect(canvas).toHaveAttribute('data-visible-structure-ids',ids!);
  const target=state.camera.target;
  expect(target[1]).toBeGreaterThan(.7);expect(target[1]).toBeLessThan(1.3);
  await page.screenshot({path:'docs/anatomy-alignment/detail-peel-point-return.png'});
});

test('changing body region from female CT detail returns to the same female overview peel',async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5');await ready(page);
  await page.locator('.featured-anatomy > button').filter({has:page.getByText('위 (여성 CT)',{exact:true})}).click();await ready(page);
  await page.getByLabel('전신 부위 선택').selectOption('head');await ready(page);
  const state=await snapshot(page),canvas=page.locator('canvas');
  expect(state.sex).toBe('female');expect(state.anatomyRegion).toBe('head');
  expect(state.detail).toBe(null);expect(state.detailReturn).toBe(null);
  expect(state.displayMode).toBe('dissection');expect(state.dissection).toBe(50.5);
  await expect(canvas).toHaveAttribute('data-female-atlas-parts','1220');
  await expect.poll(async()=>Number(await canvas.getAttribute('data-visible-bone'))).toBeGreaterThan(0);
  expect((await canvas.getAttribute('data-visible-structure-ids')||'').split(',').every(id=>!id.startsWith('CTF_')&&!id.startsWith('BP4_'))).toBe(true);
  await page.getByLabel('연속 해부 박리 깊이').scrollIntoViewIfNeeded();
  await page.screenshot({path:'docs/anatomy-alignment/detail-peel-region-return.png'});
});
