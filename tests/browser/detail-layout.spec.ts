import {test,expect} from '@playwright/test';
import {ready, snapshot} from './helpers';
import {detailProjection} from './detail-projection';
import maleGroups from '../../data/male-organ-groups.json' with {type:'json'};
import femaleGroups from '../../data/female-organ-groups.json' with {type:'json'};
import ctGroups from '../../data/female-detail-groups.json' with {type:'json'};

for (const sample of [
  {sex:'남성',name:'심장',id:'male-heart'},
  {sex:'여성',name:'뇌',id:'female-brain'},
  {sex:'여성',name:'위 (여성 CT)',id:'female-ct'},
]) test(`${sample.id} detail remains above its card and presets retain organ focus`,async({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:1440,height:900});
  let fiberUrl=''; page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  await page.goto('/'); await ready(page);
  await page.locator('.explore-sidebar').getByRole('button',{name:sample.sex,exact:true}).click(); await ready(page);
  await page.locator('.featured-anatomy > button').filter({has:page.getByText(sample.name,{exact:true})}).click(); await ready(page);
  const inspect=()=>detailProjection(page,fiberUrl);
  const unobscured=async()=>{
    await expect.poll(async()=>(await inspect()).clearance).toBeGreaterThan(4);
    await expect.poll(async()=>(await inspect()).targetError).toBeLessThan(.001);
    await expect.poll(async()=>(await inspect()).canvasClearance).toBeGreaterThan(0);
  };
  await unobscured();
  const parts=page.locator('.organ-detail-parts summary');
  if(await parts.count()) {
    await parts.click(); await unobscured();
    await page.locator('.organ-detail-parts button').first().click(); await ready(page);
    expect((await snapshot(page)).selection.ids).toHaveLength(1); await unobscured();
    await page.getByRole('button',{name:'기관 전체 모형',exact:true}).click(); await ready(page); await unobscured();
  }
  const source=page.locator('.ct-source-details summary');
  if(await source.count()) {await source.click(); await unobscured(); await source.click();}
  for(const name of ['후면','측면','정면']) {
    await page.locator('.view-presets').getByRole('button',{name,exact:true}).click();
    await unobscured();
  }
  await page.getByRole('button',{name:'시점 초기화',exact:true}).click(); await unobscured();
  await page.screenshot({path:`docs/anatomy-alignment/detail-layout-${sample.id}.png`});
  await page.getByRole('button',{name:'축소',exact:true}).click();
  const before=(await snapshot(page)).camera;
  await page.reload(); await ready(page);
  expect((await snapshot(page)).camera).toEqual(before);
  await page.setViewportSize({width:390,height:844});
  await unobscured();
  await page.screenshot({path:`docs/anatomy-alignment/detail-layout-${sample.id}-mobile.png`});
  await page.setViewportSize({width:844,height:390});
  await page.screenshot({path:`docs/anatomy-alignment/detail-layout-${sample.id}-landscape.png`});
  await unobscured();
  if(await parts.count()) {
    await parts.click(); await unobscured();
    await page.locator('.organ-detail-parts button').first().click(); await ready(page);
    expect((await snapshot(page)).selection.ids).toHaveLength(1); await unobscured();
    await page.getByRole('button',{name:'기관 전체 모형',exact:true}).click(); await ready(page); await unobscured();
  }
  await page.screenshot({path:`docs/anatomy-alignment/detail-layout-${sample.id}-landscape.png`});
  await expect(page.getByRole('button',{name:'전신으로 돌아가기',exact:true})).toBeInViewport();
  await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click(); await ready(page);
  await expect(page.locator('.explore-sidebar')).toBeVisible();
});

test('every major organ detail fits beside its collapsed and expanded card',async({page})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width:1440,height:900});
  let fiberUrl=''; page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  await page.goto('/'); await ready(page);
  for(const [sex,groups] of [['남성',maleGroups],['여성',[...femaleGroups,...ctGroups]]] as const) {
    await page.locator('.explore-sidebar').getByRole('button',{name:sex,exact:true}).click(); await ready(page);
    for(const group of groups) {
      await page.locator('.featured-anatomy > button').filter({has:page.getByText(group.name,{exact:true})}).click(); await ready(page);
      const parts=page.locator('.organ-detail-parts');
      if(await parts.count() && await parts.getAttribute('open')!==null) await parts.locator('summary').click();
      for(const expanded of [false,true]) {
        if(expanded && await parts.count()) await parts.locator('summary').click();
        await expect.poll(async()=>(await detailProjection(page,fiberUrl)).clearance,`${sex}/${group.id}/${expanded}`).toBeGreaterThan(4);
        await expect.poll(async()=>(await detailProjection(page,fiberUrl)).canvasClearance).toBeGreaterThan(0);
      }
    }
  }
});
