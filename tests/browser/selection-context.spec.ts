import {test,expect,type Page} from '@playwright/test';
import {ready,openTool,closeTool,snapshot} from './helpers';
import {detailProjection} from './detail-projection';
import fs from 'node:fs';

test.use({viewport:{width:1440,height:900}});
async function inspect(page:Page,url:string,id:string){
  return page.evaluate(async({url,id})=>{
    const {_roots}=await import(/* @vite-ignore */url),canvas=document.querySelector('canvas')!,state=_roots.get(canvas).store.getState();
    const ids=new Set((canvas.dataset.visibleStructureIds||'').split(','));
    state.scene.updateMatrixWorld(true);const meshes:any[]=[];
    state.scene.traverseVisible((m:any)=>{if(m.isMesh&&m.geometry.attributes.position&&(ids.has(m.name)||ids.has(m.parent?.name)))meshes.push(m);});
    const digest=async(data:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const rows=await Promise.all(meshes.map(async m=>{
      const p=m.geometry.attributes.position.array,i=m.geometry.index?.array;
      return {name:m.name,selected:m.name===id||m.parent?.name===id,opacity:m.material.opacity,depthWrite:m.material.depthWrite,
        shape:await digest(new Uint8Array(p.buffer,p.byteOffset,p.byteLength)),index:i?await digest(new Uint8Array(i.buffer,i.byteOffset,i.byteLength)):'',matrix:m.matrixWorld.toArray()};
    }));
    return rows.sort((a,b)=>a.name.localeCompare(b.name));
  },{url,id});
}

async function selectedPixels(page:Page,url:string){
  const p=await detailProjection(page,url);
  const clip={x:Math.max(0,Math.floor(p.left)),y:Math.max(0,Math.floor(p.top)),width:Math.ceil(p.right)-Math.max(0,Math.floor(p.left)),height:Math.ceil(p.bottom)-Math.max(0,Math.floor(p.top))};
  const png=await page.screenshot({clip});
  return page.evaluate(async base64=>{
    const img=new Image();img.src=`data:image/png;base64,${base64}`;await img.decode();
    const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d')!;ctx.drawImage(img,0,0);
    const data=ctx.getImageData(0,0,c.width,c.height).data;let cyan=0;
    for(let n=0;n<data.length;n+=4)if(data[n+1]>80&&data[n+1]>data[n]*1.45&&data[n+2]>data[n]*1.45)cyan++;
    return {cyan,area:c.width*c.height};
  },png.toString('base64'));
}

const overlappingRay=(page:Page,url:string,id:string)=>page.evaluate(async({url,id})=>{
  const {_roots}=await import(/* @vite-ignore */url),canvas=document.querySelector('canvas')!,s=_roots.get(canvas).store.getState(),rect=canvas.getBoundingClientRect(),meshes:any[]=[];
  const ids=new Set((canvas.dataset.visibleStructureIds||'').split(','));
  s.scene.traverseVisible((m:any)=>{if(m.isMesh&&(ids.has(m.name)||ids.has(m.parent?.name)))meshes.push(m);});
  const bounds=JSON.parse(canvas.dataset.selectedWorldBounds!),mid=s.camera.position.clone().set(...bounds[0]).add(s.camera.position.clone().set(...bounds[1])).multiplyScalar(.5).project(s.camera);
  for(let y=-4;y<=4;y++)for(let x=-4;x<=4;x++){
    const ndc={x:mid.x+x*.025,y:mid.y+y*.025};s.raycaster.setFromCamera(ndc,s.camera);
    const hits=s.raycaster.intersectObjects(meshes,false),match=(h:any)=>h.object.name===id||h.object.parent?.name===id;
    if(hits.some(match)&&!match(hits[0]))return {x:rect.left+(ndc.x+1)*rect.width/2,y:rect.top+(1-ndc.y)*rect.height/2,front:ids.has(hits[0].object.name)?hits[0].object.name:hits[0].object.parent.name};
  }return null;
},{url,id});

for(const [sex,id] of [['male','FMA7204'],['female','HRAF0432']] as const)test(`${sex}: context aid reveals a selected internal organ without moving or isolating anatomy`,async({page},testInfo)=>{
  test.setTimeout(150000);let url='';const errors:string[]=[];
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))url=r.url();});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await ready(page);
  if(sex==='female'){await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);}
  // The male 4.0 kidney detail (BP4_) also cites FMA7204; these steps need the whole-body mesh.
  await openTool(page,'구조 찾기');await page.getByLabel('해부 구조 검색').fill(id);await page.locator('.structure-item').filter({hasNotText:'BP4_'}).click();await ready(page);await closeTool(page);
  const checkbox=page.getByRole('checkbox',{name:/주변 반투명/});await expect(checkbox).toBeChecked();
  await expect.poll(async()=>(await detailProjection(page,url)).clearance).toBeGreaterThan(0);
  const before=await inspect(page,url,id),saved=await snapshot(page);
  await testInfo.attach('context-materials',{body:JSON.stringify(before.map(({name,opacity,depthWrite,selected})=>({name,opacity,depthWrite,selected}))),contentType:'application/json'});
  expect(saved.isolated).toBe(false);expect(before.length).toBeGreaterThan(1);
  expect(before.filter(m=>m.selected).every(m=>m.opacity===1&&m.depthWrite)).toBe(true);
  expect(before.filter(m=>!m.selected).every(m=>m.opacity<=.12&&!m.depthWrite)).toBe(true);
  await checkbox.uncheck();const solidPixels=await selectedPixels(page,url);
  const solid=await inspect(page,url,id);expect(solid.filter(m=>!m.selected).every(m=>m.opacity===1)).toBe(true);
  await page.screenshot({path:`docs/anatomy-alignment/selection-context-${sex}-solid.png`});
  await checkbox.check();const ghostPixels=await selectedPixels(page,url);
  await testInfo.attach('selected-color-pixels',{body:JSON.stringify({solidPixels,ghostPixels}),contentType:'application/json'});
  expect(ghostPixels.cyan).toBeGreaterThan(solidPixels.cyan+200);
  const shape=(rows:any[])=>rows.map(({opacity,depthWrite,...r})=>r);
  expect(shape(await inspect(page,url,id))).toEqual(shape(solid));expect(shape(solid)).toEqual(shape(before));
  expect((await snapshot(page)).alpha).toEqual(saved.alpha);expect((await snapshot(page)).camera).toEqual(saved.camera);
  await page.screenshot({path:`docs/anatomy-alignment/selection-context-${sex}-desktop.png`});
  // Find a true ray hit where the selected mesh lies behind other geometry.
  const click=await overlappingRay(page,url,id);
  expect(click).not.toBeNull();await page.mouse.click(click!.x,click!.y);await ready(page);
  expect((await snapshot(page)).selection.ids).toEqual([id]);
  await page.reload();await ready(page);await expect(checkbox).toBeChecked();
  expect(shape(await inspect(page,url,id))).toEqual(shape(before));
  await page.setViewportSize({width:390,height:844});await page.locator('.selection-actions').getByRole('button',{name:'확대',exact:true}).click();
  await expect.poll(async()=>(await detailProjection(page,url)).clearance).toBeGreaterThan(0);
  await expect(checkbox).toBeInViewport();await expect(page.getByRole('button',{name:'구조 선택 해제',exact:true})).toBeInViewport();
  await page.screenshot({path:`docs/anatomy-alignment/selection-context-${sex}-mobile.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const style=await page.locator('.selection-context').evaluate(el=>{
    const rgb=(s:string)=>s.match(/[\d.]+/g)!.map(Number);
    const lum=(a:number[])=>a.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
    return [el,el.querySelector('small')!].map(node=>{
      const c=getComputedStyle(node);let ancestor:Element|null=node,bg=[255,255,255];
      while(ancestor){const color=rgb(getComputedStyle(ancestor).backgroundColor);if((color[3]??1)>.99){bg=color;break;}ancestor=ancestor.parentElement;}
      const a=lum(rgb(c.color)),b=lum(bg);return {font:parseFloat(c.fontSize),color:c.color,background:bg,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
    });
  });
  for(const sample of style){expect(sample.font).toBeGreaterThanOrEqual(12);expect(sample.contrast).toBeGreaterThanOrEqual(4.5);}
  await testInfo.attach('context-label-style',{body:JSON.stringify(style),contentType:'application/json'});
  // Turning the aid off restores ordinary frontmost picking even on the same ray.
  await page.setViewportSize({width:1440,height:900});await page.locator('.selection-actions').getByRole('button',{name:'확대',exact:true}).click();
  await checkbox.focus();await page.keyboard.press('Space');await expect(checkbox).not.toBeChecked();
  await page.reload();await ready(page);await expect(checkbox).not.toBeChecked();
  const ordinaryClick=await overlappingRay(page,url,id);expect(ordinaryClick).not.toBeNull();
  await page.mouse.click(ordinaryClick!.x,ordinaryClick!.y);await ready(page);
  expect((await snapshot(page)).selection.ids).toEqual([ordinaryClick!.front]);
  await openTool(page,'구조 찾기');await page.getByLabel('해부 구조 검색').fill(id);await page.locator('.structure-item').filter({hasNotText:'BP4_'}).click();await ready(page);await closeTool(page);
  await expect(checkbox).not.toBeChecked();
  await page.getByRole('button',{name:'구조 선택 해제',exact:true}).click();await ready(page);
  const clearedState=await snapshot(page);
  expect(clearedState.selection).toBe(null);expect(clearedState.selectionReturn).toBe(null);
  expect(clearedState.displayMode).toBe('dissection');expect(clearedState.dissection).toBe(0);
  expect(clearedState.layers.skin).toBe(true);expect(clearedState.layers.organ).toBe(false);
  const cleared=await inspect(page,url,id);expect(cleared.every(m=>m.opacity===1)).toBe(true);
  expect((await snapshot(page)).alpha).toEqual(saved.alpha);expect(errors).toEqual([]);
  fs.writeFileSync(`docs/anatomy-alignment/selection-context-${sex}-evidence.json`,JSON.stringify({id,solidPixels,ghostPixels,style,overlappingHit:click,ordinaryHit:ordinaryClick,meshes:before},null,2)+'\n');
});

test('vascular, neural and lymph reference renderers share the aid and keyboard preference restoration',async({page})=>{
  test.setTimeout(180000);let url='';
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))url=r.url();});
  await page.goto('/');await ready(page);
  for(const id of ['ZA_vessel_abdominal_aorta','ZA_nerve_sciatic_nerve_l','ZA_lymph_spleen']){
    await openTool(page,'구조 찾기');await page.getByLabel('해부 구조 검색').fill(id);await page.locator('.structure-item').click();await ready(page);await closeTool(page);
    const checkbox=page.getByRole('checkbox',{name:'주변 반투명',exact:true});await checkbox.check();
    const before=await inspect(page,url,id);expect(before.filter(m=>m.selected).length).toBeGreaterThan(0);
    expect(before.filter(m=>!m.selected).length).toBeGreaterThan(0);
    expect(before.filter(m=>!m.selected).every(m=>m.opacity<=.12&&!m.depthWrite)).toBe(true);
    const saved=await snapshot(page);await checkbox.focus();await page.keyboard.press('Space');await expect(checkbox).not.toBeChecked();
    const solid=await inspect(page,url,id);expect(solid.every(m=>m.opacity===1)).toBe(true);
    const shape=(rows:any[])=>rows.map(({opacity,depthWrite,...r})=>r);expect(shape(solid)).toEqual(shape(before));
    expect((await snapshot(page)).camera).toEqual(saved.camera);expect((await snapshot(page)).alpha).toEqual(saved.alpha);
  }
  await page.getByRole('link',{name:'지식 위키',exact:true}).click();await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('link',{name:'3D 경혈 지도',exact:true}).click();await ready(page);
  await expect(page.getByRole('checkbox',{name:'주변 반투명',exact:true})).not.toBeChecked();
  expect((await snapshot(page)).selection.ids).toEqual(['ZA_lymph_spleen']);
});
