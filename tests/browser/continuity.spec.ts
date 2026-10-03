import {test,expect,type Page} from '@playwright/test';
import {ready,snapshot,settledCamera,markerScreenPoints} from './helpers';

// The camera only moves when the viewer asks for it (or a separate detail
// frame opens/closes): studying an organ, peeling, choosing acupoints and
// clearing the selection all keep the place being looked at.
const fiber=(page:Page)=>{let url='';page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))url=r.url();});return ()=>url;};
const distance=(c:{position:number[];target:number[]})=>Math.hypot(...c.position.map((v,i)=>v-c.target[i]));

test('an organ stays in view and selected through peeling, acupoints and clearing',async({page})=>{
  test.setTimeout(180000);
  const url=fiber(page),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');await ready(page);
  await page.getByLabel('연속 해부 박리 깊이').fill('40');await ready(page);
  const input=page.getByLabel('경혈·구조 검색');await input.click();await input.fill('stomach');
  await page.locator('.structure-item').first().click();await ready(page);await settledCamera(page);
  let s=await snapshot(page);
  expect(s.selection.ids).toEqual(['FMA7148']);expect(s.selection.layers).toEqual(['organ']);
  const studied=s.camera;
  // Peeling keeps the organ selected and the camera where it is.
  await page.getByLabel('연속 해부 박리 깊이').fill('60');await ready(page);await settledCamera(page);
  s=await snapshot(page);
  expect(s.dissection).toBe(60);expect(s.selection.ids).toEqual(['FMA7148']);expect(s.camera).toEqual(studied);
  // Choosing an acupoint keeps both.
  await page.getByRole('button',{name:'경혈 찾기',exact:true}).click();
  await page.getByLabel('경혈 검색').fill('CV12');await page.locator('.point-item').filter({hasText:'CV12'}).first().click();
  await ready(page);await settledCamera(page);
  s=await snapshot(page);
  expect(s.pointId).toBe('CV12');expect(s.selection.ids).toEqual(['FMA7148']);expect(s.camera).toEqual(studied);
  await page.screenshot({path:'docs/ui-renewal/continuity-organ-acupoint.png'});
  // Clearing keeps the camera too.
  await page.getByRole('button',{name:'구조 선택 해제',exact:true}).click();await ready(page);await settledCamera(page);
  s=await snapshot(page);
  expect(s.selection).toBe(null);expect(s.camera).toEqual(studied);expect(s.dissection).toBe(60);
  // A part clicked on the model becomes the orbit centre without any zoom.
  const spot=await page.evaluate(async url=>{
    const {_roots}=await import(/* @vite-ignore */url),canvas=document.querySelector('canvas')!,st=_roots.get(canvas).store.getState(),rect=canvas.getBoundingClientRect();
    const ids=new Set((canvas.dataset.visibleStructureIds||'').split(',')),meshes:any[]=[];
    st.scene.traverseVisible((m:any)=>{if(m.isMesh&&!m.isInstancedMesh&&ids.has(m.name)&&m.material.opacity>.5)meshes.push(m);});
    for(let fy=.3;fy<.75;fy+=.05)for(let fx=.25;fx<.6;fx+=.05){
      const x=rect.left+fx*rect.width,y=rect.top+fy*rect.height;
      if(document.elementFromPoint(x,y)!==canvas)continue;
      st.raycaster.setFromCamera({x:fx*2-1,y:-(fy*2-1)},st.camera);
      const hit=st.raycaster.intersectObjects(meshes,false)[0];
      if(hit)return {x,y,id:hit.object.name as string};
    }
    return null;
  },url());
  expect(spot).not.toBeNull();
  const markers=await markerScreenPoints(page,url());
  expect(markers.every(m=>Math.hypot(m.x-spot!.x,m.y-spot!.y)>9)).toBe(true);
  const before=(await snapshot(page)).camera;
  await page.mouse.click(spot!.x,spot!.y);await ready(page);await settledCamera(page);
  s=await snapshot(page);
  expect(s.selection.ids).toEqual([spot!.id]);
  expect(distance(s.camera)).toBeCloseTo(distance(before),6);
  const bounds=JSON.parse(await page.locator('canvas').getAttribute('data-selected-world-bounds')||'null');
  for(let axis=0;axis<3;axis++)expect(s.camera.target[axis]).toBeCloseTo((bounds[0][axis]+bounds[1][axis])/2,5);
  expect(errors).toEqual([]);
});

test.describe('motion',()=>{
  test.use({reducedMotion:'no-preference'});
  test('camera moves glide to the same pose that reduced motion jumps to',async({page})=>{
    test.setTimeout(180000);
    const url=fiber(page);
    await page.setViewportSize({width:1440,height:900});
    await page.goto('/');await ready(page);
    const input=page.getByLabel('경혈·구조 검색');await input.click();await input.fill('stomach');
    await page.locator('.structure-item').first().click();await ready(page);await settledCamera(page);
    const samples=await page.evaluate(async url=>{
      const {_roots}=await import(/* @vite-ignore */url),st=_roots.get(document.querySelector('canvas')!).store.getState();
      const d=()=>st.camera.position.distanceTo(st.controls.target);
      const out=[d()];(document.querySelector('[aria-label="계통 전체 보기"]') as HTMLElement).click();
      for(let i=0;i<10;i++){await new Promise(r=>setTimeout(r,70));out.push(d());}
      return out;
    },url());
    const start=samples[0],end=samples[samples.length-1];
    expect(end).toBeGreaterThan(start*2);
    // At least two frames between the two poses: a glide, not a jump.
    expect(samples.filter(v=>v>start*1.05&&v<end*.95).length).toBeGreaterThanOrEqual(2);
    await settledCamera(page);
    expect(distance((await snapshot(page)).camera)).toBeCloseTo(end,5);
  });
});
