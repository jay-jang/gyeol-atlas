import {test,expect,type Page} from '@playwright/test';
import {ready,snapshot,settledCamera,markerScreenPoints} from './helpers';

// Clicking an acupoint must not fall through to the tissue under it and
// re-frame the scene, and a part clicked on purpose is selected in place.
const fiber=(page:Page)=>{let url='';page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))url=r.url();});return ()=>url;};
async function zoomIn(page:Page){
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'확대',exact:true}).last().click();
  await settledCamera(page);
}
// A drawn marker with no other marker close by, inside the free canvas area.
async function loneMarker(page:Page,url:string){
  const points=await markerScreenPoints(page,url);
  const lone=[];
  for(const a of points){
    if(points.some(b=>b!==a&&Math.hypot(a.x-b.x,a.y-b.y)<52))continue;
    if(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.tagName==='CANVAS'&&document.elementFromPoint(x+28,y)?.tagName==='CANVAS'&&document.elementFromPoint(x-28,y)?.tagName==='CANVAS',a))lone.push(a);
  }
  expect(lone.length).toBeGreaterThan(0);
  return lone[Math.floor(lone.length/2)];
}
// A canvas pixel whose frontmost hit is a catalogued structure, clear of every marker target.
async function tissueSpot(page:Page,url:string){
  const markers=await markerScreenPoints(page,url);
  return page.evaluate(async({url,markers})=>{
    const {_roots}=await import(/* @vite-ignore */url),canvas=document.querySelector('canvas')!,s=_roots.get(canvas).store.getState(),rect=canvas.getBoundingClientRect();
    const ids=new Set((canvas.dataset.visibleStructureIds||'').split(',')),meshes:any[]=[];
    s.scene.traverseVisible((m:any)=>{if(m.isMesh&&!m.isInstancedMesh&&ids.has(m.name)&&m.material.opacity>.05)meshes.push(m);});
    for(let y=rect.height*.25;y<rect.height*.75;y+=6)for(let x=rect.width*.2;x<rect.width*.8;x+=6){
      const px=rect.left+x,py=rect.top+y;
      if(markers.some((m:any)=>Math.hypot(m.x-px,m.y-py)<36)||document.elementFromPoint(px,py)!==canvas)continue;
      s.raycaster.setFromCamera({x:x/rect.width*2-1,y:-(y/rect.height)*2+1},s.camera);
      const hit=s.raycaster.intersectObjects(meshes,false)[0];
      if(hit)return {x:px,y:py,id:hit.object.name as string};
    }
    return null;
  },{url,markers});
}
const kept=['layers','dissection','displayMode','stage','anatomyRegion','alpha','markers'] as const;
const gap=(c:{position:number[];target:number[]})=>Math.hypot(...c.position.map((v,i)=>v-c.target[i]));

test('a near miss picks the acupoint, a drag is not a pick, and tissue is selected in place',async({page})=>{
  test.setTimeout(180000);
  const url=fiber(page),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');await ready(page);await settledCamera(page);
  await zoomIn(page);
  const marker=await loneMarker(page,url());
  const before=await snapshot(page);
  // The drawn dot is a few pixels; from outside its 14px target nothing is hovered.
  await page.mouse.move(marker.x+18,marker.y);
  await expect(page.locator('.point-label')).toHaveCount(0);
  await page.mouse.move(marker.x+11,marker.y,{steps:3});
  const label=page.locator('.point-label.peek');
  await expect(label).toHaveCount(1);
  const id=(await label.textContent())!.trim();
  await page.screenshot({path:'docs/ui-renewal/marker-hover-target.png',clip:{x:marker.x-110,y:marker.y-70,width:220,height:140}});
  // Once hovered, the target widens: drifting to 20px keeps it, and a click there selects it.
  await page.mouse.move(marker.x+20,marker.y,{steps:3});
  await expect(label).toHaveText(id);
  await page.mouse.down();await page.mouse.up();
  await expect.poll(async()=>(await snapshot(page)).pointId).toBe(id);
  let s=await snapshot(page);
  expect(s.selection).toBe(null);expect(s.camera).toEqual(before.camera);
  for(const key of kept)expect(s[key]).toEqual(before[key]);
  const pose=(await snapshot(page)).camera;
  // A deliberate click on tissue: selected where it is, without re-framing.
  const tissue=await tissueSpot(page,url());
  expect(tissue).not.toBeNull();
  await page.mouse.click(tissue!.x,tissue!.y);await ready(page);
  await expect.poll(async()=>(await snapshot(page)).selection?.ids).toEqual([tissue!.id]);
  await settledCamera(page);
  s=await snapshot(page);
  // No zoom: the orbit centre moves onto the picked part at the same distance.
  expect(gap(s.camera)).toBeCloseTo(gap(pose),6);expect(s.selectionReturn).toBe(null);expect(s.isolated).toBe(false);
  for(const key of kept)expect(s[key]).toEqual(before[key]);
  await expect(page.getByRole('region',{name:'선택 구조 조작'})).toBeVisible();
  await page.screenshot({path:'docs/ui-renewal/inplace-pick-desktop.png'});
  // Framing stays one press away.
  await page.locator('.selection-actions').getByRole('button',{name:'확대',exact:true}).click();await settledCamera(page);
  expect((await snapshot(page)).camera).not.toEqual(pose);
  await page.getByRole('button',{name:'구조 선택 해제',exact:true}).click();await ready(page);
  s=await snapshot(page);
  expect(s.selection).toBe(null);for(const key of kept)expect(s[key]).toEqual(before[key]);
  // Releasing an orbit drag over the body selects nothing, even when the
  // pointer comes back to where the press began.
  await page.getByRole('button',{name:'시점 초기화'}).click();await zoomIn(page);
  const spot=await tissueSpot(page,url());
  expect(spot).not.toBeNull();
  await page.mouse.move(spot!.x,spot!.y);await page.mouse.down();
  await page.mouse.move(spot!.x+60,spot!.y+10,{steps:8});await page.mouse.move(spot!.x+2,spot!.y,{steps:8});
  await page.mouse.up();await ready(page);
  s=await snapshot(page);
  expect(s.selection).toBe(null);expect(s.pointId).toBe(id);
  expect(errors).toEqual([]);
});

test.describe('touch',()=>{
  test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  test('a tap beside an acupoint picks it and tissue taps keep the camera on a phone',async({page})=>{
    test.setTimeout(180000);
    const url=fiber(page),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/');await ready(page);await settledCamera(page);
    await zoomIn(page);
    const before=await snapshot(page);
    const marker=await loneMarker(page,url());
    // Touch has no hover, so its resting target is already the wide one.
    const ids=await page.evaluate(()=>document.querySelector('canvas')!.dataset.renderedPointIds);
    await page.touchscreen.tap(marker.x+18,marker.y);
    await expect.poll(async()=>(await snapshot(page)).pointId).not.toBe(before.pointId);
    let s=await snapshot(page);
    expect(ids!.split(',')).toContain(s.pointId);expect(s.selection).toBe(null);expect(s.camera).toEqual(before.camera);
    const tissue=await tissueSpot(page,url());
    expect(tissue).not.toBeNull();
    await page.touchscreen.tap(tissue!.x,tissue!.y);await ready(page);
    await expect.poll(async()=>(await snapshot(page)).selection?.ids).toEqual([tissue!.id]);
    await settledCamera(page);
    s=await snapshot(page);
    expect(gap(s.camera)).toBeCloseTo(gap(before.camera),6);for(const key of kept)expect(s[key]).toEqual(before[key]);
    await expect(page.getByRole('button',{name:'구조 선택 해제',exact:true})).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.waitForTimeout(400);
    await page.screenshot({path:'docs/ui-renewal/inplace-pick-mobile.png'});
    expect(errors).toEqual([]);
  });
});

test('over peeled tissue an acupoint keeps a smaller target, so organs near it stay clickable',async({page})=>{
  test.setTimeout(180000);
  const url=fiber(page);
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');await ready(page);
  await page.getByLabel('연속 해부 박리 깊이').fill('80');await ready(page);await settledCamera(page);
  await zoomIn(page);
  const marker=await loneMarker(page,url());
  // 12px is inside the skin-view target (14px) but outside the 9px one over tissue.
  await page.mouse.move(marker.x+12,marker.y,{steps:3});
  await expect(page.locator('.point-label.peek')).toHaveCount(0);
  await page.mouse.move(marker.x+6,marker.y,{steps:3});
  await expect(page.locator('.point-label.peek')).toHaveCount(1);
});
