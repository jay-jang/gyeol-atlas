import {test,expect} from '@playwright/test';
import {ready,snapshot,openTool,closeTool} from './helpers';
import {musclePeelGroups,musclePeelRelations} from '../../src/muscle-peel-relations';

test('female anterior thigh exposes vastus intermedius only after both rectus femoris sources peel',async({page})=>{
  test.setTimeout(180000);
  const errors:string[]=[];let fiberUrl='';
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/\/@react-three_fiber\.js\?/.test(request.url()))fiberUrl=request.url();});
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  const groups=musclePeelGroups.filter(group=>group.sex==='female'&&group.source==='anteriorThigh');
  const ids=[...new Set(groups.flatMap(group=>group.levels.flat()))];
  const relations=musclePeelRelations.filter(([outer,inner])=>ids.includes(outer as typeof ids[number])&&ids.includes(inner as typeof ids[number]));
  expect(ids).toHaveLength(6);expect(relations).toHaveLength(4);
  const inspect=()=>page.evaluate(async({url,ids})=>{
    const {_roots}=await import(/* @vite-ignore */url),state=_roots.get(document.querySelector('canvas')).store.getState();
    state.scene.updateMatrixWorld(true);
    return Object.fromEntries(ids.map(id=>{
      const mesh=state.scene.getObjectByName(id);if(!mesh?.isMesh)throw Error(`Missing ${id}`);
      mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      return [id,{start:24+36*mesh.userData.peelRank,alpha:mesh.material.opacity,visible:mesh.visible,
        bounds:[...box.min.toArray(),...box.max.toArray()],matrix:mesh.matrixWorld.toArray()}];
    }));
  },{url:fiberUrl,ids});
  const slider=page.getByLabel('연속 해부 박리 깊이');await slider.fill('20');await ready(page);
  expect(fiberUrl).not.toBe('');
  const baseline=await inspect();
  for(const [outer,inner] of relations)expect(baseline[inner].start-baseline[outer].start).toBeGreaterThanOrEqual(4-1e-10);
  for(const depth of [47,48,49.5,50.5,51,52,55]){
    await slider.fill(String(depth));await ready(page);
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(depth);
    const current=await inspect();
    for(const id of ids){expect(current[id].bounds).toEqual(baseline[id].bounds);expect(current[id].matrix).toEqual(baseline[id].matrix);}
    for(const [outer,inner] of relations)if(current[inner].alpha<1-1e-9){
      expect(current[outer].alpha,`${outer}/${inner}/${depth}`).toBeLessThan(1e-9);
      expect(current[outer].visible).toBe(false);
    }
  }
  const min=[0,1,2].map(axis=>Math.min(...ids.map(id=>baseline[id].bounds[axis])));
  const max=[0,1,2].map(axis=>Math.max(...ids.map(id=>baseline[id].bounds[axis+3])));
  const center=min.map((value,axis)=>(value+max[axis])/2);
  const span=Math.max(...min.map((value,axis)=>max[axis]-value));
  for(const [width,height] of [[1440,900],[390,844]])for(const depth of [48,52]){
    await page.setViewportSize({width,height});await slider.fill(String(depth));await ready(page);
    await page.evaluate(async({url,center,distance})=>{
      const {_roots}=await import(/* @vite-ignore */url),state=_roots.get(document.querySelector('canvas')).store.getState();
      state.controls.target.fromArray(center);state.camera.position.set(center[0],center[1],center[2]+distance);
      state.controls.update();state.invalidate();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    },{url:fiberUrl,center,distance:span*(width===390?7:3.2)});
    await expect(page.locator('canvas')).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`docs/anatomy-alignment/anterior-thigh-peel-${depth}-${width}.png`});
  }
  await openTool(page,'구조 찾기');
  await page.getByLabel('해부 구조 검색').fill('VHF0009');
  await page.locator('.structure-item').filter({hasText:'VHF0009'}).click();await ready(page);await closeTool(page);
  const selected=await inspect();
  expect((await snapshot(page)).selection.ids).toEqual(['VHF0009']);
  expect(selected.VHF0009.visible).toBe(true);
  expect(selected.VHF0009.alpha).toBe(1);
  expect(selected.HRAF0394.visible).toBe(false);
  const movement=await page.locator('.movement-pad').boundingBox();
  const card=await page.locator('.selection-card').boundingBox();
  expect(movement).not.toBeNull();expect(card).not.toBeNull();
  expect(movement!.y+movement!.height).toBeLessThan(card!.y-4);
  await page.screenshot({path:'docs/anatomy-alignment/anterior-thigh-donor-selected-mobile.png'});
  await page.locator('.movement-pad summary').click();
  await expect(page.locator('.movement-pad')).toHaveAttribute('open','');
  const cameraBefore=(await snapshot(page)).camera;
  await page.getByRole('button',{name:'위로 이동',exact:true}).click();
  await expect.poll(async()=>(await snapshot(page)).camera.target[1]).toBeGreaterThan(cameraBefore.target[1]);
  await page.locator('.movement-pad summary').click();
  expect(errors).toEqual([]);
});
