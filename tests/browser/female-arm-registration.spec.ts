import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute} from 'three';
import {applyFemaleArmRegistration} from '../../src/female-arm-registration';
import {applyFemaleFootRegistration} from '../../src/female-foot-registration';
import {ready,snapshot,openTool} from './helpers';

const atlas=JSON.parse(fs.readFileSync('public/models/female/atlas-female.json','utf8'));
const buffers=atlas.chunks.map((c:any)=>gunzipSync(fs.readFileSync(`public/models/female/${c.gzip.split('/').pop()}`)));
const expected=Object.fromEntries(atlas.parts.map((p:any)=>{
  const b=buffers[p.chunk],g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+i*4)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+i*4)),1));
  applyFemaleArmRegistration(g,'female',p.id,p.system);
  applyFemaleFootRegistration(g,'female',p.id,p.system);
  const hash=createHash('sha256').update(Buffer.from(g.attributes.position.array.buffer)).digest('hex');
  g.dispose();return [p.id,hash];
}));

test('female arm and toe rest poses match calibrated geometry through peeling, search, reload and sex changes',async({page})=>{
  test.setTimeout(180000);let fiberUrl='';const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  await page.goto('/');await ready(page);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  const geometryHashes=()=>page.evaluate(async({url,ids})=>{
    const module=await import(/* @vite-ignore */ url),state=module._roots.get(document.querySelector('canvas')).store.getState();
    const result:Record<string,string>={};let calibrated=0;
    for(const id of ids){
      const mesh=state.scene.getObjectByName(id);
      if(!mesh?.isMesh)throw new Error(`Missing ${id}`);
      if(!mesh.matrix.equals(mesh.matrix.clone().identity()))throw new Error(`Unexpected local placement ${id}`);
      const values=mesh.geometry.attributes.position.array.slice();
      const digest=await crypto.subtle.digest('SHA-256',values.buffer);
      result[id]=Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');
      if(mesh.geometry.userData.femaleArmRegistration)calibrated++;
    }
    return {hashes:result,calibrated};
  },{url:fiberUrl,ids:Object.keys(expected)});
  expect(await geometryHashes()).toEqual({hashes:expected,calibrated:60});
  for(const depth of ['0.5','44.5','64','98']){
    await page.getByLabel('연속 해부 박리 깊이').fill(depth);await ready(page);
    expect(await geometryHashes()).toEqual({hashes:expected,calibrated:60});
  }
  for(const id of ['BM0078','BM0064','BM0069','BM0126','BM0154']){
    await openTool(page,'구조 찾기');await page.getByLabel('해부 구조 검색').fill(id);
    await page.locator('.structure-item').filter({hasText:id}).click();await ready(page);
    expect((await snapshot(page)).layers.bone).toBe(true);
    await page.getByRole('button',{name:'선택 구조 확대',exact:true}).click();
    await expect.poll(()=>page.evaluate(async ({url,id})=>{
      const module=await import(/* @vite-ignore */ url),s=module._roots.get(document.querySelector('canvas')).store.getState();
      const mesh=s.scene.getObjectByName(id);mesh.geometry.computeBoundingBox();
      const centre=mesh.geometry.boundingBox.getCenter(s.controls.target.clone());
      return centre.distanceTo(s.controls.target);
    },{url:fiberUrl,id})).toBeLessThan(.001);
    await page.screenshot({path:id==='BM0078'?'docs/anatomy-alignment/female-arm-selected.png':`docs/anatomy-alignment/female-${['BM0126','BM0154'].includes(id)?'toe':'thumb'}-${id}.png`});
    if(id==='BM0154'){
      await page.setViewportSize({width:390,height:844});
      await page.screenshot({path:'docs/anatomy-alignment/female-toe-selected-mobile.png'});
      expect(await geometryHashes()).toEqual({hashes:expected,calibrated:60});
      await page.setViewportSize({width:1440,height:1100});
    }
  }
  const pose=(await snapshot(page)).camera;await page.reload();await ready(page);
  const restored=(await snapshot(page)).camera;
  // OrbitControls can round-trip spherical coordinates by one floating-point
  // ULP. Keep sub-picometre camera tolerance; geometry hashes stay exact.
  for(const key of ['position','target'])for(let i=0;i<3;i++)expect(restored[key][i]).toBeCloseTo(pose[key][i],12);
  expect(await geometryHashes()).toEqual({hashes:expected,calibrated:60});
  await page.locator('.explore-sidebar').getByRole('button',{name:'남성',exact:true}).click();await ready(page);
  await expect.poll(()=>page.evaluate(async({url,ids})=>{
    const module=await import(/* @vite-ignore */ url),s=module._roots.get(document.querySelector('canvas')).store.getState();
    return ids.filter(id=>s.scene.getObjectByName(id)?.isMesh).length;
  },{url:fiberUrl,ids:Object.keys(expected)})).toBe(0);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  expect(await geometryHashes()).toEqual({hashes:expected,calibrated:60});
  await page.getByRole('button',{name:'골격 빠른 보기',exact:true}).click();await ready(page);
  await page.getByRole('button',{name:'계통 전체 보기',exact:true}).click();
  await page.screenshot({path:'docs/anatomy-alignment/female-arms-registered.png'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'docs/anatomy-alignment/female-arms-registered-mobile.png'});
  expect(errors).toEqual([]);
});
