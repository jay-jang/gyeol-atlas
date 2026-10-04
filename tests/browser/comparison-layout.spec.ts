import fs from 'node:fs';
import {test,expect} from '@playwright/test';
import {ready,compare,snapshot,choosePoint} from './helpers';
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
    await expect(page.locator('.ax-depth')).toBeVisible();
  }
});

test('female organ comparisons use the female body and keep the CT stomach one explicit choice away',async({page})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width:390,height:844});
  const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
  await page.goto('/#atlas/CV12');await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await compare(page);
  // The carried stomach joins the overview comparison and says where it comes from.
  expect((await snapshot(page)).selection.ids).toEqual(['FT_FMA7148']);
  await expect(page.locator('[data-carried-comparison]')).toContainText('남성 원본을 여성 골격·피부 대응으로 옮긴');
  const link=page.getByRole('button',{name:'위 (여성 CT) 상세',exact:true});
  await expect(link).toBeVisible(); await expect(link).toBeInViewport();
  // The card and the camera column stay above the wrapped female marker note.
  const bar=await page.locator('.ax-point-bar').boundingBox();
  for(const sel of ['.ax-inspector','.ax-camera']){const b=await page.locator(sel).boundingBox();expect(b!.y+b!.height,sel).toBeLessThanOrEqual(bar!.y-4);}
  await page.screenshot({path:'docs/anatomy-alignment/comparison-female-ct-mobile.png'});
  expect(requests.filter(u=>u.includes('/female-detail/'))).toHaveLength(0);
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
  await expect(page.getByRole('button',{name:/여성 CT/})).toHaveCount(0);
  // Colon, small intestine and gallbladder compare the HRA female organs, not a "no model" notice.
  const {counterparts}=JSON.parse(fs.readFileSync('data/female-comparison-counterparts.json','utf8'));
  const biliary=JSON.parse(fs.readFileSync('data/female-biliary-groups.json','utf8'))[0].ids;
  for(const [point,ids] of [['LI4',counterparts.FMA14543nsn.ids],['SI4',['FMA7206','FMA7207','FMA7208'].flatMap(id=>counterparts[id].ids)],['GB24',biliary]] as const){
    await choosePoint(page,point);await compare(page);
    expect([...(await snapshot(page)).selection.ids].sort(),point).toEqual([...ids].sort());
    await expect(page.locator('[data-carried-comparison]')).toHaveCount(0);
    await expect(page.locator('.selection-card')).toBeInViewport();
  }
  await page.screenshot({path:'docs/anatomy-alignment/comparison-female-gallbladder-mobile.png'});
});
