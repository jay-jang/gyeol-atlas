import {test,expect} from '@playwright/test';
import {ready,snapshot} from './helpers';

for(const sex of ['male','female'] as const)test(`${sex}: transparent peel meshes do not occlude later transparent anatomy`,async({page})=>{
  test.setTimeout(150000);
  let fiberUrl='';
  page.on('request',request=>{if(/\/@react-three_fiber\.js\?/.test(request.url()))fiberUrl=request.url();});
  await page.goto('/');await ready(page);
  if(sex==='female'){
    await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();
    await ready(page);
  }
  expect(fiberUrl).not.toBe('');
  const slider=page.getByLabel('연속 해부 박리 깊이');
  for(const depth of [10.5,50.5,66.5,82.5,91.5]){
    await slider.fill(String(depth));await ready(page);
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(depth);
    const rows=await page.evaluate(async url=>{
      const {_roots}=await import(/* @vite-ignore */url),canvas=document.querySelector('canvas')!;
      const scene=_roots.get(canvas).store.getState().scene;
      const ids=new Set((canvas.dataset.visibleStructureIds||'').split(','));
      const output:{name:string;opacity:number;transparent:boolean;depthWrite:boolean}[]=[];
      scene.traverseVisible((mesh:any)=>{
        if(!mesh.isMesh||!ids.has(mesh.name)&&!ids.has(mesh.parent?.name)||!mesh.material?.isMeshStandardMaterial)return;
        output.push({name:mesh.name,opacity:mesh.material.opacity,transparent:mesh.material.transparent,depthWrite:mesh.material.depthWrite});
      });
      return output;
    },fiberUrl);
    expect(rows.length).toBeGreaterThan(0);
    for(const row of rows){
      expect(row.transparent,`${sex}/${depth}/${row.name}`).toBe(row.opacity<.995);
      expect(row.depthWrite,`${sex}/${depth}/${row.name}`).toBe(!row.transparent);
    }
  }
  await page.screenshot({path:`docs/anatomy-alignment/translucent-depth-${sex}-desktop.png`});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:`docs/anatomy-alignment/translucent-depth-${sex}-mobile.png`});
});
