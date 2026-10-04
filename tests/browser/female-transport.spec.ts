import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import {ready,snapshot,openSearch,choosePoint,settledCamera,markerScreenPoints} from './helpers';
const transported=JSON.parse(fs.readFileSync('data/female-transport-structures.json','utf8')).length;

// The female body carries the male-derived vessels, nerves, muscles, ligaments,
// tendons and lymph through one registration field, re-places the borrowed
// bones with it, and keeps every carried structure searchable as its source.
const fiber=(page:Page)=>{let url='';page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))url=r.url();});return ()=>url;};
const visible=async(page:Page)=>new Set(((await page.locator('canvas').getAttribute('data-visible-structure-ids'))||'').split(','));
const female=async(page:Page)=>{
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await expect(page.locator('canvas')).toHaveAttribute('data-female-transport-parts',String(transported));
};
const setView=async(page:Page,patch:Record<string,unknown>)=>{
  await page.evaluate(patch=>{const s=JSON.parse(sessionStorage.getItem('gyeol-view-v2')!);sessionStorage.setItem('gyeol-view-v2',JSON.stringify({...s,...patch}));},patch);
  await page.reload();await ready(page);
};

test('the female body is complete with the carried systems, peels in order and keeps sources',async({page})=>{
  test.setTimeout(240000);
  const url=fiber(page),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  await female(page);
  const canvas=page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-female-atlas-parts','1220');
  await expect(canvas).toHaveAttribute('data-female-transport-visible',String(transported));
  let ids=await visible(page);
  // One muscle source in the overview: the separate donor leg muscles wait for search.
  expect([...ids].filter(id=>id.startsWith('VHF'))).toEqual([]);
  for(const id of ['FT_ZA_nerve_sural_nerve_l','FT_ZA_vessel_great_saphenous_vein_l','FT_FMA13375','HRAF0003'])expect(ids.has(id),id).toBe(true);
  await page.screenshot({path:'docs/anatomy-alignment/female-transport-desktop.png'});
  // Peeling: muscles thin out by the male peel order; nerves stay.
  const muscles0=Number(await canvas.getAttribute('data-visible-muscle'));
  await page.getByLabel('연속 해부 박리 깊이').fill('40');await ready(page);
  const muscles40=Number(await canvas.getAttribute('data-visible-muscle'));
  expect(muscles40).toBeLessThan(muscles0);expect(muscles40).toBeGreaterThan(50);
  expect(Number(await canvas.getAttribute('data-visible-nerve'))).toBeGreaterThan(500);
  await page.screenshot({path:'docs/anatomy-alignment/female-transport-peel-desktop.png'});
  await page.getByLabel('연속 해부 박리 깊이').fill('0');await ready(page);
  // The re-placed clavicle meets the native sternum (it was 25-30 mm away).
  const joint=await page.evaluate(async url=>{
    const {_roots}=await import(/* @vite-ignore */url),s=_roots.get(document.querySelector('canvas')!).store.getState();
    const clavicle=s.scene.getObjectByName('BM0070'),manubrium=s.scene.getObjectByName('HRAF0824');
    const p=clavicle.geometry.attributes.position,m=manubrium.geometry.attributes.position;let best=Infinity;
    const medial:number[][]=[];for(let i=0;i<p.count;i++)medial.push([p.getX(i),p.getY(i),p.getZ(i)]);
    medial.sort((a,b)=>Math.abs(a[0])-Math.abs(b[0]));
    for(const v of medial.slice(0,40))for(let j=0;j<m.count;j++)best=Math.min(best,Math.hypot(v[0]-m.getX(j),v[1]-m.getY(j),v[2]-m.getZ(j)));
    return best;
  },url());
  expect(joint).toBeLessThan(0.004);
  // A carried structure is found by its English name and FMA ID and names its source.
  const input=await openSearch(page);
  await input.fill('FMA13375');
  await expect(page.locator('.structure-item').filter({hasText:'FT_FMA13375'})).toHaveCount(1);
  await input.fill('Sural nerve (left)');
  await page.locator('.structure-item').filter({hasText:'FT_ZA_nerve_sural_nerve_l'}).first().click();await ready(page);
  expect((await snapshot(page)).selection.ids).toEqual(['FT_ZA_nerve_sural_nerve_l']);
  await expect(page.locator('.selection-source')).toContainText('여성 정합 보완');
  await expect(page.locator('.selection-card')).toContainText('남성 원본을 여성 골격·피부 대응으로 옮긴 보완 구조');
  // The donor leg muscle is still there for an explicit choice.
  await input.fill('VHF0043');
  await page.locator('.structure-item').filter({hasText:'VHF0043'}).first().click();await ready(page);
  ids=await visible(page);expect(ids.has('VHF0043')).toBe(true);
  await expect(page.locator('[data-donor-muscle-note]')).toContainText('개요에서는 숨기고');
  expect(errors).toEqual([]);
});

test('the genital cover hides external genitalia in both bodies and is remembered',async({page})=>{
  test.setTimeout(240000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  const toggle=page.locator('.ax-top').getByRole('button',{name:'성기 가리기'});
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  const canvas=page.locator('canvas');
  // Male: peeled to the organs, the genital organs are drawn until covered.
  await setView(page,{dissection:72,camera:{target:[0,.76,.02],position:[.15,.82,.55]},markers:'hidden'});
  let ids=await visible(page);expect(ids.has('FMA19618')).toBe(true);
  await toggle.focus();await page.keyboard.press('Enter');await ready(page);
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  ids=await visible(page);for(const id of ['FMA19618','FMA18247','FMA7211','FMA19235'])expect(ids.has(id),id).toBe(false);
  expect(ids.has('FMA9600')).toBe(true);
  await setView(page,{dissection:0});
  await expect(canvas).toHaveAttribute('data-modesty-cover','true');
  await page.screenshot({path:'docs/anatomy-alignment/modesty-male-desktop.png'});
  // The preference survives a reload and a change of body.
  expect((await snapshot(page)).modesty).toBe(true);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await expect(canvas).toHaveAttribute('data-modesty-cover','true');
  await page.screenshot({path:'docs/anatomy-alignment/modesty-female-desktop.png'});
  await setView(page,{dissection:80});
  ids=await visible(page);expect(ids.has('HRAF0406')).toBe(false);expect(ids.has('HRAF0435')).toBe(true);
  await toggle.click();await ready(page);
  ids=await visible(page);expect(ids.has('HRAF0406')).toBe(true);
  // The same preference is in the display settings.
  await page.getByRole('button',{name:'표시 설정',exact:true}).click();
  const box=page.getByRole('checkbox',{name:'성기 가리기'});await expect(box).not.toBeChecked();
  await box.check();await expect(toggle).toHaveAttribute('aria-pressed','true');
  await page.setViewportSize({width:390,height:844});
  await expect(toggle).toBeInViewport();
  expect(errors).toEqual([]);
});

test('female approximate acupoints are opt-in, focus on the female surface and are remembered',async({page})=>{
  test.setTimeout(240000);
  const url=fiber(page),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const femaleAnchors=JSON.parse(fs.readFileSync('public/models/acupoint-anchors-female.json','utf8'));
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  await female(page);
  // Hidden by default: the unreviewed female coordinates wait for an explicit choice.
  const note=page.locator('.ax-point-bar .ax-note');
  await expect(note).toContainText('검수 전이라 표식을 숨깁니다');
  expect(await markerScreenPoints(page,url())).toHaveLength(0);
  expect((await snapshot(page)).femaleMarkers).toBe(false);
  const show=note.getByRole('button',{name:'근사 위치로 보기'});
  await show.focus();await page.keyboard.press('Enter');await ready(page);
  const approx=page.getByRole('button',{name:'여성 근사 표식 끄기'});
  await expect(approx).toHaveAttribute('aria-pressed','true');
  // Every drawn marker (front-facing ones) sits on a carried female anchor.
  const drawn=()=>page.evaluate(async url=>{
    const {_roots}=await import(/* @vite-ignore */url),s=_roots.get(document.querySelector('canvas')!).store.getState();
    let mesh:any;s.scene.traverse((o:any)=>{if(o.isInstancedMesh&&o.userData.acupointMarkers)mesh=o;});
    const out:number[][]=[];if(!mesh)return out;const m=s.camera.matrixWorld.clone(),v=s.camera.position.clone();
    for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);if(!m.elements[0])continue;v.setFromMatrixPosition(m);mesh.localToWorld(v);out.push([v.x,v.y,v.z]);}
    return out;
  },url());
  await expect.poll(async()=>(await drawn()).length).toBeGreaterThan(400);
  const misplaced=(await drawn()).filter(p=>!femaleAnchors.some((a:any)=>Math.hypot(p[0]-a.position[0],p[1]-a.position[1],p[2]-a.position[2])<0.002));
  expect(misplaced).toEqual([]);
  expect((await snapshot(page)).femaleMarkers).toBe(true);
  await page.screenshot({path:'docs/anatomy-alignment/female-markers-desktop.png'});
  // Focus moves to the carried female anchor, not the male coordinate.
  await choosePoint(page,'LU1');await ready(page);
  const focus=page.getByRole('button',{name:'3D에서 가까이 보기'});
  if(!await focus.isVisible())await page.locator('.point-summary').click();
  await focus.click();await settledCamera(page);
  const anchor=femaleAnchors.find((a:any)=>a.pointId==='LU1'&&a.side!=='left');
  const target=(await snapshot(page)).camera.target;
  expect(Math.hypot(...target.map((v:number,i:number)=>v-anchor.position[i]))).toBeLessThan(0.001);
  // The choice survives a reload and a round trip through the male body.
  await page.reload();await ready(page);
  await expect(approx).toHaveAttribute('aria-pressed','true');
  await page.locator('.ax-top').getByRole('button',{name:'남성',exact:true}).click();await ready(page);
  await expect(approx).toHaveCount(0);
  await female(page);
  await expect(approx).toHaveAttribute('aria-pressed','true');
  // Mobile keeps the scene; the toggle stays reachable and turns them off again.
  await page.setViewportSize({width:390,height:844});
  await expect(approx).toBeInViewport();
  await page.screenshot({path:'docs/anatomy-alignment/female-markers-mobile.png'});
  await approx.click();await ready(page);
  await expect(note).toContainText('검수 전이라 표식을 숨깁니다');
  expect(await markerScreenPoints(page,url())).toHaveLength(0);
  expect((await snapshot(page)).femaleMarkers).toBe(false);
  expect(errors).toEqual([]);
});
