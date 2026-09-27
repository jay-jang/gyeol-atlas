import {test,expect,type Page} from '@playwright/test';
import {ready,snapshot} from './helpers';
import fs from 'node:fs';
import maleGroups from '../../data/male-detail-groups.json' with {type:'json'};
import femaleGroups from '../../data/female-detail-groups.json' with {type:'json'};

async function geometry(page:Page,url:string,ids:string[]){
  return page.evaluate(async({url,ids})=>{
    const {_roots}=await import(/* @vite-ignore */url),canvas=document.querySelector('canvas')!,s=_roots.get(canvas).store.getState(),rows:any[]=[];
    s.scene.updateMatrixWorld(true);
    const hash=async(a:any)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength)))).map(x=>x.toString(16).padStart(2,'0')).join('');
    const meshes:any[]=[];s.scene.traverse((m:any)=>{if(m.isMesh&&ids.includes(m.name))meshes.push(m);});
    for(const m of meshes)rows.push({id:m.name,positions:await hash(m.geometry.attributes.position.array),indices:await hash(m.geometry.index.array),matrix:m.matrixWorld.toArray()});
    return rows.sort((a,b)=>a.id.localeCompare(b.id));
  },{url,ids});
}

const samples=[
  {sex:'male',group:maleGroups.find(g=>g.id==='heart')!,child:'BP4_FJ2631'},
  {sex:'male',group:maleGroups.find(g=>g.id==='liver')!,child:'BP4_FJ1893'},
  {sex:'male',group:maleGroups.find(g=>g.id==='lung')!,child:'BP4_FJ6044'},
  {sex:'female',group:femaleGroups.find(g=>g.id==='abdomen-ct')!,child:'CTF_autochthon_left'},
];
for(const sample of samples)test(`${sample.sex} ${sample.group.id}: restoring detail context keeps every original member and the selected child`,async({page})=>{
  test.setTimeout(150000);let url='';const errors:string[]=[];
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))url=r.url();});
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  await page.locator('.explore-sidebar').getByRole('button',{name:sample.sex==='male'?'남성':'여성',exact:true}).click();await ready(page);
  await page.locator('.featured-anatomy > button').filter({has:page.getByText(sample.group.name,{exact:true})}).click();await ready(page);
  const canvas=page.locator('canvas'),visible=async()=>(await canvas.getAttribute('data-visible-structure-ids')||'').split(',').filter(Boolean).sort();
  const expected=[...sample.group.ids].sort();await expect.poll(visible).toEqual(expected);
  const before=await snapshot(page),shape=await geometry(page,url,sample.group.ids);
  const bounds=JSON.parse(await canvas.getAttribute('data-selected-world-bounds')||'null');
  const frameError=async()=>Math.max(...(await snapshot(page)).camera.target.map((v:number,i:number)=>Math.abs(v-(bounds[0][i]+bounds[1][i])/2)));
  const projection=()=>page.evaluate(async({url,bounds})=>{
    const {_roots}=await import(/* @vite-ignore */url),canvas=document.querySelector('canvas')!,{camera}=_roots.get(canvas).store.getState(),rect=canvas.getBoundingClientRect(),card=document.querySelector('.selection-card')!.getBoundingClientRect(),points=[];
    for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++){
      const p=camera.position.clone().set(bounds[x][0],bounds[y][1],bounds[z][2]).project(camera);
      points.push({x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2});
    }
    const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y));
    return {canvasClearance:Math.min(left-rect.left,rect.right-right,top-rect.top,rect.bottom-bottom),cardClearance:Math.max(card.top-bottom,top-card.bottom,card.left-right,left-card.right)};
  },{url,bounds});
  expect(shape).toHaveLength(expected.length);
  await page.locator('.organ-detail-parts summary').click();
  await expect.poll(frameError).toBeLessThan(.001);
  await page.locator('.organ-detail-parts button').nth(sample.group.ids.indexOf(sample.child)).click();await ready(page);
  await expect.poll(visible).toEqual([sample.child]);
  expect((await snapshot(page)).detail.id).toBe(sample.group.id);
  await page.getByRole('button',{name:'전체 구조 보기',exact:true}).click();await ready(page);
  await expect.poll(visible).toEqual(expected);
  const restored=await snapshot(page);
  expect(restored.selection.ids).toEqual([sample.child]);expect(restored.isolated).toBe(false);
  expect(restored.detail).toEqual(before.detail);expect(restored.layers).toEqual(before.layers);
  expect(restored.alpha).toEqual(before.alpha);expect(restored.markers).toEqual(before.markers);
  expect(await geometry(page,url,sample.group.ids)).toEqual(shape);
  await page.locator('.organ-detail-parts summary').click();
  await expect.poll(frameError).toBeLessThan(.001);
  await expect.poll(async()=>(await projection()).canvasClearance).toBeGreaterThan(0);
  await expect.poll(async()=>(await projection()).cardClearance).toBeGreaterThan(0);
  await page.screenshot({path:`docs/anatomy-alignment/detail-context-${sample.sex}-${sample.group.id}-desktop.png`});
  await page.reload();await ready(page);await expect.poll(visible).toEqual(expected);
  expect((await snapshot(page)).selection.ids).toEqual([sample.child]);
  await page.setViewportSize({width:390,height:844});
  await expect.poll(frameError).toBeLessThan(.001);
  for(const name of ['후면','측면','정면']){
    await page.locator('.view-presets').getByRole('button',{name,exact:true}).click();
    await expect.poll(frameError).toBeLessThan(.001);
    await expect.poll(async()=>(await projection()).canvasClearance).toBeGreaterThan(0);
    await expect.poll(async()=>(await projection()).cardClearance).toBeGreaterThan(0);
  }
  await page.getByRole('button',{name:'선택 구조만 보기',exact:true}).click();await ready(page);await expect.poll(visible).toEqual([sample.child]);
  await page.getByRole('button',{name:'전체 구조 보기',exact:true}).click();await ready(page);await expect.poll(visible).toEqual(expected);
  await expect.poll(frameError).toBeLessThan(.001);
  await expect(page.getByRole('button',{name:'전신으로 돌아가기',exact:true})).toBeInViewport();
  await page.screenshot({path:`docs/anatomy-alignment/detail-context-${sample.sex}-${sample.group.id}-mobile.png`});
  expect(await geometry(page,url,sample.group.ids)).toEqual(shape);
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5');await ready(page);
  expect((await snapshot(page)).detail).toBe(null);expect((await snapshot(page)).selection).toBe(null);
  expect((await snapshot(page)).dissection).toBe(50.5);expect(errors).toEqual([]);
  fs.writeFileSync(`docs/anatomy-alignment/detail-context-${sample.sex}-${sample.group.id}.json`,JSON.stringify({group:sample.group.id,child:sample.child,expected,restored,shape,errors},null,2)+'\n');
});
