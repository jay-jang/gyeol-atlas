import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {ready,snapshot} from './helpers';
import {musclePeelGroups,musclePeelRelations} from '../../src/muscle-peel-relations';
import before from '../../docs/anatomy-alignment/gluteal-peel-before.json' with {type:'json'};

for(const sex of ['male','female'] as const)test(`${sex}: sourced gluteal order and all existing relations hold in rendered meshes`,async({page})=>{
  test.setTimeout(240000);let url='';const errors:string[]=[];
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))url=r.url();});page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  if(sex==='female'){await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);}
  const slider=page.getByLabel('연속 해부 박리 깊이');await slider.fill('20');await ready(page);
  const groups=musclePeelGroups.filter(g=>g.sex===sex),ids=[...new Set(groups.flatMap(g=>g.levels.flat()))];
  const gluteal=groups.filter(g=>g.source==='gluteal'),glutealIds=[...new Set(gluteal.flatMap(g=>g.levels.flat()))];
  const inspect=(hash=false)=>page.evaluate(async({url,ids,hash})=>{
    const {_roots}=await import(/* @vite-ignore */url),{scene}=_roots.get(document.querySelector('canvas')).store.getState();scene.updateMatrixWorld(true);
    const result:any={};const digest=async(a:any)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength)))).map(x=>x.toString(16).padStart(2,'0')).join('');
    for(const id of ids){const m=scene.getObjectByName(id);if(!m?.isMesh)throw Error(id);m.geometry.computeBoundingBox();const b=m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
      result[id]={start:24+36*m.userData.peelRank,end:28+36*m.userData.peelRank,alpha:m.material.opacity,visible:m.visible,bounds:[...b.min.toArray(),...b.max.toArray()],matrix:m.matrixWorld.toArray()};
      if(hash){result[id].positions=await digest(m.geometry.attributes.position.array);result[id].indices=await digest(m.geometry.index.array);}
    }return result;
  },{url,ids,hash});
  const baseline=await inspect(true),relations=musclePeelRelations.filter(([a,b])=>ids.includes(a as typeof ids[number])&&ids.includes(b as typeof ids[number]));
  const depths=[...new Set([20,64,...relations.flatMap(([a,b])=>[baseline[a].end,baseline[b].start+.5])])].sort((a,b)=>a-b);
  for(const d of depths){await slider.fill(String(d));await ready(page);await expect.poll(async()=>(await snapshot(page)).dissection).toBe(d);
    const actual=await inspect();for(const id of ids){expect(actual[id].bounds).toEqual(baseline[id].bounds);expect(actual[id].matrix).toEqual(baseline[id].matrix);}
    for(const [a,b] of relations)if(actual[b].alpha<1-1e-9){expect(actual[a].alpha,`${a}/${b}/${d}`).toBeLessThan(1e-9);expect(actual[a].visible).toBe(false);}
  }
  const final=await inspect(true);for(const id of ids){expect(final[id].positions).toBe(baseline[id].positions);expect(final[id].indices).toBe(baseline[id].indices);}
  const chains=gluteal.filter(g=>g.levels.length===3);
  const captureDepths=[Math.max(...chains.map(g=>baseline[g.levels[0][0]].end)),Math.max(...chains.map(g=>baseline[g.levels[1][0]].end))];
  const min=[0,1,2].map(i=>Math.min(...glutealIds.map(id=>baseline[id].bounds[i]))),max=[0,1,2].map(i=>Math.max(...glutealIds.map(id=>baseline[id].bounds[i+3])));
  const center=min.map((v,i)=>(v+max[i])/2),span=Math.max(...min.map((v,i)=>max[i]-v));
  for(const [index,d] of captureDepths.entries())for(const [width,height] of [[1440,900],[390,844]]){
    await page.setViewportSize({width,height});await slider.fill(String(d));await ready(page);
    await page.evaluate(async({url,center,distance})=>{const {_roots}=await import(/* @vite-ignore */url),s=_roots.get(document.querySelector('canvas')).store.getState();s.controls.target.fromArray(center);s.camera.position.set(center[0],center[1],center[2]-distance);s.controls.update();s.invalidate();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));},{url,center,distance:span*(width===390?8:3.2)});
    await page.screenshot({path:`docs/anatomy-alignment/gluteal-peel-${sex}-${index}-${width}.png`});
  }
  const changes=before[sex].map(row=>({...row,afterStart:baseline[row.id].start,afterEnd:baseline[row.id].end}));
  expect(errors).toEqual([]);
  fs.writeFileSync(`docs/anatomy-alignment/gluteal-peel-${sex}.json`,JSON.stringify({sex,relations:relations.length,checkedIds:ids,depths,changes,captureDepths,baseline,errors},null,2)+'\n');
});
