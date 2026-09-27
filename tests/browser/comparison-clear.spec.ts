import {test,expect} from '@playwright/test';
import {ready,compare,snapshot} from './helpers';

for(const sex of ['male','female'] as const)test(`${sex}: clearing a comparison removes the hidden highlight and survives reload`,async({page})=>{
  test.setTimeout(150000);
  let fiberUrl='';const errors:string[]=[];
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/#atlas/KI3');await ready(page);
  if(sex==='female'){
    await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  }
  const inspect=async(ids:string[])=>page.evaluate(async({url,ids})=>{
    const {_roots}=await import(/* @vite-ignore */url);
    const {scene}=_roots.get(document.querySelector('canvas')).store.getState();scene.updateMatrixWorld(true);
    const rows:any[]=[];const meshes:any[]=[];
    scene.traverse((m:any)=>{if(m.isMesh&&ids.includes(m.name))meshes.push(m);});
    const hash=async(a:any)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength)))).map(x=>x.toString(16).padStart(2,'0')).join('');
    for(const m of meshes)rows.push({id:m.name,color:m.material.color.getHexString(),positions:await hash(m.geometry.attributes.position.array),indices:await hash(m.geometry.index.array),matrix:m.matrixWorld.toArray()});
    return rows.sort((a,b)=>a.id.localeCompare(b.id));
  },{url:fiberUrl,ids});
  for(const [width,height] of [[1440,900],[390,844]]){
    await page.setViewportSize({width,height});await compare(page);
    const ids=(await snapshot(page)).comparison.ids;
    expect(ids).toHaveLength(sex==='male'?2:50);
    await expect.poll(async()=>(await inspect(ids)).filter(r=>r.color==='e5b24f').length).toBe(ids.length);
    await page.getByRole('button',{name:'비교 대상만 보기',exact:true}).click();
    await expect.poll(async()=>(await snapshot(page)).isolated).toBe(true);
    const before=await snapshot(page),geometry=await inspect(ids);
    await page.getByRole('button',{name:'구조 선택 해제',exact:true}).click();
    await expect(page.locator('.selection-card')).toHaveCount(0);
    await expect.poll(async()=>(await snapshot(page)).comparison).toBe(null);
    const after=await snapshot(page);
    expect(after.selection).toBe(null);expect(after.detail).toBe(null);expect(after.isolated).toBe(false);
    await expect(page.locator('.comparison-note')).toHaveCount(0);
    for(const key of ['layers','alpha','markers','camera','pointId'])expect(after[key]).toEqual(before[key]);
    const cleared=await inspect(ids);
    expect(cleared.filter(r=>r.color==='e5b24f')).toHaveLength(0);
    expect(cleared.map(({color,...r})=>r)).toEqual(geometry.map(({color,...r})=>r));
    await page.screenshot({path:`docs/anatomy-alignment/comparison-clear-${sex}-${width===1440?'desktop':'mobile'}.png`});
    await page.reload();await ready(page);
    expect((await snapshot(page)).comparison).toBe(null);
    expect((await inspect(ids)).filter(r=>r.color==='e5b24f')).toHaveLength(0);
    // Recreate the valid old snapshot produced by the previous clear action.
    await page.evaluate(comparison=>{
      const saved=JSON.parse(sessionStorage.getItem('gyeol-view-v2')!);
      sessionStorage.setItem('gyeol-view-v2',JSON.stringify({...saved,comparison}));
    },before.comparison);
    await page.reload();await ready(page);
    expect((await snapshot(page)).comparison).toBe(null);
    const restored=await snapshot(page);
    for(const key of ['layers','alpha','markers','pointId'])expect(restored[key]).toEqual(after[key]);
    for(const key of ['position','target'])for(let i=0;i<3;i++)expect(restored.camera[key][i]).toBeCloseTo(after.camera[key][i],8);
    expect((await inspect(ids)).filter(r=>r.color==='e5b24f')).toHaveLength(0);
    await page.getByLabel('연속 해부 박리 깊이').fill('66.5');await ready(page);
    expect((await snapshot(page)).dissection).toBe(66.5);
    expect((await snapshot(page)).selection).toBe(null);
  }
  expect(errors).toEqual([]);
});
