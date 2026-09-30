import {test,expect} from '@playwright/test';
import {ready,openTool,closeTool,snapshot} from './helpers';
import {detailProjection} from './detail-projection';

test.use({viewport:{width:1440,height:900}});

for(const sex of ['male','female'] as const)test(`${sex}: selection remains opaque without overwriting layer opacity preferences`,async({page})=>{
  test.setTimeout(150000);
  let fiberUrl='';const errors:string[]=[];
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await ready(page);
  if(sex==='female'){await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);}
  await page.getByRole('button',{name:'장기 빠른 보기',exact:true}).click();await ready(page);
  await openTool(page,'레이어 조절');await page.getByLabel('장기 레이어 불투명도').fill('0.08');await closeTool(page);
  await openTool(page,'구조 찾기');await page.getByLabel('경혈·구조 검색').fill(sex==='male'?'FMA7148':'liver');
  const item=page.locator('.structure-item').filter({hasText:sex==='male'?'FMA7148':'HRAF'}).first();
  await item.click();await ready(page);await closeTool(page);
  const selected=(await snapshot(page)).selection.ids;
  const inspect=()=>page.evaluate(async({url,ids})=>{
    const {_roots}=await import(/* @vite-ignore */url),state=_roots.get(document.querySelector('canvas')).store.getState(),rows:any[]=[];
    state.scene.updateMatrixWorld(true);
    state.scene.traverseVisible((mesh:any)=>{
      if(!mesh.isMesh||(!ids.includes(mesh.name)&&!ids.includes(mesh.parent?.name)))return;
      mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      rows.push({name:mesh.name,opacity:mesh.material.opacity,transparent:mesh.material.transparent,bounds:[...box.min.toArray(),...box.max.toArray()]});
    });return rows;
  },{url:fiberUrl,ids:selected});
  const before=await inspect();expect(before.length).toBeGreaterThan(0);
  await expect.poll(async()=>(await detailProjection(page,fiberUrl)).clearance).toBeGreaterThan(0);
  await page.screenshot({path:`docs/anatomy-alignment/selection-opacity-${sex}-desktop.png`});
  expect(before.every(m=>m.opacity===1&&!m.transparent)).toBe(true);
  expect((await snapshot(page)).alpha.organ).toBe(.08);
  await page.setViewportSize({width:390,height:844});await page.locator('.selection-actions').getByRole('button',{name:'확대',exact:true}).click();
  await expect.poll(async()=>(await detailProjection(page,fiberUrl)).clearance).toBeGreaterThan(0);
  await expect(page.getByRole('button',{name:'구조 선택 해제',exact:true})).toBeInViewport();
  await page.screenshot({path:`docs/anatomy-alignment/selection-opacity-${sex}-mobile.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const mobile=await inspect();expect(mobile.map(m=>m.bounds)).toEqual(before.map(m=>m.bounds));
  await page.getByRole('button',{name:'구조 선택 해제',exact:true}).click();await ready(page);
  expect((await snapshot(page)).alpha.organ).toBe(.08);
  await expect.poll(async()=>(await inspect()).every(m=>Math.abs(m.opacity-.08)<1e-9)).toBe(true);
  const cleared=await inspect();expect(cleared.length).toBe(before.length);expect(cleared.map(m=>m.bounds)).toEqual(before.map(m=>m.bounds));
  expect(errors).toEqual([]);
});
