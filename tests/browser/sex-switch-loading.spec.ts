import {test,expect} from '@playwright/test';
import {ready,snapshot} from './helpers';

test('switching to female removes male organs even while the female geometry is delayed',async({page})=>{
  test.setTimeout(120000);
  const errors:string[]=[];let fiberUrl='';
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/\/@react-three_fiber\.js\?/.test(request.url()))fiberUrl=request.url();});
  let releaseFemale!:()=>void;
  const gate=new Promise<void>(resolve=>{releaseFemale=resolve;});
  let delayed=false;
  await page.route('**/models/female/female-0.bin.gz',async route=>{
    delayed=true;
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/');await ready(page);
    await page.getByRole('button',{name:'장기 빠른 보기',exact:true}).click();await ready(page);
    await expect.poll(async()=>{
      const ids=await page.locator('canvas').getAttribute('data-visible-structure-ids');
      return (ids||'').split(',').includes('FMA7148');
    }).toBe(true);
    expect(fiberUrl).not.toBe('');
    expect(await page.evaluate(async url=>{
      const {_roots}=await import(/* @vite-ignore */url);
      const root=_roots.get(document.querySelector('canvas'));
      return Boolean(root.store.getState().scene.getObjectByName('FMA7148'));
    },fiberUrl)).toBe(true);
    const request=page.waitForRequest(request=>request.url().includes('/models/female/female-0.bin.gz'));
    await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();
    await request;
    expect(delayed).toBe(true);
    expect((await snapshot(page)).sex).toBe('female');
    const maleOrgan=await page.evaluate(async url=>{
      const {_roots}=await import(/* @vite-ignore */url);
      const root=_roots.get(document.querySelector('canvas'));
      const object=root.store.getState().scene.getObjectByName('FMA7148');
      return object?{visible:object.visible,parentVisible:object.parent?.visible??false}:null;
    },fiberUrl);
    expect(maleOrgan).toBeNull();
    await expect(page.locator('canvas')).not.toHaveAttribute('data-visible-structure-ids',/FMA7148/);
  } finally {
    releaseFemale();
  }
  await ready(page);
  await expect(page.locator('canvas')).toHaveAttribute('data-model-sex','female');
  await expect.poll(async()=>Number(await page.locator('canvas').getAttribute('data-visible-skin'))).toBe(20);
  expect(errors).toEqual([]);
});
