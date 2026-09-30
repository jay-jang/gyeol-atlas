import {test,expect} from '@playwright/test';
import {ready,openTool,closeTool,snapshot} from './helpers';

test('Alt+arrows in a search field do not peel or move the model; canvas focus enables peeling',async({page})=>{
  await page.goto('/');await ready(page);
  await openTool(page,'구조 찾기');const input=page.getByLabel('경혈·구조 검색');await input.fill('stomach');
  const before=await snapshot(page);
  await input.press('Alt+ArrowDown');
  expect((await snapshot(page)).dissection).toBe(before.dissection);
  expect((await snapshot(page)).camera).toEqual(before.camera);
  await input.press('Alt+Shift+ArrowDown');expect((await snapshot(page)).dissection).toBe(before.dissection);
  await input.hover();await page.keyboard.down('Alt');await page.mouse.wheel(0,120);await page.keyboard.up('Alt');
  expect((await snapshot(page)).dissection).toBe(before.dissection);
  await closeTool(page);const canvas=page.locator('canvas');await canvas.focus();await canvas.press('Alt+ArrowDown');
  await expect.poll(async()=>(await snapshot(page)).dissection).toBe(.5);
  const pose=(await snapshot(page)).camera;
  await page.getByRole('button',{name:'도움말',exact:true}).focus();
  await page.keyboard.press('Alt+ArrowDown');expect((await snapshot(page)).dissection).toBe(.5);
  expect((await snapshot(page)).camera).toEqual(pose);
});

test('horizontal wheel over the depth slider leaves depth and camera unchanged',async({page})=>{
  await page.goto('/');await ready(page);
  const slider=page.getByLabel('연속 해부 박리 깊이');await slider.fill('20');await ready(page);await slider.hover();
  const position=await slider.boundingBox();
  const before=await snapshot(page);await page.mouse.wheel(120,0);
  await page.waitForTimeout(200);
  expect((await snapshot(page)).dissection).toBe(20);expect((await snapshot(page)).camera).toEqual(before.camera);
  expect(await slider.boundingBox()).toEqual(position);
  await page.mouse.wheel(0,120);await expect.poll(async()=>(await snapshot(page)).dissection).toBe(20.5);
  expect(await slider.boundingBox()).toEqual(position);
  // Same-task synthetic burst checks reducer composition, alongside real
  // browser wheel gestures above. It is not a hardware-event claim.
  await slider.evaluate(el=>{for(let i=0;i<4;i++)el.dispatchEvent(new WheelEvent('wheel',{deltaY:1,bubbles:true,cancelable:true}));});
  await expect.poll(async()=>(await snapshot(page)).dissection).toBe(22.5);
});

test('movement stops on canvas focus loss even before the held key is released',async({page})=>{
  await page.goto('/');await ready(page);const canvas=page.locator('canvas');await canvas.focus();
  const before=(await snapshot(page)).camera;
  await page.keyboard.down('KeyD');await page.waitForTimeout(350);
  await openTool(page,'구조 찾기');await page.getByLabel('경혈·구조 검색').focus();
  // Camera persistence is debounced during motion: inspect after focus loss,
  // while the physical key is still held, not the stale pre-motion snapshot.
  await expect.poll(async()=>(await snapshot(page)).camera.position[0]).toBeGreaterThan(before.position[0]);
  await page.waitForTimeout(250);const stopped=(await snapshot(page)).camera;
  await page.waitForTimeout(300);expect((await snapshot(page)).camera).toEqual(stopped);
  await page.keyboard.up('KeyD');await page.waitForTimeout(200);expect((await snapshot(page)).camera).toEqual(stopped);
});

test('small Alt+wheel input on the canvas peels one half-step without zooming',async({page})=>{
  await page.goto('/');await ready(page);
  const canvas=page.locator('canvas'),box=(await canvas.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  const before=await snapshot(page);await page.keyboard.down('Alt');await page.mouse.wheel(0,1);await page.keyboard.up('Alt');
  await expect.poll(async()=>(await snapshot(page)).dissection).toBe(.5);
  expect((await snapshot(page)).camera).toEqual(before.camera);
});
