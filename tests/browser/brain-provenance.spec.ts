import {test,expect} from '@playwright/test';
import {ready,snapshot} from './helpers';
import {detailProjection} from './detail-projection';

test('female reference brain exposes provenance for bundle and individual selections',async({page})=>{
  test.setTimeout(120000);
  let fiberUrl='';page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await page.locator('.featured-anatomy > button').filter({has:page.getByText('뇌',{exact:true})}).click();await ready(page);
  const notice=page.locator('[data-brain-provenance]');await expect(notice).toBeVisible();
  expect((await snapshot(page)).selection.ids).toHaveLength(283);
  const fit=async()=>{
    await expect.poll(async()=>(await detailProjection(page,fiberUrl)).clearance).toBeGreaterThan(4);
    await expect.poll(async()=>(await detailProjection(page,fiberUrl)).canvasClearance).toBeGreaterThan(0);
  };
  await notice.locator('summary').click();
  await expect(notice.getByRole('link')).toHaveAttribute('href','https://3d.nih.gov/entries/3DPX-020959');
  for(const [label,width,height] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390]] as const){
    await page.setViewportSize({width,height});await fit();
    await page.screenshot({path:`docs/anatomy-alignment/brain-provenance-${label}.png`});
    await expect(page.getByRole('button',{name:'전신으로 돌아가기',exact:true})).toBeInViewport();
    await notice.getByRole('link').scrollIntoViewIfNeeded();
    await expect(notice.getByRole('link')).toBeInViewport();await fit();
    await expect(page.getByRole('button',{name:'전신으로 돌아가기',exact:true})).toBeInViewport();
    await page.screenshot({path:`docs/anatomy-alignment/brain-provenance-${label}-scrolled.png`});
  }
  await page.setViewportSize({width:1440,height:900});
  await page.locator('.organ-detail-parts summary').click();
  await page.locator('.organ-detail-parts button').first().click();await ready(page);
  expect((await snapshot(page)).selection.ids).toHaveLength(1);await expect(notice).toBeVisible();await fit();
  await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();await ready(page);
  await page.locator('.explore-sidebar').getByRole('button',{name:'남성',exact:true}).click();await ready(page);
  await expect(notice).toHaveCount(0);
});
