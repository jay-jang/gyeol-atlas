import {test,expect} from '@playwright/test';
import {ready,openTool,closeTool,snapshot} from './helpers';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import spec from '../../data/catalog/female-knee-source-restoration.json' with {type:'json'};
const expectedHash=createHash('sha256').update(gunzipSync(fs.readFileSync(`public/${spec.url}`))).digest('hex');
test('38 female knee source surfaces retain buffers and placement through all 201 peel values and selection',async({page})=>{
  test.setTimeout(600000);let fiberUrl='';const errors:string[]=[],requests:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{requests.push(r.url());if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  await page.goto('/#wiki');await expect(page.getByRole('heading',{name:'위키에 물어보기'})).toBeVisible();
  expect(requests.some(url=>url.includes(spec.url))).toBe(false);
  await page.getByRole('link',{name:'3D 경혈 지도',exact:true}).click();await ready(page);
  expect(requests.some(url=>url.includes(spec.url))).toBe(false);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  const actual=()=>page.evaluate(async({url,ids})=>{
    const module=await import(/* @vite-ignore */ url),state=module._roots.get(document.querySelector('canvas')).store.getState();
    state.scene.updateMatrixWorld(true);const first=state.scene.getObjectByName(ids[0]).geometry.attributes.position.array.buffer;
    const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',first));
    return {hash:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''),meshes:ids.map(id=>{
      const mesh=state.scene.getObjectByName(id),g=mesh.geometry;
      return {id,vertices:g.attributes.position.count,indices:g.index.count,normals:g.attributes.normal.count,tag:g.userData.femaleKneeSourceRestoration,
        shared:g.attributes.position.array.buffer===first&&g.attributes.normal.array.buffer===first&&g.index.array.buffer===first,
        offsets:[g.attributes.position.array.byteOffset,g.attributes.normal.array.byteOffset,g.index.array.byteOffset],matrix:mesh.matrix.toArray(),world:mesh.matrixWorld.toArray()};
    })};
  },{url:fiberUrl,ids:spec.records.map(r=>r.id)});
  const initial=await actual();expect(initial.hash).toBe(expectedHash);
  for(const [i,r] of spec.records.entries())expect(initial.meshes[i]).toMatchObject({id:r.id,vertices:r.vertexCount,indices:r.indexCount,normals:r.vertexCount,shared:true,offsets:[r.positions,r.normals,r.indices],tag:`${spec.version}/${r.id}`,matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]});
  for(let step=0;step<=200;step++){
    await page.getByLabel('연속 해부 박리 깊이').fill(String(step*.5));
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(step*.5);expect(await actual()).toEqual(initial);
    if(step%50===0)console.log(`Verified all 38 knee buffers/matrices at ${step*.5}%`);
  }
  for(const id of ['HRAF0954','HRAF0927']){
    await openTool(page,'구조 찾기');await page.getByLabel('해부 구조 검색').fill(id);await page.locator('.structure-item').click();await ready(page);await closeTool(page);
    expect((await snapshot(page)).layers.bone).toBe(true);expect((await snapshot(page)).selection.ids).toEqual([id]);expect(await actual()).toEqual(initial);
  }
  const card=page.getByRole('region',{name:'선택 구조 조작'});
  await card.getByRole('button',{name:'선택 구조만 보기',exact:true}).click();await ready(page);await card.getByRole('button',{name:'확대',exact:true}).click();
  for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844]] as const){
    await page.setViewportSize({width,height});await page.waitForTimeout(1000);
    await expect(card.getByRole('button',{name:'구조 선택 해제',exact:true})).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`docs/anatomy-alignment/female-knee-source-${name}.png`});expect(await actual()).toEqual(initial);
  }
  await page.reload();await ready(page);expect(await actual()).toEqual(initial);expect((await snapshot(page)).selection.ids).toEqual(['HRAF0927']);
  await page.setViewportSize({width:1440,height:900});
  await page.locator('.explore-sidebar').getByRole('button',{name:'남성',exact:true}).click();await ready(page);expect((await snapshot(page)).selection).toBe(null);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);expect(await actual()).toEqual(initial);expect(errors).toEqual([]);
});
test('knee source fetch failure is visible and retry restores female source geometry',async({page})=>{
  let fiberUrl='';page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  const route=`**/${spec.url}`;await page.route(route,r=>r.fulfill({status:503,body:'Unavailable'}));
  await page.goto('/');await ready(page);await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('3D 모델을 열지 못했습니다');
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.unroute(route);await page.getByRole('button',{name:'3D 다시 시도',exact:true}).click();await ready(page);
  expect((await snapshot(page)).sex).toBe('female');
  expect(await page.evaluate(async url=>{
    const module=await import(/* @vite-ignore */ url),scene=module._roots.get(document.querySelector('canvas')).store.getState().scene;
    return scene.getObjectByName('HRAF0954').geometry.attributes.position.count;
  },fiberUrl)).toBe(1747);
});
