import {test,expect} from '@playwright/test';
import {ready,snapshot} from './helpers';
import {musclePeelGroups,musclePeelRelations} from '../../src/muscle-peel-relations';

test('male upper-back muscles peel after their covering trapezius, without moving meshes',async({page})=>{
  test.setTimeout(180000);
  const errors:string[]=[];let fiberUrl='';
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/\/@react-three_fiber\.js\?/.test(request.url()))fiberUrl=request.url();});
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  const groups=musclePeelGroups.filter(group=>group.source==='upperBack');
  const ids=[...new Set(groups.flatMap(group=>group.levels.flat()))];
  const relations=musclePeelRelations.filter(([outer,inner])=>ids.includes(outer as typeof ids[number])&&ids.includes(inner as typeof ids[number]));
  expect(ids).toHaveLength(12);expect(relations).toHaveLength(18);
  const inspect=()=>page.evaluate(async({url,ids})=>{
    const {_roots}=await import(/* @vite-ignore */url),state=_roots.get(document.querySelector('canvas')).store.getState();
    state.scene.updateMatrixWorld(true);
    return Object.fromEntries(ids.map(id=>{
      const mesh=state.scene.getObjectByName(id);if(!mesh?.isMesh)throw new Error(`Missing ${id}`);
      mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      return [id,{start:24+36*mesh.userData.peelRank,alpha:mesh.material.opacity,visible:mesh.visible,
        bounds:[...box.min.toArray(),...box.max.toArray()],matrix:mesh.matrixWorld.toArray()}];
    }));
  },{url:fiberUrl,ids});
  const slider=page.getByLabel('연속 해부 박리 깊이');await slider.fill('20');await ready(page);
  const baseline=await inspect();
  for(const [outer,inner] of relations)expect(baseline[inner].start-baseline[outer].start).toBeGreaterThanOrEqual(4-1e-10);
  for(const depth of [32,36.5,37,38,40.5,64]){
    await slider.fill(String(depth));await ready(page);
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(depth);
    const current=await inspect();
    for(const id of ids){expect(current[id].bounds).toEqual(baseline[id].bounds);expect(current[id].matrix).toEqual(baseline[id].matrix);}
    for(const [outer,inner] of relations)if(current[inner].alpha<1-1e-9){
      expect(current[outer].alpha,`${outer}/${inner}/${depth}`).toBeLessThan(1e-9);
      expect(current[outer].visible).toBe(false);
    }
  }
  for(const [width,height] of [[1440,900],[390,844]]){
    await page.setViewportSize({width,height});
    for(const depth of [32,38]){
      await slider.fill(String(depth));await ready(page);
      await page.evaluate(async({url,distance})=>{
        const {_roots}=await import(/* @vite-ignore */url),state=_roots.get(document.querySelector('canvas')).store.getState();
        state.controls.target.set(0,1.38,0);state.camera.position.set(0,1.38,-distance);
        state.controls.update();state.invalidate();
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      },{url:fiberUrl,distance:width===390?1.5:.9});
      await expect(page.locator('canvas')).toBeInViewport();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:`docs/anatomy-alignment/upper-back-peel-${depth}-${width}.png`});
    }
  }
  expect(errors).toEqual([]);
});
