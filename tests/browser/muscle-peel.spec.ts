import {test,expect} from '@playwright/test';
import {ready,openTool,closeTool,snapshot} from './helpers';
import {musclePeelGroups,musclePeelRelations} from '../../src/muscle-peel-relations';

for(const sex of ['male','female'] as const)test(`${sex}: actual meshes obey sourced outer-to-inner peel precedence and selection restores a hidden muscle`,async({page})=>{
  test.setTimeout(180000);
  let fiberUrl='';const errors:string[]=[];
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await ready(page);
  if(sex==='female'){await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);}
  const depth=page.getByLabel('연속 해부 박리 깊이');await depth.fill('20');await ready(page);
  expect(fiberUrl).not.toBe('');
  const ids=[...new Set(musclePeelGroups.filter(g=>g.sex===sex).flatMap(g=>g.levels.flat()))];
  const inspect=()=>page.evaluate(async({url,ids})=>{
    const {_roots}=await import(/* @vite-ignore */url),state=_roots.get(document.querySelector('canvas')).store.getState();
    state.scene.updateMatrixWorld(true);
    return Object.fromEntries(ids.map(id=>{
      const mesh=state.scene.getObjectByName(id);if(!mesh?.isMesh)throw new Error(`Missing real muscle ${id}`);
      mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      return [id,{rank:mesh.userData.peelRank,visible:mesh.visible,alpha:mesh.material.opacity,bounds:[...b.min.toArray(),...b.max.toArray()]}];
    }));
  },{url:fiberUrl,ids});
  const baseline=await inspect();
  const relations=musclePeelRelations.filter(([outer,inner])=>ids.includes(outer as typeof ids[number])&&ids.includes(inner as typeof ids[number]));
  const depths=[...new Set([20,64,...relations.flatMap(([outer,inner])=>[28+baseline[outer].rank*36,24+baseline[inner].rank*36+.5])])].sort((a,b)=>a-b);
  for(const value of depths){
    await depth.fill(String(Math.round(value*2)/2));await ready(page);
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(Math.round(value*2)/2);
    const actual=await inspect();
    for(const id of ids)expect(actual[id].bounds).toEqual(baseline[id].bounds);
    for(const [outer,inner] of relations){
      if(actual[inner].alpha<1-1e-9){expect(actual[outer].alpha,`${value}: ${outer} before ${inner}`).toBeLessThan(1e-9);expect(actual[outer].visible).toBe(false);}
    }
  }
  const target=sex==='male'?'FMA22559':'VHF0022';
  await openTool(page,'구조 찾기');await page.getByLabel('해부 구조 검색').fill('soleus');
  await page.locator('.structure-item').filter({hasText:target}).click();await ready(page);await closeTool(page);
  const state=await snapshot(page);expect(state.displayMode).toBe('layers');expect(state.selection.ids).toEqual([target]);expect(state.layers.muscle).toBe(true);
  const selected=await inspect();expect(selected[target].alpha).toBe(1);expect(selected[target].visible).toBe(true);expect(selected[target].bounds).toEqual(baseline[target].bounds);
  // Search intentionally frames its selection; normal layer switches preserve
  // that pose, rather than requiring the pre-search whole-body camera.
  await page.getByRole('button',{name:'근육 빠른 보기',exact:true}).click();await ready(page);
  expect((await snapshot(page)).camera).toEqual(state.camera);
  await page.getByLabel('전신 부위 선택').selectOption('lower-limb');
  await depth.fill(String(24+baseline[target].rank*36));await ready(page);
  await page.getByRole('button',{name:'후면',exact:true}).click();
  await expect.poll(async()=>(await snapshot(page)).camera.position[2]).toBeLessThan(0);
  // A diagnostic calf close-up, using only the same OrbitControls pan/zoom
  // pose as manual observation; no mesh/material override is used.
  await page.evaluate(async url=>{
    const {_roots}=await import(/* @vite-ignore */url),state=_roots.get(document.querySelector('canvas')).store.getState();
    state.controls.target.set(0,.33,0);state.camera.position.set(0,.33,-1.0);
    state.controls.update();state.invalidate();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  },fiberUrl);
  await page.screenshot({path:`docs/anatomy-alignment/muscle-peel-${sex}.png`});
  if(sex==='female'){
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(async url=>{
      const {_roots}=await import(/* @vite-ignore */url),state=_roots.get(document.querySelector('canvas')).store.getState();
      state.controls.target.set(-.03,.33,0);state.camera.position.set(-.03,.33,-2.1);
      state.controls.update();state.invalidate();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    },fiberUrl);
    await page.screenshot({path:'docs/anatomy-alignment/muscle-peel-female-mobile.png'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});
