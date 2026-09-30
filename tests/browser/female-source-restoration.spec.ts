import {test,expect} from '@playwright/test';
import {ready,openTool,closeTool,snapshot} from './helpers';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import spec from '../../data/catalog/female-source-restoration.json' with {type:'json'};
const expectedHash=createHash('sha256').update(gunzipSync(fs.readFileSync(`public/${spec.url}`))).digest('hex');
test('female native source surface remains unchanged across all 201 peel values and selection restoration',async({page})=>{
  test.setTimeout(300000);let fiberUrl='';const errors:string[]=[],requests:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{requests.push(r.url());if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  await page.goto('/#wiki');await expect(page.getByRole('heading',{name:'위키에 물어보기'})).toBeVisible();
  expect(requests.some(url=>url.includes('/models/female-source-restoration/'))).toBe(false);
  await page.getByRole('link',{name:'3D 경혈 지도',exact:true}).click();await ready(page);
  expect(requests.some(url=>url.includes('/models/female-source-restoration/'))).toBe(false);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  const actual=()=>page.evaluate(async({url})=>{
    const module=await import(/* @vite-ignore */ url),canvas=document.querySelector('canvas')!;
    const scene=module._roots.get(canvas).store.getState().scene,mesh=scene.getObjectByName('HRAF0827');
    const g=mesh.geometry;
    const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',g.attributes.position.array.buffer));
    return {vertices:g.attributes.position.count,indices:g.index.count,tag:g.userData.femaleSourceRestoration,
      sharedBuffer:g.attributes.normal.array.buffer===g.attributes.position.array.buffer&&g.index.array.buffer===g.attributes.position.array.buffer,
      offsets:[g.attributes.position.array.byteOffset,g.attributes.normal.array.byteOffset,g.index.array.byteOffset],normalCount:g.attributes.normal.count,
      hash:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')};
  },{url:fiberUrl});
  const initial=await actual();expect(initial).toEqual({vertices:5907,indices:35430,normalCount:5907,sharedBuffer:true,offsets:[0,70884,141768],tag:`${spec.version}/HRAF0827`,hash:expectedHash});
  for(let step=0;step<=200;step++){
    await page.getByLabel('연속 해부 박리 깊이').fill(String(step*.5));
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(step*.5);
    expect(await actual()).toEqual(initial);
    if(step%50===0)console.log(`Verified source buffers at peel ${step*.5}%`);
  }
  await openTool(page,'구조 찾기');await page.getByLabel('경혈·구조 검색').fill('HRAF0827');await page.locator('.structure-item').click();await ready(page);await closeTool(page);
  const card=page.getByRole('region',{name:'선택 구조 조작'});
  await card.getByRole('button',{name:'선택 구조만 보기',exact:true}).click();await ready(page);
  await card.getByRole('button',{name:'확대',exact:true}).click();
  for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390]] as const){
    await page.setViewportSize({width,height});await page.waitForTimeout(1000);
    await expect(card.getByRole('button',{name:'구조 선택 해제',exact:true})).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`docs/ui-renewal/female-ilium-source-${name}.png`});
    expect(await actual()).toEqual(initial);
  }
  await page.reload();await ready(page);expect(await actual()).toEqual(initial);
  expect((await snapshot(page)).selection.ids).toEqual(['HRAF0827']);
  await page.setViewportSize({width:1440,height:900});
  await page.locator('.ax-top').getByRole('button',{name:'남성',exact:true}).click();await ready(page);
  expect((await snapshot(page)).selection).toBe(null);expect(errors).toEqual([]);
});
