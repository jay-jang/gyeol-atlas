import {test,expect} from '@playwright/test';
import {ready,snapshot} from './helpers';
test('female source restoration failure shows an error and retry loads the restored source without a male substitute',async({page})=>{
  test.setTimeout(90000);let fiberUrl='';
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  const route='**/models/female-source-restoration/right-ilium.bin.gz';
  await page.route(route,r=>r.fulfill({status:503,body:'Unavailable'}));
  await page.goto('/');await ready(page);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('3D 모델을 열지 못했습니다');
  await expect(page.locator('canvas')).toHaveCount(0);expect((await snapshot(page)).sex).toBe('female');
  await page.unroute(route);await page.getByRole('button',{name:'3D 다시 시도',exact:true}).click();await ready(page);
  await expect(page.locator('canvas')).toHaveAttribute('data-female-atlas-parts','1220');
  expect(await page.evaluate(async url=>{
    const module=await import(/* @vite-ignore */ url),scene=module._roots.get(document.querySelector('canvas')).store.getState().scene;
    return scene.getObjectByName('HRAF0827').geometry.attributes.position.count;
  },fiberUrl)).toBe(5907);
});
