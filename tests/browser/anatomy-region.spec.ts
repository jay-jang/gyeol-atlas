import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {limbSkeletonRegion} from '../../src/anatomy-region';
import {ready,snapshot,openTool,closeTool} from './helpers';
const female=JSON.parse(fs.readFileSync('data/female-atlas-structures.json','utf8'));
const male=JSON.parse(fs.readFileSync('scripts/model-inputs.json','utf8')).assets;

for(const sex of ['male','female'] as const) test(`${sex} limb regions agree with search, rendered meshes, peeling and restore`,async({page})=>{
  test.setTimeout(180000);
  let fiberUrl='';const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  await page.goto('/');await ready(page);
  if(sex==='female') {await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);}
  await page.getByRole('button',{name:'골격 빠른 보기',exact:true}).click();await ready(page);
  const catalog=sex==='female'?female:male;
  const ids=catalog.filter((s:any)=>limbSkeletonRegion(s)).map((s:any)=>s.id);
  const rendered=()=>page.evaluate(async({url,ids})=>{
    const module=await import(/* @vite-ignore */url),s=module._roots.get(document.querySelector('canvas')).store.getState();
    const visible:string[]=[],hashes:Record<string,string>={};
    for(const id of ids) {
      const root=s.scene.getObjectByName(id);if(!root)throw new Error(`Missing ${id}`);
      root.traverse((mesh:any)=>{if(!mesh.isMesh)return;let shown=true;for(let p=mesh;p;p=p.parent)shown=shown&&p.visible;if(shown)visible.push(id);});
      const mesh=root.isMesh?root:root.children.find((o:any)=>o.isMesh);if(!mesh)throw new Error(`No mesh ${id}`);
      const digest=await crypto.subtle.digest('SHA-256',mesh.geometry.attributes.position.array.slice().buffer);
      hashes[id]=Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');
    }
    return {visible:[...new Set(visible)].sort(),hashes};
  },{url:fiberUrl,ids});
  const original=(await rendered()).hashes;
  for(const region of ['upper-limb','lower-limb','abdomen','pelvis','chest','upper-body','lower-body','whole']) {
    await page.getByLabel('전신 부위 선택').selectOption(region);
    const expected=catalog.filter((s:any)=>{
      const limb=limbSkeletonRegion(s);
      return limb&&(region==='whole'||region===limb||region===(limb==='upper-limb'?'upper-body':'lower-body'));
    }).map((s:any)=>s.id).sort();
    await expect.poll(async()=>(await rendered()).visible).toEqual(expected);
    expect((await rendered()).hashes).toEqual(original);
  }
  const searchIds=sex==='female'?['BM0064','BM0069','BM0078','BM0127']:['FMA23951','FMA24459','FMA23131','FMA32651'];
  for(const id of searchIds) {
    await openTool(page,'구조 찾기');await page.getByLabel('해부 구조 검색').fill(id);
    await page.locator('.structure-item').filter({hasText:id}).click();await ready(page);
    const expected=limbSkeletonRegion(catalog.find((s:any)=>s.id===id));
    await expect(page.getByLabel('전신 부위 선택')).toHaveValue(expected!);
    expect((await snapshot(page)).layers.bone).toBe(true);expect((await rendered()).visible).toContain(id);
    await page.getByRole('button',{name:'선택 구조 확대',exact:true}).click();
  }
  const selected=await snapshot(page);await page.reload();await ready(page);
  expect((await snapshot(page)).anatomyRegion).toBe(selected.anatomyRegion);
  expect((await snapshot(page)).selection).toEqual(selected.selection);
  expect((await rendered()).hashes).toEqual(original);
  await page.getByLabel('전신 부위 선택').selectOption('upper-limb');
  await page.getByLabel('연속 해부 박리 깊이').fill('44.5');await ready(page);
  expect((await snapshot(page)).anatomyRegion).toBe('upper-limb');
  expect((await rendered()).hashes).toEqual(original);
  await page.getByRole('button',{name:'골격 빠른 보기',exact:true}).click();await ready(page);
  await page.getByLabel('전신 부위 선택').selectOption('upper-limb');
  if(await page.getByRole('button',{name:'도구 패널 닫기',exact:true}).isVisible())await closeTool(page);
  await page.screenshot({path:`docs/anatomy-alignment/${sex}-limb-region-desktop.png`});
  await page.setViewportSize({width:390,height:844});
  // Project every current limb bound corner: visibility flags alone do not
  // detect hands cut off by the old fixed-distance mobile camera.
  await expect.poll(()=>page.evaluate(async({url,ids})=>{
    const module=await import(/* @vite-ignore */url),s=module._roots.get(document.querySelector('canvas')).store.getState();
    let outside=0;
    s.camera.updateMatrixWorld(true);
    for(const id of ids) {
      const obj=s.scene.getObjectByName(id);if(!obj)continue;
      obj.traverse((mesh:any)=>{
        if(!mesh.isMesh)return;for(let p=mesh;p;p=p.parent)if(!p.visible)return;
        mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
        for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++) {
          const p=box.min.clone().set(x?box.max.x:box.min.x,y?box.max.y:box.min.y,z?box.max.z:box.min.z).applyMatrix4(mesh.matrixWorld).project(s.camera);
          if(Math.abs(p.x)>1||Math.abs(p.y)>1||Math.abs(p.z)>1)outside++;
        }
      });
    }
    return outside;
  },{url:fiberUrl,ids})).toBe(0);
  await page.screenshot({path:`docs/anatomy-alignment/${sex}-limb-region-mobile.png`});
  // A manually zoomed regional view without a selection also restores intact.
  const beforeZoom=(await snapshot(page)).camera;
  await page.getByRole('button',{name:'축소',exact:true}).click();
  await expect.poll(async()=>(await snapshot(page)).camera.position[2]).toBeGreaterThan(beforeZoom.position[2]);
  const zoomed=(await snapshot(page)).camera;
  await page.reload();await ready(page);
  const restored=(await snapshot(page)).camera;
  for(const key of ['position','target'])for(let i=0;i<3;i++)expect(restored[key][i]).toBeCloseTo(zoomed[key][i],12);
  expect(errors).toEqual([]);
});
