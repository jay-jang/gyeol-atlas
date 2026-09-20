import {test,expect} from '@playwright/test';
import {ready,compare,snapshot,choosePoint,closeTool} from './helpers';
import {detailProjection} from './detail-projection';

test('landscape comparisons and isolated bundles remain clear without changing their memberships',async({page})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width:844,height:390});
  let fiberUrl='';page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  await page.goto('/#atlas/CV12');await ready(page);
  for(const [id,count] of [['CV12',1],['KI3',2],['LU9',5]] as const) {
    await choosePoint(page,id); await compare(page);
    const ids=(await snapshot(page)).selection.ids;
    expect(ids).toHaveLength(count);
    for(const isolated of [false,true]) {
      if(isolated) await page.getByRole('button',{name:'비교 대상만 보기',exact:true}).click();
      await page.locator('.selection-card').getByRole('button',{name:'확대',exact:true}).click();
      await expect.poll(async()=>(await detailProjection(page,fiberUrl)).clearance).toBeGreaterThan(4);
      await expect.poll(async()=>(await detailProjection(page,fiberUrl)).canvasClearance).toBeGreaterThan(0);
      expect((await snapshot(page)).selection.ids).toEqual(ids);
      expect((await snapshot(page)).comparison.ids).toEqual(ids);
      expect((await snapshot(page)).detail).toBe(null);
    }
    for(const name of ['후면','측면','정면']) {
      await page.locator('.view-presets').getByRole('button',{name,exact:true}).click();
      await expect.poll(async()=>(await detailProjection(page,fiberUrl)).targetError).toBeLessThan(.001);
      await expect.poll(async()=>(await detailProjection(page,fiberUrl)).clearance).toBeGreaterThan(4);
      await expect.poll(async()=>(await detailProjection(page,fiberUrl)).canvasClearance).toBeGreaterThan(0);
      expect((await snapshot(page)).selection.ids).toEqual(ids);
    }
    await page.screenshot({path:`docs/anatomy-alignment/comparison-${id}-landscape.png`});
    const before=(await snapshot(page)).camera;
    await page.reload();await ready(page);
    expect((await snapshot(page)).selection.ids).toEqual(ids);
    for(const key of ['position','target'] as const)for(let i=0;i<3;i++)expect((await snapshot(page)).camera[key][i]).toBeCloseTo(before[key][i],8);
    await page.getByRole('button',{name:'구조 선택 해제',exact:true}).click();
    await expect(page.locator('.explore-sidebar')).toBeVisible();
  }
});

test('female stomach comparison offers a separate CT detail without replacing the overview until chosen',async({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:390,height:844});
  const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
  await page.goto('/#atlas/CV12');await ready(page);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await compare(page);
  const link=page.getByRole('button',{name:'위 (여성 CT) 별도 상세 보기',exact:true});
  await expect(link).toBeVisible(); await expect(link).toBeInViewport();
  await expect.poll(async()=>{
    const button=await link.boundingBox(),dock=await page.locator('.dock-body').boundingBox();
    return dock!.y+dock!.height-button!.y-button!.height;
  }).toBeGreaterThan(4);
  await expect(page.locator('.comparison-feedback')).toContainText('전신에 합쳐지지 않은');
  await page.screenshot({path:'docs/anatomy-alignment/comparison-female-ct-mobile.png'});
  expect(requests.filter(u=>u.includes('/female-detail/'))).toHaveLength(0);
  expect((await snapshot(page)).comparison).toBe(null);
  await link.click();await ready(page);
  expect((await snapshot(page)).detail.id).toBe('stomach-ct');
  expect((await snapshot(page)).comparison).toBe(null);
  await expect(page.locator('canvas')).toHaveAttribute('data-visible-structure-ids','CTF_stomach');
  await expect(page.locator('canvas')).toHaveAttribute('data-rendered-markers','0');
  await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();await ready(page);
  await expect(page.locator('canvas')).toHaveAttribute('data-female-atlas-parts','1220');
  await choosePoint(page,'KI3');await compare(page);
  expect((await snapshot(page)).selection.ids).toHaveLength(50);
  expect((await snapshot(page)).selection.ids.every((id:string)=>id.startsWith('HRAF'))).toBe(true);
  await page.locator('.point-summary').click(); await expect(link).toHaveCount(0);
  await closeTool(page);
});
